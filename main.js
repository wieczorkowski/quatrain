const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws');
// Import the DataService
const DataService = require('./src/services/data-service');

// Track main window reference
let mainWindow = null;
// Track all trade manager windows
let tradeWindows = [];
// Track all trade manager windows
let tradeManagerWindows = [];

// NinjaTrader Bridge connection status
let isConnectedToNTBridge = false;

// Initialize the shared data service
const dataService = new DataService();

// Track window IDs for debugging
let windowIds = new Map();
// Keep track of current market data (legacy - now using DataService)
let currentMarketData = { symbol: null, price: null };

// Track candle subscriptions for smart stop by candle
const candleSubscriptions = new Map(); // timeframe -> set of windows interested

// Candle forwarding WebSocket server
let candleForwardingServer = null;
let connectedClients = new Set();
let isDataFlowing = false; // Track if Quatrain is actively receiving data

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "Quatrain Charting Client",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow = win; // Store reference to main window
    
    win.loadURL(`file://${path.join(__dirname, 'build/index.html')}`);

    // Handle main window closure
    win.on('closed', () => {
        console.log("Main window closed. Cleaning up child windows.");
        // Close all trade windows when main window is closed
        console.log("Closing Trade Windows...");
        [...tradeWindows].forEach(tw => {
            if (tw && !tw.isDestroyed()) {
                console.log(`Closing Trade Window ID: ${tw.id}`);
                tw.close();
            }
        });
        tradeWindows = [];

        // Close all trade manager windows when main window is closed
        console.log("Closing Trade Manager Windows...");
        [...tradeManagerWindows].forEach(tmw => {
            if (tmw && !tmw.isDestroyed()) {
                console.log(`Closing Trade Manager Window ID: ${tmw.id}`);
                tmw.close();
            }
        });
        tradeManagerWindows = [];

        mainWindow = null;
    });

    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Reset Chart Client',
                    accelerator: process.platform === 'darwin' ? 'Cmd+R' : 'Ctrl+R',
                    click: () => {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            // Send an IPC event to the renderer process
                            mainWindow.webContents.send('reset-quatrain');
                            console.log('Reset Quatrain command sent');
                        }
                    },
                },
                {
                    label: 'Quit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => app.quit(),
                },
            ],
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'View Server Messages',
                    click: () => {
                        win.webContents.send('open-server-log'); // Send IPC event to open log pane
                    },
                },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
                    role: 'toggleDevTools',
                },
            ],
        },
        {
            label: 'Charts',
            submenu: [
                {
                    label: 'Settings',
                    click: () => {
                        win.webContents.send('open-settings');
                    },
                },
                {
                    label: 'Annotations',
                    click: () => {
                        win.webContents.send('open-annotation-manager');
                    },
                },
            ],
        },
        {
            label: 'Strategy',
            submenu: [
                {
                    label: 'Indicators and Studies',
                    click: () => {
                        // Send IPC event to open the Indicators and Studies panel
                        win.webContents.send('open-indicators-studies');
                    },
                },
                {
                    label: 'User Studies',
                    click: () => {
                        // Send IPC event to open the User Studies panel
                        win.webContents.send('open-user-studies');
                    },
                },
                { type: 'separator' },
                {
                    label: 'External Strategies',
                    click: () => {
                        win.webContents.send('open-strategy-manager');
                    },
                },
            ],
        },
        {
            label: 'Trading',
            submenu: [
                {
                    label: 'Open Trade Manager',
                    click: () => {
                        // Check if a Trade Manager window already exists
                        const existingTradeManager = tradeManagerWindows.find(win => win && !win.isDestroyed());

                        if (existingTradeManager) {
                            console.log('Main Process: Trade Manager already open. Focusing existing window.');
                            // If it exists, focus it
                            if (existingTradeManager.isMinimized()) existingTradeManager.restore();
                            existingTradeManager.focus();
                            // Optional: Flash frame to draw attention
                            existingTradeManager.flashFrame(true);
                        } else {
                            console.log('Main Process: No Trade Manager open. Creating a new one.');
                            // If not, create a new one
                            createTradeManagerWindow();
                        }
                    },
                },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Learn More',
                    click: async () => {
                        const { shell } = require('electron');
                        await shell.openExternal('https://github.com/xai-org/grok');
                    },
                },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

// Function to initialize the candle forwarding WebSocket server
function initializeCandleForwardingServer() {
    const port = 8081; // Use a different port than Chronicle (8080)
    
    try {
        candleForwardingServer = new WebSocket.Server({ port }, () => {
            console.log(`Candle Forwarding Server: Listening on port ${port}`);
        });

        candleForwardingServer.on('connection', (ws) => {
            console.log('Candle Forwarding Server: New client connected');
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    console.log('Candle Forwarding Server: Received message:', data);
                    
                    if (data.action === 'sync') {
                        if (isDataFlowing) {
                            // Quatrain is already receiving data, reject the sync
                            ws.send(JSON.stringify({ sync: "notready" }));
                            console.log('Candle Forwarding Server: Sync rejected - data already flowing');
                        } else {
                            // Quatrain is at title screen, accept the sync
                            connectedClients.add(ws);
                            ws.send(JSON.stringify({ sync: "ready" }));
                            console.log('Candle Forwarding Server: Client synced successfully');
                            
                            // Notify the UI that an external client has synced (this will show on title screen)
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send('external-client-synced');
                            }
                        }
                    }
                } catch (error) {
                    console.error('Candle Forwarding Server: Error parsing message:', error);
                }
            });

            ws.on('close', () => {
                console.log('Candle Forwarding Server: Client disconnected');
                connectedClients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('Candle Forwarding Server: Client error:', error);
                connectedClients.delete(ws);
            });
        });

        candleForwardingServer.on('error', (error) => {
            console.error('Candle Forwarding Server: Server error:', error);
        });

    } catch (error) {
        console.error('Candle Forwarding Server: Failed to initialize:', error);
    }
}

// Function to forward candle data to connected clients
function forwardCandleData(candleMessage) {
    if (connectedClients.size === 0) return;
    
    const messageStr = JSON.stringify(candleMessage);
    const clientsToRemove = [];
    
    connectedClients.forEach(client => {
        try {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            } else {
                clientsToRemove.push(client);
            }
        } catch (error) {
            console.error('Candle Forwarding Server: Error sending data to client:', error);
            clientsToRemove.push(client);
        }
    });
    
    // Clean up disconnected clients
    clientsToRemove.forEach(client => {
        connectedClients.delete(client);
    });
}

// Function to reset candle forwarding state (called when Quatrain resets)
function resetCandleForwarding() {
    isDataFlowing = false;
    
    // Send "sync ended" message to all connected clients before closing
    connectedClients.forEach(client => {
        try {
            if (client.readyState === WebSocket.OPEN) {
                console.log('Candle Forwarding Server: Sending sync ended message to client');
                client.send(JSON.stringify({ sync: "ended" }));
                // Give a small delay to ensure message is sent before closing
                setTimeout(() => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.close();
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Candle Forwarding Server: Error sending sync ended message or closing client connection:', error);
        }
    });
    connectedClients.clear();
    
    console.log('Candle Forwarding Server: State reset, ready for new connections');
}

// Function to shut down the candle forwarding server
function shutdownCandleForwardingServer() {
    if (candleForwardingServer) {
        // Send "sync ended" message to all connected clients before shutdown
        connectedClients.forEach(client => {
            try {
                if (client.readyState === WebSocket.OPEN) {
                    console.log('Candle Forwarding Server: Sending sync ended message to client before shutdown');
                    client.send(JSON.stringify({ sync: "ended" }));
                }
            } catch (error) {
                console.error('Candle Forwarding Server: Error sending sync ended message during shutdown:', error);
            }
        });
        
        // Small delay to ensure messages are sent before closing
        setTimeout(() => {
            resetCandleForwarding();
            candleForwardingServer.close(() => {
                console.log('Candle Forwarding Server: Server shut down');
            });
            candleForwardingServer = null;
        }, 150);
    }
}

// Function to create the Trade Manager window
function createTradeManagerWindow() {
    // Create the browser window for Trade Manager using the same dimensions as main window
    const tradeWindow = new BrowserWindow({
        width: mainWindow ? mainWindow.getSize()[0] : 1200,
        height: mainWindow ? mainWindow.getSize()[1] : 800,
        title: "Trade Manager",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        parent: mainWindow, // Set the main window as parent
        modal: false // Not a modal window
    });

    // Create a custom menu for the Trade Manager window
    const tradeManagerMenu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: 'Close Trade Manager',
                    accelerator: process.platform === 'darwin' ? 'Cmd+W' : 'Ctrl+W',
                    click: () => {
                        if (tradeWindow && !tradeWindow.isDestroyed()) {
                            tradeWindow.close();
                        }
                    },
                },
            ],
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Developer Tools',
                    accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
                    role: 'toggleDevTools',
                },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Learn More',
                    click: async () => {
                        const { shell } = require('electron');
                        await shell.openExternal('https://github.com/xai-org/grok');
                    },
                },
            ],
        },
    ]);
    
    // Set the custom menu for this window
    tradeWindow.setMenu(tradeManagerMenu);

    // Add to tracked trade windows
    tradeManagerWindows.push(tradeWindow);

    // Load the index.html but with a query parameter to indicate Trade Manager view
    tradeWindow.loadURL(`file://${path.join(__dirname, 'build/index.html')}?view=tradeManager`);
    
    // Get the current market data from the main window and send it immediately
    if (mainWindow && !mainWindow.isDestroyed()) {
        // Request current market data from main window
        mainWindow.webContents.send('request-current-market-data');
    }
    
    // Open DevTools in development mode when debugging
    // tradeWindow.webContents.openDevTools();
    
    // Emitted when the window is closed
    tradeWindow.on('closed', () => {
        console.log(`Trade Manager window closed: ${tradeWindow.id}`);
        
        // Also close all associated Trade Windows
        console.log('Main Process: Closing all Trade Windows because Trade Manager closed.');
        [...tradeWindows].forEach(tw => {
            if (tw && !tw.isDestroyed()) {
              console.log(`Main Process: Closing Trade Window ID: ${tw.id}`);
              tw.close();
            }
        });
        
        // The important fix: Remove all IPC listeners that are specific to this window
        // or that could cause issues if this window is gone
        console.log('Main Process: Cleaning up IPC listeners related to Trade Manager');
        
        // No need to remove global listeners, but we should clean up specific listeners
        // that might reference this specific Trade Manager window
        
        // Remove window from tracked windows
        tradeManagerWindows = tradeManagerWindows.filter(win => win !== tradeWindow);
    });
}

// Function to create a Trade Window
function createTradeWindow() {
    // Create a smaller browser window for placing trades
    const tradeWindow = new BrowserWindow({
        width: 500,
        height: 740, // Increased from 600 to 780 (30% increase)
        title: "Place Trade",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        resizable: true,
        minimizable: true,
        maximizable: false,
        parent: null // No parent to allow independent positioning
    });

    // Track menu states for toggleable features
    let chartTraderVisible = false;
    let smartStopVisible = false;

    // Function to update menu based on current panel states
    const updateMenuState = () => {
        console.log(`Main Process: Updating trade window menu - ChartTrader: ${chartTraderVisible}, SmartStop: ${smartStopVisible}`);
        tradeWindow.setMenu(buildTradeWindowMenu());
    };

    // Create a custom menu for the Trade Window
    const buildTradeWindowMenu = () => Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: 'Close',
                    accelerator: process.platform === 'darwin' ? 'Cmd+W' : 'Ctrl+W',
                    click: () => {
                        if (tradeWindow && !tradeWindow.isDestroyed()) {
                            tradeWindow.close();
                        }
                    },
                },
            ],
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Developer Tools',
                    accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
                    role: 'toggleDevTools',
                },
            ],
        },
        {
            label: 'Advanced',
            submenu: [
                {
                    label: 'Trade the Chart',
                    type: 'checkbox',
                    checked: chartTraderVisible,
                    click: () => {
                        if (tradeWindow && !tradeWindow.isDestroyed()) {
                            // If currently checked, just uncheck it
                            if (chartTraderVisible) {
                                chartTraderVisible = false;
                                updateMenuState();
                                tradeWindow.webContents.send('toggle-chart-trader');
                            } 
                            // If not checked, make sure smart stop is unchecked first
                            else {
                                chartTraderVisible = true;
                                smartStopVisible = false; // Ensure only one is active
                                updateMenuState();
                                tradeWindow.webContents.send('toggle-chart-trader');
                            }
                        }
                    },
                },
                {
                    label: 'Smart Stop',
                    type: 'checkbox',
                    checked: smartStopVisible,
                    click: () => {
                        if (tradeWindow && !tradeWindow.isDestroyed()) {
                            // If currently checked, just uncheck it
                            if (smartStopVisible) {
                                smartStopVisible = false;
                                updateMenuState();
                                tradeWindow.webContents.send('toggle-smart-stop');
                            }
                            // If not checked, make sure chart trader is unchecked first
                            else {
                                smartStopVisible = true;
                                chartTraderVisible = false; // Ensure only one is active
                                updateMenuState();
                                tradeWindow.webContents.send('toggle-smart-stop');
                            }
                        }
                    },
                },
            ],
        },
    ]);
    
    // Set the custom menu for this window
    tradeWindow.setMenu(buildTradeWindowMenu());

    // Add to tracked trade windows
    tradeWindows.push(tradeWindow);

    // Load the index.html with query parameter to indicate Trade Window view
    tradeWindow.loadURL(`file://${path.join(__dirname, 'build/index.html')}?view=tradeWindow`);
    
    // Listen for panel state changes from renderer
    ipcMain.on('chart-trader-state-changed', (event, isVisible) => {
        // Only process events from this window
        if (event.sender.id === tradeWindow.webContents.id) {
            console.log(`Main Process: Chart Trader state changed to ${isVisible}`);
            chartTraderVisible = isVisible;
            // If Chart Trader is now visible, ensure Smart Stop is hidden
            if (isVisible) {
                smartStopVisible = false;
            }
            updateMenuState();
        }
    });
    
    ipcMain.on('smart-stop-state-changed', (event, isVisible) => {
        // Only process events from this window
        if (event.sender.id === tradeWindow.webContents.id) {
            console.log(`Main Process: Smart Stop state changed to ${isVisible}`);
            smartStopVisible = isVisible;
            // If Smart Stop is now visible, ensure Chart Trader is hidden
            if (isVisible) {
                chartTraderVisible = false;
            }
            updateMenuState();
        }
    });
    
    // Emitted when the window is closed
    tradeWindow.on('closed', () => {
        // Need to properly remove the IPC listeners for this specific window
        // The previous implementation was incorrect - we can't pass an anonymous function to removeListener
        // as it won't match the original listener
        
        // Remove all listeners for these events that we specifically added for this window
        ipcMain.removeAllListeners('chart-trader-state-changed');
        ipcMain.removeAllListeners('smart-stop-state-changed');
        
        console.log(`Main Process: Trade Window closed and IPC listeners removed`);
        
        // Remove window from tracked windows
        tradeWindows = tradeWindows.filter(win => win !== tradeWindow);
    });
}

// Broadcast a message to all Trade Manager windows
function broadcastToTradeManagerWindows(channel, data) {
    for (let tradeWindow of tradeManagerWindows) {
        if (tradeWindow && !tradeWindow.isDestroyed()) {
            try {
                tradeWindow.webContents.send(channel, data);
            } catch (error) {
                console.error(`Error broadcasting ${channel} to trade manager window:`, error);
            }
        }
    }
}

// Set up IPC for data sharing between windows
ipcMain.on('get-main-window-data', (event) => {
    console.log('Received get-main-window-data request');
    // Send current data to requesting window only if main window exists
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('request-data-for-trade-manager');
    }
});

// Setup additional IPC handlers for communication between windows
ipcMain.on('main-window-data', (event, data) => {
    console.log('Main process received main-window-data:', data);
    // Forward data to all trade manager windows
    for (let tradeWindow of tradeManagerWindows) {
        if (tradeWindow && !tradeWindow.isDestroyed()) {
            try {
                console.log('Forwarding data to trade manager window');
                tradeWindow.webContents.send('main-window-data', data);
            } catch (error) {
                console.error('Error forwarding data to trade manager window:', error);
            }
        }
    }
});

ipcMain.on('price-update', (event, price) => {
    // Forward price updates to all trade windows
    for (let tradeWindow of tradeWindows) {
        if (tradeWindow && !tradeWindow.isDestroyed()) {
            try {
                tradeWindow.webContents.send('price-update', price);
            } catch (error) {
                console.error('Error forwarding price update to trade window:', error);
            }
        }
    }
});

ipcMain.on('execute-trade', (event, tradeData) => {
    // Forward trade execution request to main window
    if (mainWindow && !mainWindow.isDestroyed()) {
        try {
            mainWindow.webContents.send('execute-trade', tradeData);
        } catch (error) {
            console.error('Error forwarding trade execution to main window:', error);
        }
    }
});

// Setup IPC handlers for NinjaTrader Bridge communication via Trade Manager
ipcMain.on('nt-bridge-connect-request', (event) => {
    // This is now directly handled in the TradeManager component
    // Just send the current known status
    event.sender.send('nt-bridge-connected', isConnectedToNTBridge);
});

ipcMain.on('nt-bridge-disconnect-request', (event) => {
    // This is now directly handled in the TradeManager component
    // Just send the current known status 
    event.sender.send('nt-bridge-connected', isConnectedToNTBridge);
});

ipcMain.on('nt-bridge-send-request', (event, message) => {
    console.log('Main process received nt-bridge-send-request:', message.type);
    
    // Forward the message to Trade Manager
    if (tradeManagerWindows.length > 0) {
        const tradeManager = tradeManagerWindows[0]; // Use the first Trade Manager window
        
        if (tradeManager && !tradeManager.isDestroyed()) {
            try {
                // Create a custom event with reply channel info
                const requestId = `request_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                
                // Set up a one-time listener for the response
                ipcMain.once(`nt-bridge-send-response-${requestId}`, (_, response) => {
                    // Forward the response back to the original sender
                    event.sender.send('nt-bridge-send-response', response);
                });
                
                // Forward the request to Trade Manager with the request ID
                tradeManager.webContents.send('nt-bridge-send-request', {
                    requestId,
                    message
                });
            } catch (error) {
                console.error('Error forwarding message to Trade Manager:', error);
                event.sender.send('nt-bridge-send-response', {
                    success: false,
                    error: 'Failed to communicate with Trade Manager',
                    originalMessage: message
                });
            }
        } else {
            console.error('Trade Manager window is not available');
            event.sender.send('nt-bridge-send-response', {
                success: false,
                error: 'Trade Manager window is not available',
                originalMessage: message
            });
        }
    } else {
        console.error('No Trade Manager window found. Please open Trade Manager first.');
        event.sender.send('nt-bridge-send-response', {
            success: false,
            error: 'No Trade Manager window found. Please open Trade Manager first.',
            originalMessage: message
        });
    }
});

// Handle NinjaTrader Bridge status broadcasts from Trade Manager
ipcMain.on('nt-bridge-status-broadcast', (event, connected) => {
    console.log(`Received NT Bridge status broadcast: ${connected}`);
    
    // Update global connection status
    isConnectedToNTBridge = connected;
    
    // Broadcast to all windows except the sender
    broadcastToAllTradeWindows('nt-bridge-connected', connected);
});

// Handle NinjaTrader Bridge message broadcasts from Trade Manager
ipcMain.on('nt-bridge-message-broadcast', (event, message) => {
    console.log(`Received NT Bridge message broadcast: ${message.type}`);
    
    // Broadcast to all trade manager windows except the sender
    for (let tmw of tradeManagerWindows) {
        if (tmw && !tmw.isDestroyed() && tmw.webContents.id !== event.sender.id) {
            try {
                tmw.webContents.send('nt-bridge-message', message);
            } catch (error) {
                console.error('Error forwarding message to Trade Manager window:', error);
            }
        }
    }
    
    // Also broadcast to trade windows if necessary
    for (let tw of tradeWindows) {
        if (tw && !tw.isDestroyed()) {
            try {
                tw.webContents.send('nt-bridge-message', message);
            } catch (error) {
                console.error('Error forwarding message to Trade window:', error);
            }
        }
    }
});

// Handle status requests from any window
ipcMain.on('nt-bridge-status-request', (event) => {
    event.sender.send('nt-bridge-connected', isConnectedToNTBridge);
});

// Handler for window ID requests
ipcMain.on('get-window-id', (event) => {
    const webContentsId = event.sender.id;
    if (!windowIds.has(webContentsId)) {
        windowIds.set(webContentsId, `window-${windowIds.size + 1}`);
    }
    const windowId = windowIds.get(webContentsId);
    event.returnValue = windowId;
});

// Listen for current market data from main window and update the DataService
ipcMain.on('current-market-data', (event, data) => {
    // Store the current market data
    currentMarketData = data;
    
    // Update the data service with the market data
    dataService.updateMarketData({
        currentSymbol: data.symbol,
        latestPrice: data.price
    });
    
    // Maintain the existing broadcast for compatibility
    broadcastToAllTradeWindows('market-data-update', data);
});

// Request for current market data from Trade Manager
ipcMain.on('request-current-market-data', (event) => {
    // Get latest data from the data service
    const marketData = dataService.marketData;
    
    // If we have data in the data service, use it
    if (marketData.currentSymbol && marketData.latestPrice) {
        // Send in the expected format for backward compatibility
        event.sender.send('market-data-update', {
            symbol: marketData.currentSymbol,
            price: marketData.latestPrice
        });
    } 
    // Otherwise fall back to the existing mechanism
    else if (currentMarketData.symbol && currentMarketData.price) {
        event.sender.send('market-data-update', currentMarketData);
    }
});

// Handle market data updates and synchronize with the DataService
ipcMain.on('market-data-update', (event, data) => {
    // Update our cached market data
    currentMarketData = { ...data };
    
    // Also update the data service
    dataService.updateMarketData({
        currentSymbol: data.symbol,
        latestPrice: data.price
    });
    
    // Keep existing broadcast for backward compatibility
    broadcastToAllTradeWindows('market-data-update', data);
});

// Add IPC handler for resizing the trade window when Chart Trader or Smart Stop is toggled
ipcMain.on('resize-trade-window', (event, expandedView) => {
    console.log(`Main Process: Resize trade window request - Expanded View: ${expandedView}`);
    
    // Find the trade window that sent this message
    const sender = event.sender;
    const tradeWindow = BrowserWindow.fromWebContents(sender);
    
    if (tradeWindow && !tradeWindow.isDestroyed()) {
        // Get current position before resize
        const position = tradeWindow.getPosition();
        
        // Resize the window based on the expanded view state
        const width = expandedView ? 1000 : 500; // Double width when expanded
        const [, height] = tradeWindow.getSize(); // Keep current height
        
        console.log(`Main Process: Resizing trade window to ${width}x${height}`);
        tradeWindow.setSize(width, height);
        
        // Make sure it's resizable when expanded
        tradeWindow.setResizable(expandedView);
        
        // Don't center the window, use its current position
        // tradeWindow.center();
    }
});

// Add IPC handler for opening trade window from TradeManager
ipcMain.on('open-trade-window', () => {
    console.log('Main Process: Received request to open trade window.');
    // Check if a Trade Window already exists
    const existingTradeWindow = tradeWindows.find(win => win && !win.isDestroyed());

    if (existingTradeWindow) {
        console.log('Main Process: Trade Window already open. Focusing existing window.');
        // If it exists, focus it
        if (existingTradeWindow.isMinimized()) existingTradeWindow.restore();
        existingTradeWindow.focus();
        // Optional: Flash frame to draw attention
        existingTradeWindow.flashFrame(true);
    } else {
        console.log('Main Process: No Trade Window open. Creating a new one.');
        // If not, create a new one
        createTradeWindow();
    }
});

// Function to broadcast to all trade windows (including trade manager and trade window)
function broadcastToAllTradeWindows(channel, data) {
    // Broadcast to trade manager windows
    for (let window of tradeManagerWindows) {
        if (window && !window.isDestroyed()) {
            try {
                window.webContents.send(channel, data);
            } catch (error) {
                console.error(`Error broadcasting to trade manager window: ${error.message}`);
            }
        }
    }
    
    // Broadcast to trade windows
    for (let window of tradeWindows) {
        if (window && !window.isDestroyed()) {
            try {
                window.webContents.send(channel, data);
            } catch (error) {
                console.error(`Error broadcasting to trade window: ${error.message}`);
            }
        }
    }
}

// Listener for Trade Manager to close all Trade Windows
ipcMain.on('close-all-trade-windows', () => {
    console.log('Main Process: Received request to close all trade windows.');
    // Iterate over a copy of the array to avoid issues while modifying it
    [...tradeWindows].forEach(win => {
      if (win && !win.isDestroyed()) {
        console.log(`Main Process: Closing Trade Window ID: ${win.id}`);
        win.close();
      }
    });
    // The 'closed' event handler in createTradeWindow should clear the original array
});

// Add IPC handler for initiating chart click order from Trade Window
ipcMain.on('initiate-chart-click-order', (event, orderData) => {
    console.log('Main Process: Received initiate-chart-click-order request:', orderData);
    console.log('Main Process: Action:', orderData.action, '| Symbol:', orderData.symbol, 
                '| Quantity:', orderData.quantity, '| Account:', orderData.accountId,
                '| OrderType:', orderData.orderType || 'LIMIT');
    
    // Relay this to the main window to display the overlay and handle chart clicks
    if (mainWindow && !mainWindow.isDestroyed()) {
        try {
            mainWindow.webContents.send('display-chart-click-overlay', orderData);
            console.log('Main Process: Forwarded display-chart-click-overlay to main window');
        } catch (error) {
            console.error('Error forwarding chart click order to main window:', error);
            // Send error back to trade window if it still exists
            if (!event.sender.isDestroyed()) {
                event.sender.send('chart-click-order-error', {
                    message: 'Failed to communicate with main charting window'
                });
            }
        }
    } else {
        console.error('Main window not available for chart click order');
        // Send error back to trade window if it still exists
        if (!event.sender.isDestroyed()) {
            event.sender.send('chart-click-order-error', {
                message: 'Main charting window not available'
            });
        }
    }
});

// Add IPC handler for chart click order cancel from main window
ipcMain.on('cancel-chart-click-order', (event) => {
    console.log('Main Process: Chart click order was canceled');
    
    // Notify all trade windows that the order was canceled
    for (let tradeWindow of tradeWindows) {
        if (tradeWindow && !tradeWindow.isDestroyed()) {
            try {
                tradeWindow.webContents.send('chart-click-order-canceled');
            } catch (error) {
                console.error('Error notifying trade window of order cancelation:', error);
            }
        }
    }
});

// Add IPC handler for chart click order completion from main window
ipcMain.on('chart-click-order-completed', (event, orderData) => {
    console.log('Main Process: Chart click order was completed - FULL DATA:', orderData);
    
    // Create a proper order format for NinjaTrader
    const ntOrder = {
        type: 'place_order',
        action: orderData.action,
        orderType: orderData.orderType || 'LIMIT', // Default to LIMIT if not specified
        symbol: orderData.symbol,
        quantity: orderData.quantity,
        accountId: orderData.accountId,
        timestamp: Date.now()
    };
    
    // Add price based on orderType
    if (orderData.orderType === 'MARKETSTOP' || orderData.orderType === 'LIMITSTOP') {
        console.log(`Main Process: Setting stopPrice=${orderData.price} for ${orderData.orderType} order`);
        ntOrder.stopPrice = orderData.price;
        
        // For StopLimit orders, also set the limit price to match
        if (orderData.orderType === 'LIMITSTOP') {
            ntOrder.limitPrice = orderData.price;
        }
    } else {
        // For regular LIMIT orders
        console.log(`Main Process: Setting limitPrice=${orderData.price} for ${orderData.orderType || 'LIMIT'} order`);
        ntOrder.limitPrice = orderData.price;
    }
    
    // Extra debug for MARKETSTOP orders
    if (orderData.orderType === 'MARKETSTOP') {
        console.log(`Main Process: Market Stop order details: stopPrice=${ntOrder.stopPrice}, price=${orderData.price}`);
        console.log('Main Process: Full NT Order to send:', JSON.stringify(ntOrder, null, 2));
    }
    
    console.log('Main Process: Formatted order for NT Bridge:', ntOrder);
    
    // Send the order to Trade Manager to execute using the centralized connection
    if (tradeManagerWindows.length > 0) {
        const tradeManager = tradeManagerWindows[0]; // Use the first Trade Manager window
        
        if (tradeManager && !tradeManager.isDestroyed()) {
            try {
                tradeManager.webContents.send('nt-bridge-send-request', {
                    message: ntOrder
                });
                console.log('Main Process: Forwarded chart click order to Trade Manager for execution');
            } catch (error) {
                console.error('Error sending chart click order to Trade Manager:', error);
            }
        } else {
            console.error('No active Trade Manager window to send chart click order');
        }
    } else {
        console.error('No Trade Manager windows open to send chart click order');
    }
    
    // Notify all trade windows that the order was completed
    for (let tradeWindow of tradeWindows) {
        if (tradeWindow && !tradeWindow.isDestroyed()) {
            try {
                tradeWindow.webContents.send('chart-click-order-completed', orderData);
            } catch (error) {
                console.error('Error notifying trade window of order completion:', error);
            }
        }
    }
});

// Add IPC handler for Smart Stop settings changes
ipcMain.on('smart-stop-settings-changed', (event, settings) => {
  console.log('Main Process: Received Smart Stop settings change:', settings);
  
  // Broadcast to all trade manager windows
  for (let tmw of tradeManagerWindows) {
    if (tmw && !tmw.isDestroyed() && tmw.webContents.id !== event.sender.id) {
      try {
        tmw.webContents.send('smart-stop-settings-changed', settings);
      } catch (error) {
        console.error('Error forwarding Smart Stop settings to Trade Manager window:', error);
      }
    }
  }
  
  // Also broadcast to trade windows if needed
  for (let tw of tradeWindows) {
    if (tw && !tw.isDestroyed() && tw.webContents.id !== event.sender.id) {
      try {
        tw.webContents.send('smart-stop-settings-changed', settings);
      } catch (error) {
        console.error('Error forwarding Smart Stop settings to Trade window:', error);
      }
    }
  }
  
  // Update data service with the settings
  dataService.updateSmartStopSettings(settings);
});

// Add IPC handler for subscribing to candle data
ipcMain.on('subscribe-to-candle-data', (event, data) => {
  const { timeframe } = data;
  const senderWindowId = event.sender.id;
  
  console.log(`Main Process: Window ${senderWindowId} subscribed to ${timeframe} candle data`);
  
  // Create a new subscription set if needed
  if (!candleSubscriptions.has(timeframe)) {
    candleSubscriptions.set(timeframe, new Set());
  }
  
  // Add this window to the subscribers
  candleSubscriptions.get(timeframe).add(senderWindowId);
  
  console.log(`Main Process: Now have ${candleSubscriptions.get(timeframe).size} subscribers for ${timeframe} candles`);
});

// Add IPC handler for candle closure events from main window
ipcMain.on('candle-closed', (event, data) => {
  console.log(`Main Process: Received candle-closed event for ${data.timeframe} timeframe, symbol ${data.symbol}`);
  
  // Ensure data has the necessary properties
  if (!data || !data.timeframe || !data.symbol || 
      data.open === undefined || data.high === undefined || 
      data.low === undefined || data.close === undefined || 
      data.timestamp === undefined) {
    console.error('Main Process: Invalid candle data received', data);
    return;
  }
  
  // Get subscribers for this timeframe
  const subscribers = candleSubscriptions.get(data.timeframe);
  
  // If no subscribers, skip broadcasting
  if (!subscribers || subscribers.size === 0) {
    console.log(`Main Process: No subscribers for ${data.timeframe} candle data`);
    return;
  }
  
  // Store the candle data in the data service
  dataService.addCandles(data.symbol, data.timeframe, {
    timestamp: data.timestamp,
    open: data.open,
    high: data.high,
    low: data.low,
    close: data.close,
    volume: data.volume || 0
  });
  
  // Broadcast the event to all subscribers
  console.log(`Main Process: Broadcasting candle-closed event to ${subscribers.size} subscribers`);
  for (const windowId of subscribers) {
    // Find the window with this ID
    const window = BrowserWindow.getAllWindows().find(win => win.webContents.id === windowId);
    
    if (window && !window.isDestroyed()) {
      try {
        window.webContents.send('candle-closed', data);
        console.log(`Main Process: Sent candle-closed event to window ${windowId}`);
      } catch (error) {
        console.error(`Main Process: Error sending candle-closed event to window ${windowId}:`, error);
        // Remove this window from subscribers
        subscribers.delete(windowId);
      }
    } else {
      // Remove this window from subscribers if it no longer exists
      console.log(`Main Process: Window ${windowId} no longer exists, removing from subscribers`);
      subscribers.delete(windowId);
    }
  }
});

// --- IPC Handlers for Chart Order Modification ---
ipcMain.on('start-chart-order-modification', (event) => {
  console.log('Main Process: Received start-chart-order-modification request');
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('show-modify-order-overlay');
      console.log('Main Process: Forwarded show-modify-order-overlay to main window');
    } catch (error) {
      console.error('Error forwarding show-modify-order-overlay to main window:', error);
    }
  } else {
    console.error('Main window not available for start-chart-order-modification');
  }
  // Broadcast to TradeManager windows as well
  broadcastToTradeManagerWindows('show-modify-order-overlay');
  console.log('Main Process: Broadcasted show-modify-order-overlay to TradeManager windows');
});

ipcMain.on('stop-chart-order-modification', (event) => {
  console.log('Main Process: Received stop-chart-order-modification request');
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('hide-modify-order-overlay');
      console.log('Main Process: Forwarded hide-modify-order-overlay to main window');
    } catch (error) {
      console.error('Error forwarding hide-modify-order-overlay to main window:', error);
    }
  } else {
    console.error('Main window not available for stop-chart-order-modification');
  }
  // Broadcast to TradeManager windows as well
  broadcastToTradeManagerWindows('hide-modify-order-overlay');
  console.log('Main Process: Broadcasted hide-modify-order-overlay to TradeManager windows');
});

// Add IPC handler for order annotation drag events
ipcMain.on('order-annotation-drag-ended', (event, dragData) => {
  console.log('Main Process: Received order-annotation-drag-ended from main window:', dragData);
  
  // Forward the drag event to all TradeManager windows
  broadcastToTradeManagerWindows('order-annotation-drag-ended', dragData);
  console.log('Main Process: Broadcasted order-annotation-drag-ended to TradeManager windows');
});

// Add IPC handler for order annotation drag start events
ipcMain.on('order-annotation-drag-started', (event) => {
  console.log('Main Process: Received order-annotation-drag-started from main window');
  
  // Forward the drag start event to all TradeManager windows
  broadcastToTradeManagerWindows('order-annotation-drag-started');
  console.log('Main Process: Broadcasted order-annotation-drag-started to TradeManager windows');
});

// Add IPC handler for order annotation drag end complete events
ipcMain.on('order-annotation-drag-ended-complete', (event) => {
  console.log('Main Process: Received order-annotation-drag-ended-complete from main window');
  
  // Forward the drag end complete event to all TradeManager windows
  broadcastToTradeManagerWindows('order-annotation-drag-ended-complete');
  console.log('Main Process: Broadcasted order-annotation-drag-ended-complete to TradeManager windows');
});

ipcMain.on('chart-modify-overlay-done-clicked', (event) => {
  console.log('Main Process: Received chart-modify-overlay-done-clicked request');
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('hide-modify-order-overlay');
      console.log('Main Process: Forwarded hide-modify-order-overlay to main window');
    } catch (error) {
      console.error('Error forwarding hide-modify-order-overlay to main window:', error);
    }
  } else {
    console.error('Main window not available for chart-modify-overlay-done-clicked (hide overlay part)');
  }
  // Also, reset the button in TradeWindow
  broadcastToAllTradeWindows('reset-modify-order-mode');
  console.log('Main Process: Broadcasted reset-modify-order-mode to trade windows');
  // Broadcast to TradeManager windows as well to hide their internal mode state
  broadcastToTradeManagerWindows('hide-modify-order-overlay');
  console.log('Main Process: Broadcasted hide-modify-order-overlay to TradeManager windows');
});

// --- End IPC Handlers for Chart Order Modification ---

// --- IPC Handler for Switch Instrument ---
ipcMain.on('switch-instrument', (event, newInstrument) => {
    console.log('Main Process: Received switch-instrument request:', newInstrument);
    
    // Ensure we have a valid string
    const instrumentString = String(newInstrument);
    console.log('Main Process: Forwarding instrument switch to main window:', instrumentString);
    
    // Forward to main window
    if (mainWindow && !mainWindow.isDestroyed()) {
        try {
            mainWindow.webContents.send('switch-instrument', instrumentString);
            console.log('Main Process: Successfully forwarded switch-instrument to main window');
        } catch (error) {
            console.error('Main Process: Error forwarding switch-instrument to main window:', error);
        }
    } else {
        console.error('Main Process: Main window not available for switch-instrument');
    }
});
// --- End IPC Handler for Switch Instrument ---

// --- IPC Handlers for Candle Forwarding ---
ipcMain.on('candle-data-started', () => {
    console.log('Candle Forwarding Server: Data flow started');
    isDataFlowing = true;
});

ipcMain.on('candle-data-reset', () => {
    console.log('Candle Forwarding Server: Resetting state');
    isDataFlowing = false; // Explicitly reset the data flow flag
    resetCandleForwarding();
});

ipcMain.on('candle-data-forward', (event, candleMessage) => {
    // Forward the candle data to connected external clients
    forwardCandleData(candleMessage);
});
// --- End IPC Handlers for Candle Forwarding ---

app.whenReady().then(() => {
    // Initialize the data service
    dataService.initialize(ipcMain);
    
    // Initialize the candle forwarding WebSocket server
    initializeCandleForwardingServer();
    
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Handle window-all-closed event
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle app before-quit event to clean up candle forwarding server
app.on('before-quit', () => {
    shutdownCandleForwardingServer();
});

// When a window is closed, unsubscribe it from data updates
app.on('browser-window-closed', (event, window) => {
    if (windowIds.has(window.webContents.id)) {
        const windowId = windowIds.get(window.webContents.id);
        dataService.unsubscribeWindow(windowId);
        windowIds.delete(window.webContents.id);
        
        // Clean up candle subscriptions
        const windowContentId = window.webContents.id;
        for (const [timeframe, subscribers] of candleSubscriptions.entries()) {
          if (subscribers.has(windowContentId)) {
            subscribers.delete(windowContentId);
            console.log(`Main Process: Removed window ${windowContentId} from ${timeframe} candle subscribers`);
          }
        }
    }
});