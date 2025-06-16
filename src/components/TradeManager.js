import React, { useState, useEffect, useRef, useCallback } from 'react';
import './TradeManager.css';
import { convertCmeToNinjaTrader, convertNinjaTraderToCme } from '../utils/symbolMapping';
import DataClient from '../services/data-client';
import initTradeAnnotations, { createOrderAnnotationConfig, createPositionAnnotationConfig } from '../services/trade-annotation-service';
import { 
  initNTBridgeConnectionManager, 
  connectToNTBridge, 
  disconnectFromNTBridge, 
  sendToNTBridge, 
  registerConnectionStateCallback, 
  registerMessageHandler, 
  getNTBridgeConnectionStatus 
} from '../services/nt-bridge-service';
import { PositionsTable, OrdersTable } from './OrderPositionTables';
import { PlatformSelection, AccountList, AccountOverview } from './trading/TradeManagerComponents';

function TradeManager() {
  // State for platform selection
  const [selectedPlatform, setSelectedPlatform] = useState('ninjatrader');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupContent, setPopupContent] = useState({ title: '', message: '' });
  
  // State for NinjaTrader
  const [ntAccounts, setNtAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountDetails, setAccountDetails] = useState(null);
  const [activeListTab, setActiveListTab] = useState('positions'); // New state for Positions/Orders tab
  const [orders, setOrders] = useState({}); // Store orders keyed by orderId
  
  // State for chart modification mode
  const [isChartModificationModeActive, setIsChartModificationModeActive] = useState(false);
  
  // State to track if an annotation is currently being dragged
  const [isDragInProgress, setIsDragInProgress] = useState(false);
  const isDragInProgressRef = useRef(false);
  
  console.log('TradeManager RENDER, isChartModificationModeActive:', isChartModificationModeActive); // <--- ADDED THIS
  
  // Reference to maintain connection to main window
  const websocketRef = useRef(null);
  
  // Refs to hold the latest state for use in WebSocket callbacks
  const selectedAccountRef = useRef(selectedAccount);
  const accountDetailsRef = useRef(null);
  const ordersRef = useRef({});
  const isConnectedRef = useRef(false);
  
  // Create DataClient instance
  const dataClientRef = useRef(null);
  
  // State for market data from the shared data service
  const [marketData, setMarketData] = useState({ 
    currentSymbol: null, 
    latestPrice: null,
    instrumentProperties: null // Add new state for instrument properties
  });
  
  // Add ref for orders
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);
  
  // Add ref for trade annotation service
  const tradeAnnotationServiceRef = useRef(null);
  const currentInstrumentRef = useRef(null);
  
  // Keep refs updated with the latest state
  useEffect(() => {
    selectedAccountRef.current = selectedAccount;
  }, [selectedAccount]);

  useEffect(() => {
    accountDetailsRef.current = accountDetails;
  }, [accountDetails]);
  
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);
  
  // Keep isDragInProgressRef in sync with state
  useEffect(() => {
    isDragInProgressRef.current = isDragInProgress;
  }, [isDragInProgress]);
  
  // Add debugging useEffect to track selectedAccount changes
  useEffect(() => {
    console.log('TradeManager: selectedAccount state changed to:', selectedAccount);
    console.log('TradeManager: selectedAccount type:', typeof selectedAccount);
    if (selectedAccount) {
      console.log('TradeManager: selectedAccount keys:', Object.keys(selectedAccount));
    }
  }, [selectedAccount]);

  // Add debugging useEffect to track isConnected changes
  useEffect(() => {
    console.log('TradeManager: isConnected state changed to:', isConnected);
  }, [isConnected]);
  
  // Setup IPC communication and NT Bridge Connection Manager
  useEffect(() => {
    try {
      // Set up communication with Electron
      console.log("Trade Manager: Setting up IPC communication");
      const { ipcRenderer } = window.require('electron');
      
      // Initialize the NinjaTrader Bridge Connection Manager
      initNTBridgeConnectionManager(ipcRenderer);
      
      // Register message handler for NinjaTrader Bridge messages
      const unregisterHandler = registerMessageHandler(handleNinjaTraderMessage);
      
      // Register for connection state changes
      const unregisterConnectionCallback = registerConnectionStateCallback((connected) => {
        console.log(`TradeManager: Connection state callback triggered: ${connected}`);
        console.log(`TradeManager: Previous isConnected state: ${isConnected}`);
        setIsConnected(connected);
        console.log(`TradeManager: Updated isConnected state to: ${connected}`);
        
        if (!connected) {
          // Clear connecting state, accounts, etc. when disconnected
          setIsConnecting(false);
          setIsChartModificationModeActive(false); // Ensure mode is reset on disconnect
          
          // If we get a disconnect but we still have selected platform, don't clear accounts
          // as this might be a temporary disconnection we're trying to recover from
          if (selectedPlatform) {
            console.log("TradeManager: Keeping platform selection during disconnection");
          } else {
            // Otherwise clear accounts and selection
            setNtAccounts([]);
            setSelectedAccount(null);
            setAccountDetails(null);
            setOrders({});
          }
        }
      });
      
      // Listen for NT Bridge connection status broadcasts
      ipcRenderer.on('nt-bridge-status-broadcast', (event, connected) => {
        console.log('NinjaTrader connection status from broadcast:', connected);
        
        // No need to update internal state here, should come via callback
      });
      
      // Broadcast initial connection status to other components
      ipcRenderer.send('nt-bridge-status-broadcast', getNTBridgeConnectionStatus());
      
      // Add IPC listeners for chart modification mode here
      ipcRenderer.on('show-modify-order-overlay', handleShowModifyOverlay);
      ipcRenderer.on('hide-modify-order-overlay', handleHideModifyOverlay);
      
      // Add IPC listener for order annotation drag events
      ipcRenderer.on('order-annotation-drag-ended', (event, dragData) => {
        console.log('TradeManager: Received order-annotation-drag-ended IPC message:', dragData);
        console.log('TradeManager: State at IPC receive time - selectedAccount:', selectedAccount);
        console.log('TradeManager: State at IPC receive time - isConnected:', isConnected);
        console.log('TradeManager: Ref at IPC receive time - selectedAccountRef.current:', selectedAccountRef.current);
        console.log('TradeManager: Ref at IPC receive time - isConnectedRef.current:', isConnectedRef.current);
        console.log('TradeManager: State at IPC receive time - selectedPlatform:', selectedPlatform);
        console.log('TradeManager: State at IPC receive time - ntAccounts length:', ntAccounts.length);
        
        if (dragData && dragData.orderId && typeof dragData.y1 === 'number') {
          handleOrderAnnotationDragEnded(dragData.orderId, { y1: dragData.y1 });
        } else {
          console.error('TradeManager: Invalid drag data received:', dragData);
        }
      });
      
      // Add IPC listener for drag start events to prevent annotation updates during drags
      ipcRenderer.on('order-annotation-drag-started', (event) => {
        console.log('TradeManager: Received order-annotation-drag-started IPC message');
        setIsDragInProgress(true);
        console.log('TradeManager: Set isDragInProgress to true');
      });
      
      // Add IPC listener for drag end complete events to resume annotation updates
      ipcRenderer.on('order-annotation-drag-ended-complete', (event) => {
        console.log('TradeManager: Received order-annotation-drag-ended-complete IPC message');
        setIsDragInProgress(false);
        console.log('TradeManager: Set isDragInProgress to false');
      });
      
      // Clean up function for component unmount
      return () => {
        console.log("Trade Manager: Cleaning up event listeners");
        
        // Properly remove all IPC listeners
        if (ipcRenderer) {
          // List of all events we need to clean up
          const events = [
            'nt-bridge-status-broadcast',
            'nt-bridge-message',
            'nt-bridge-send-request',
            'main-window-data',
            'nt-bridge-send-response',
            // Add new listeners for chart modification mode
            // 'show-modify-order-overlay', // These are handled by explicit removal below
            // 'hide-modify-order-overlay'  // These are handled by explicit removal below
          ];
          
          // Remove all listeners for each event
          events.forEach(event => {
            console.log(`TradeManager: Removing all listeners for ${event}`);
            ipcRenderer.removeAllListeners(event);
          });
        }
        
        // Unregister message handler
        unregisterHandler();
        
        // Unregister connection state callback
        unregisterConnectionCallback();

        // Explicitly remove the chart modification listeners using the stable handler references
        ipcRenderer.removeListener('show-modify-order-overlay', handleShowModifyOverlay);
        ipcRenderer.removeListener('hide-modify-order-overlay', handleHideModifyOverlay);
        ipcRenderer.removeAllListeners('order-annotation-drag-ended');
        ipcRenderer.removeAllListeners('order-annotation-drag-started');
        ipcRenderer.removeAllListeners('order-annotation-drag-ended-complete');
        console.log("TradeManager: Removed chart modification mode IPC listeners.");
      };
    } catch (error) {
      console.error("Trade Manager: Error setting up IPC:", error);
    }
  }, [selectedPlatform]); // Removed handleShowModifyOverlay, handleHideModifyOverlay from dependency array
  
  // Initialize DataClient and subscribe to market data
  useEffect(() => {
    // Create DataClient instance if not already created
    if (!dataClientRef.current) {
      dataClientRef.current = new DataClient();
      
      // Subscribe to market data updates
      dataClientRef.current.subscribeToMarketData((data) => {
        if (data) {
          console.log('TradeManager: Received market data update from shared service:', data);
          
          // Update local state
          setMarketData({
            currentSymbol: data.currentSymbol,
            latestPrice: data.latestPrice,
            instrumentProperties: data.instrumentProperties || null // Handle properties if available
          });

          // If symbol changed and we have an active connection, request instrument properties
          if (data.currentSymbol && isConnected) {
            const ntSymbol = convertCmeToNinjaTrader(data.currentSymbol);
            sendToNTBridge({ 
              type: 'getInstrumentProperties',
              symbol: ntSymbol
            });
          }
        }
      });
      
      // Fetch initial market data
      dataClientRef.current.getMarketData().then(data => {
        if (data) {
          console.log('TradeManager: Fetched initial market data from shared service:', data);
          
          // Update local state
          setMarketData({
            currentSymbol: data.currentSymbol,
            latestPrice: data.latestPrice,
            instrumentProperties: data.instrumentProperties || null // Handle properties if available
          });

          // Request instrument properties for the initial symbol
          if (data.currentSymbol && isConnected) {
            const ntSymbol = convertCmeToNinjaTrader(data.currentSymbol);
            sendToNTBridge({ 
              type: 'getInstrumentProperties',
              symbol: ntSymbol
            });
          }
        }
      }).catch(error => {
        console.error('Error fetching initial market data:', error);
      });
    }
    
    // Initialize Trade Annotation Service
    tradeAnnotationServiceRef.current = initTradeAnnotations(dataClientRef.current);
    
    // Cleanup function
    return () => {
      // No need to explicitly clean up DataClient subscriptions here if DataClient handles its own lifecycle
      // or if its subscriptions are managed by its own internal mechanisms.
      // If DataClient.subscribeToMarketData returns an unsubscribe function, it should be called here.
      // For now, assuming DataClient manages this.
      console.log("TradeManager: DataClient useEffect cleanup (if any specific cleanup needed).");
    };
  }, [isConnected]); // Dependency array only has isConnected.
  
  // Add this useEffect to update the DataClient whenever the selected account changes
  useEffect(() => {
    if (dataClientRef.current && selectedAccount) {
      console.log('TradeManager: Pushing selected account info to Shared Data Service:', selectedAccount);
      
      // Push account info to the shared data service
      dataClientRef.current.push('account:info', {
        id: selectedAccount.id || selectedAccount.accountId,
        name: selectedAccount.name || 'Unknown Account',
        accountType: selectedAccount.accountType || 'Unknown'
      });

      // Update market data with account information
      dataClientRef.current.updateMarketData({
        accountId: selectedAccount.id || selectedAccount.accountId,
        accountName: selectedAccount.name || 'Unknown Account',
        accountType: selectedAccount.accountType || 'Unknown'
      });
    }
  }, [selectedAccount]);
  
  // Add state for position timestamps
  const [positionTimestamps, setPositionTimestamps] = useState({});
  const positionTimestampsRef = useRef({});
  
  // Keep the ref in sync with state
  useEffect(() => {
    positionTimestampsRef.current = positionTimestamps;
  }, [positionTimestamps]);

  // Add useEffect to keep track of positions and their timestamps
  useEffect(() => {
    if (accountDetails && accountDetails.positions) {
      // Update position timestamps
      setPositionTimestamps(prevTimestamps => {
        const newTimestamps = { ...prevTimestamps };
        const currentTime = Date.now();
        
        // Track positions by their instrument ID
        accountDetails.positions.forEach(position => {
          const positionId = position.positionId || position.instrument;
          const key = `${accountDetails.accountId}_${positionId}`;
          
          // If position exists, check if quantity or avgPrice has changed
          if (prevTimestamps[key] && prevTimestamps[key].position) {
            const prevPosition = prevTimestamps[key].position;
            // Make sure prevPosition is defined and has the properties we need
            if (prevPosition) {
              const hasChanged = 
                position.quantity !== prevPosition.quantity || 
                position.averagePrice !== prevPosition.averagePrice ||
                position.marketPosition !== prevPosition.marketPosition;
              
              if (hasChanged) {
                // Position details changed, update timestamp
                newTimestamps[key] = {
                  timestamp: currentTime,
                  position: { ...position }
                };
                console.log(`Position ${positionId} changed, updating timestamp to current time`);
              }
            } else {
              // Previous position exists but is invalid, create a new timestamp
              newTimestamps[key] = {
                timestamp: currentTime,
                position: { ...position }
              };
              console.log(`Position ${positionId} had invalid previous data, creating new timestamp`);
            }
          } else {
            // New position, create timestamp
            newTimestamps[key] = {
              timestamp: currentTime,
              position: { ...position }
            };
            console.log(`New position ${positionId} detected, setting initial timestamp`);
          }
        });
        
        return newTimestamps;
      });
    }
  }, [accountDetails]);

  // Update the trade annotations useEffect to use position timestamps
  useEffect(() => {
    console.log('TradeManager ANNOTATION useEffect RUNNING. Mode:', isChartModificationModeActive, 'Selected Acc:', selectedAccount, 'Symbol:', marketData.currentSymbol, 'Service:', !!tradeAnnotationServiceRef.current); // <--- ADDED THIS
    
    // Skip annotation updates if a drag operation is currently in progress
    // This prevents annotations from being recreated while the user is dragging them
    if (isDragInProgressRef.current) {
      console.log('TradeManager: Skipping annotation update - drag operation in progress');
      return;
    }
    
    // Skip if no service, orders, or account
    if (!tradeAnnotationServiceRef.current || !selectedAccount || !marketData.currentSymbol) {
      // If mode is active but we can't draw, ensure it's turned off to prevent inconsistent state
      if (isChartModificationModeActive) {
        console.warn("TradeManager: Conditions not met for annotations, but chart modification mode was active. Deactivating.");
        setIsChartModificationModeActive(false); 
      }
      return;
    }

    // Update current instrument reference
    currentInstrumentRef.current = marketData.currentSymbol;
    
    // Debug log all orders in the current store
    console.log('Orders in store:', Object.values(ordersRef.current).map(order => ({
      orderId: order.orderId,
      type: order.type,
      action: order.action,
      state: order.state,
      instrument: order.instrument,
      stopPrice: order.stopPrice,
      limitPrice: order.limitPrice
    })));
    
    // Debug STOP orders specifically
    const stopOrders = Object.values(ordersRef.current).filter(
      order => order.type && order.type.toLowerCase().includes('stop')
    );
    console.log('STOP orders found:', stopOrders.length, stopOrders);
    
    // Get active orders for the selected account
    const activeOrders = Object.values(ordersRef.current).filter(order => 
      // Order must be for the selected account
      (order.accountId === selectedAccount?.id || order.accountId === selectedAccount?.accountId) &&
      // Order must be active (not filled or cancelled)
      (order.state === 'Working' || order.state === 'Accepted' || 
       order.state === 'PendingSubmit' || order.state === 'Submitted') &&
      // Order instrument must match the currently viewed instrument
      convertNinjaTraderToCme(order.instrument) === marketData.currentSymbol
    );

    console.log(`TradeManager: Found ${activeOrders.length} active orders for instrument ${marketData.currentSymbol}`);
    console.log('Active orders after filtering:', activeOrders);

    // Get active positions for the selected account
    let activePositions = [];
    if (accountDetails && accountDetails.positions) {
      activePositions = accountDetails.positions.filter(position => 
        // Position must be active (quantity > 0)
        position.quantity > 0 &&
        // Position instrument must match the currently viewed instrument
        position.cmeSymbol === marketData.currentSymbol
      );
      console.log(`TradeManager: Found ${activePositions.length} active positions for instrument ${marketData.currentSymbol}`);
      console.log('Active positions after filtering:', activePositions);
    }

    // Get latest candle timestamp to use for annotations
    const fetchLatestCandleAndUpdateAnnotations = async () => {
      try {
        // Try to get the 1m candles for the current instrument
        const candles = await dataClientRef.current.getCandles(marketData.currentSymbol, '1m', { limit: 1 });
        if (candles && candles.length > 0) {
          const currentTimestamp = candles[0].timestamp;
          
          // Create annotation configs for each active order
          const orderAnnotations = activeOrders
            .map(order => {
              const config = createOrderAnnotationConfig(
                order, 
                selectedAccount.name || selectedAccount.id,
                currentTimestamp,
                isChartModificationModeActive, // Pass the mode state
                isChartModificationModeActive ? (args) => handleOrderAnnotationDragEnded(order.orderId, args) : undefined // Pass handler if in mode
              );
              console.log(`Annotation config for order ${order.orderId}:`, config);
              return config;
            })
            .filter(Boolean); // Filter out any null configs
          
          // Create annotation configs for each active position
          const positionAnnotations = activePositions
            .map(position => {
              const positionId = position.positionId || position.instrument;
              const key = `${selectedAccount.id || selectedAccount.accountId}_${positionId}`;
              
              // Every time we fetch the latest candle, we want to update the position timestamp
              // This ensures the position annotation moves with each candle close to stay ahead
              // of the "live" candle and not obscure it

              // Determine timeframe for this position if available
              // This helps calculate where to place the annotation (one interval ahead)
              // Default to 1m if not specified
              let currentPositionTimeframe = position.timeframe || '1m';
              
              // Store the current timestamp for this position
              // This way the position annotation is updated each time the candle updates
              positionTimestampsRef.current[key] = {
                timestamp: currentTimestamp,
                timeframe: currentPositionTimeframe
              };
              
              const config = createPositionAnnotationConfig(
                position,
                selectedAccount.name || selectedAccount.id,
                currentTimestamp
              );
              console.log(`Annotation config for position ${position.instrument}:`, config);
              return config;
            })
            .filter(Boolean); // Filter out any null configs
          
          // Combine order and position annotations
          const allAnnotations = [...orderAnnotations, ...positionAnnotations];
          
          // Update the annotations
          tradeAnnotationServiceRef.current.updateTradeAnnotations(allAnnotations);
          console.log(`TradeManager: Updated ${allAnnotations.length} trade annotations (${orderAnnotations.length} orders, ${positionAnnotations.length} positions)`);
        }
      } catch (err) {
        console.error('Error fetching candle data for annotations:', err);
      }
    };

    fetchLatestCandleAndUpdateAnnotations();
    
    // Clean up annotations when unmounting/changing
    return () => {
      if (tradeAnnotationServiceRef.current && !isConnected) {
        tradeAnnotationServiceRef.current.updateTradeAnnotations([]);
        console.log('TradeManager: Cleared trade annotations on disconnect or component update');
      }
    };
  }, [orders, selectedAccount, marketData.currentSymbol, isConnected, accountDetails, positionTimestamps, isChartModificationModeActive]);
  
  // Handle platform change
  const handlePlatformChange = (e) => {
    const platform = e.target.value;
    console.log("Platform changed to:", platform);
    
    // If we're currently connected, disconnect first
    if (isConnected) {
      console.log("Currently connected, disconnecting before changing platform");
      disconnectFromNTBridge();
    }
    
    setSelectedPlatform(platform);
    setNtAccounts([]);
    setOrders({}); // Clear orders on platform change
    setSelectedAccount(null);
    setAccountDetails(null);
  };
  
  // Handle connect button click
  const handleConnect = () => {
    console.log("Connect button clicked, platform:", selectedPlatform);
    
    if (selectedPlatform === 'ninjatrader') {
      // Start connection process
      setIsConnecting(true);
      
      // Connect directly to the NinjaTrader Bridge
      try {
        console.log("Starting NT Bridge connection process");
        connectToNTBridge();
      } catch (error) {
        console.error('Error connecting to NinjaTrader Bridge:', error);
        setIsConnecting(false);
        setShowPopup(true);
        setPopupContent({
          title: 'Connection Error',
          message: 'Failed to connect to NinjaTrader Bridge. Please make sure the bridge is running.'
        });
      }
    } else if (selectedPlatform === 'demo') {
      // Handle demo account connection
      setIsConnected(true);
      
      // Create demo account
      const demoAccount = {
        id: 'demo-1',
        name: 'Quatrain Demo Account',
        accountType: 'Simulation'
      };
      
      setNtAccounts([demoAccount]);
    }
  };
  
  // Handle disconnect button click
  const handleDisconnect = () => {
    console.log("TradeManager: Disconnect requested.");
    
    // Call disconnect directly 
    disconnectFromNTBridge();
    
    // Send message to main process to close trade windows
    try {
      const { ipcRenderer } = window.require('electron');
      console.log("TradeManager: Sending request to close all trade windows.");
      ipcRenderer.send('close-all-trade-windows');
    } catch (error) {
      console.error("TradeManager: Error sending close-all-trade-windows IPC message:", error);
    }
    
    // Reset state regardless of platform
    setIsConnecting(false); // Ensure connecting state is also reset
    setNtAccounts([]);
    setSelectedAccount(null);
    setAccountDetails(null);
    setOrders({});
  };
  
  // Handle NinjaTrader messages
  const handleNinjaTraderMessage = (message) => {
    console.log("Handling message type:", message.type);
    
    if (!message || message.type === undefined) {
      console.error("Received message with undefined type:", message);
      // If we are in chart modification mode and receive an undefined message,
      // it might indicate an issue, so log a warning or consider resetting the mode.
      if (isChartModificationModeActive) {
        console.warn("TradeManager: Received undefined message while in chart modification mode.");
      }
      return;
    }
    
    switch (message.type) {
      case 'connectionStatus':
        setIsConnected(message.connected);
        setIsConnecting(false);
        
        if (!message.connected) {
          setNtAccounts([]);
          setSelectedAccount(null);
          setAccountDetails(null);
          setOrders({}); // Clear orders on close
        }
        break;
        
      case 'accountList':
        if (message.accounts) {
          // Map the simplified account structure consistently
          const accounts = message.accounts.map(a => ({
            id: a.id, // Expect 'id' from server
            name: a.name,
            accountId: a.accountId, // Expect 'accountId' from server
            accountType: a.accountType
          }));
          console.log("Received account list:", accounts);
          setNtAccounts(accounts);

          // Let's only clear selection if the list is truly empty, otherwise trust the selection.
          if (accounts.length === 0 && selectedAccount) {
            console.log("Account list received is empty, clearing selection.");
            setSelectedAccount(null);
            setAccountDetails(null);
          }
        }
        break;
        
      case 'accountDetails':
        if (message.account) {
          console.log("Received account details:", message.account);
          // Process symbols correctly before setting state
          const accountWithProcessedSymbols = {
            ...message.account,
            positions: message.account.positions?.map(pos => {
              const ninjaTraderSymbol = pos.instrument; // Assume incoming is NT format
              const cmeSymbol = convertNinjaTraderToCme(ninjaTraderSymbol);
              return {
                ...pos,
                instrument: ninjaTraderSymbol, // Keep original NT symbol here for consistency if needed elsewhere
                ninjaTraderSymbol: ninjaTraderSymbol,
                cmeSymbol: cmeSymbol
              };
            }) || []
          };
          setAccountDetails(accountWithProcessedSymbols);
          
          // Check for stop order quantity adjustments after account details update
          if (smartStopSettings.stopQtyFollowsPosition) {
            setTimeout(() => {
              checkAndAdjustStopOrderQuantities();
            }, 100);
          }
        }
        break;
        
      case 'accountsUpdate':
        if (message.accounts && message.accounts.length > 0) {
          const accounts = message.accounts.map(a => ({ 
            id: a.accountId, 
            name: a.name,
            accountId: a.accountId, 
            accountType: a.accountType,
            ...a 
          }));
          console.log("Received accounts update (bulk):", accounts.length, "accounts");
          setNtAccounts(accounts);
          
          if (selectedAccount) {
            const updatedAccount = message.accounts.find(a => a.accountId === selectedAccount.id);
            if (updatedAccount) {
              console.log("Updating selected account details from bulk update:", updatedAccount);
              setAccountDetails(updatedAccount);
            }
          }
        }
        break;
        
      case 'accountDetailsUpdate':
        if (message.account) {
          const updatedAccountData = message.account;
          console.log("Received real-time account update:", updatedAccountData);

          // Process symbols correctly in the update data
          const updatedAccountWithProcessedSymbols = {
            ...updatedAccountData,
            positions: updatedAccountData.positions?.map(pos => {
              const ninjaTraderSymbol = pos.instrument; // Assume incoming is NT format
              const cmeSymbol = convertNinjaTraderToCme(ninjaTraderSymbol);
              return {
                ...pos,
                instrument: ninjaTraderSymbol, // Keep original NT symbol here
                ninjaTraderSymbol: ninjaTraderSymbol,
                cmeSymbol: cmeSymbol
              };
            }) || []
          };

          // Update the main account list
          setNtAccounts(prevAccounts => {
            const accountExists = prevAccounts.some(acc => acc.id === updatedAccountWithProcessedSymbols.accountId);
            if (accountExists) {
              // Update existing account in the list
              return prevAccounts.map(acc => 
                acc.id === updatedAccountWithProcessedSymbols.accountId 
                  ? { ...acc, ...updatedAccountWithProcessedSymbols, id: updatedAccountWithProcessedSymbols.accountId } 
                  : acc
              );
            } else {
              // Add new account if not found
              return [...prevAccounts, { ...updatedAccountWithProcessedSymbols, id: updatedAccountWithProcessedSymbols.accountId }];
            }
          });

          // Update the detailed view if this account is currently selected/displayed
          const currentAccountDetails = accountDetailsRef.current;
          if (currentAccountDetails && currentAccountDetails.accountId === updatedAccountWithProcessedSymbols.accountId) {
            console.log("Updating displayed account view state with processed symbols:", updatedAccountWithProcessedSymbols);
            setAccountDetails(updatedAccountWithProcessedSymbols); // Update state with processed data
            
            // Check for stop order quantity adjustments after account details update
            if (smartStopSettings.stopQtyFollowsPosition) {
              setTimeout(() => {
                checkAndAdjustStopOrderQuantities();
              }, 100);
            }
          } else {
            // Log if the update is for a non-selected or non-displayed account
            if (currentAccountDetails) {
              console.log(`Received update for ${updatedAccountWithProcessedSymbols.accountId}, but different account ${currentAccountDetails.accountId} is displayed.`);
            } else {
              console.log(`Received update for ${updatedAccountWithProcessedSymbols.accountId}, but no account details currently displayed.`);
            }
          }
        }
        break;
        
      case 'error':
        // Show error popup
        setPopupContent({
          title: 'Error',
          message: message.message || 'An unknown error occurred'
        });
        setShowPopup(true);
        break;
        
      case 'instrumentProperties':
        if (message.properties) {
          console.log("Received instrument properties:", message.properties);
          // Update market data with instrument properties
          setMarketData(prevData => ({
            ...prevData,
            instrumentProperties: message.properties
          }));
          
          // Also store in DataClient for persistence
          if (dataClientRef.current) {
            console.log("Storing instrument properties in DataClient:", message.properties);
            dataClientRef.current.updateMarketData({
              instrumentProperties: message.properties
            });
          }
        }
        break;
        
      case 'orderUpdate':
        if (message.order && message.order.orderId) {
          const updatedOrder = message.order;
          // Log arrival *before* state update
          console.log(`TradeManager: Received orderUpdate message for Name: ${updatedOrder.name}, OrderId: ${updatedOrder.orderId}`); 
          
          // Update state, merging new order data
          setOrders(prevOrders => ({
            ...prevOrders,
            // Use orderId as the key - the AddOn now sends the reliable ID
            [updatedOrder.orderId]: updatedOrder 
          }));
          
          // Check for stop order quantity adjustments after order updates
          if (smartStopSettings.stopQtyFollowsPosition) {
            setTimeout(() => {
              checkAndAdjustStopOrderQuantities();
            }, 100);
          }
        }
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  };
  
  // Handle account selection
  const handleAccountSelect = (account) => {
    console.log('TradeManager: Account selected:', account);
    console.log('TradeManager: Account type:', typeof account);
    console.log('TradeManager: Account keys:', account ? Object.keys(account) : 'N/A');
    
    // Ensure we have a valid account object with an id/accountId
    if (!account || (!account.id && !account.accountId)) {
        console.error("Invalid account object passed to handleAccountSelect:", account);
        setPopupContent({
            title: 'Internal Error',
            message: 'Cannot select account: Invalid account data.'
        });
        setShowPopup(true);
        return;
    }
    
    setSelectedAccount(account);
    console.log('TradeManager: selectedAccount state updated');
    
    // Clear any existing account details when switching accounts
    setAccountDetails(null);
    
    // Prefer accountId if available, otherwise use id
    const idToRequest = account.accountId || account.id;
    console.log("Account selected:", account, "Requesting details for ID:", idToRequest);
    setSelectedAccount(account); // Keep the original account object for display consistency
    // Log the state immediately after setting it
    console.log("State selectedAccount should now be:", account);
    
    if (selectedPlatform === 'ninjatrader') {
      // Find the account in the current accounts list to display immediately
      // This uses the data we already have from the accountsUpdate messages
      const currentAccounts = ntAccounts.filter(a => a.accountId === idToRequest || a.id === idToRequest);
      if (currentAccounts.length > 0) {
        // If we already have details for this account from an accountsUpdate message, use it immediately
        const foundAccount = currentAccounts[0];
        console.log("Using cached account details:", foundAccount);
        
        // Check if we have the detailed account info with accountId property
        if (foundAccount.accountId) {
          setAccountDetails(foundAccount);
        }
      }
      
      // Always send a request for the latest details using the correct ID
      sendToNTBridge({ 
        type: 'getAccountDetails',
        accountId: idToRequest
      });

      // Request existing orders for the selected account
      sendToNTBridge({ 
        type: 'getOrders',
        accountId: idToRequest 
      });
    } else if (selectedPlatform === 'demo') {
      // Generate demo account details
      setAccountDetails({
        accountId: idToRequest,
        name: account.name,
        connectionName: 'Demo',
        accountType: 'Simulation',
        cashValue: 100000,
        buyingPower: 100000,
        realizedProfitLoss: 0,
        unrealizedProfitLoss: 0,
        netLiquidationValue: 100000,
        positions: []
      });
    }
  };
  
  // Close popup
  const handleClosePopup = () => {
    setShowPopup(false);
  };
  
  // Handle flatten position button click
  const handleFlattenPosition = (instrumentSymbol) => {
    if (!selectedAccount || !isConnected) {
      console.error("Cannot flatten: No selected account or not connected.");
      setPopupContent({
          title: 'Error',
          message: 'Cannot flatten position: No account selected or connection lost.'
      });
      setShowPopup(true);
      return;
    }

    const accountId = selectedAccount.accountId || selectedAccount.id;
    if (!accountId || !instrumentSymbol) {
      console.error("Cannot flatten: Missing accountId or instrumentSymbol.");
       setPopupContent({
          title: 'Error',
          message: 'Cannot flatten position: Missing account or instrument identifier.'
      });
      setShowPopup(true);
      return;
    }
    
    console.log(`Sending flatten request for Account: ${accountId}, Instrument: ${instrumentSymbol}`);
    sendToNTBridge({
      type: 'flattenPosition',
      accountId: accountId,
      instrumentSymbol: instrumentSymbol // Send the NinjaTrader symbol
    });
  };
  
  // Add a new method to open the trade window
  const handleTrade = () => {
    try {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('open-trade-window');
    } catch (error) {
      console.error('Error opening trade window:', error);
    }
  };
  
  // Add state for instrument switch popup
  const [showInstrumentPopup, setShowInstrumentPopup] = useState(false);
  const [instrumentInput, setInstrumentInput] = useState('');

  // Handle Switch Instrument button click
  const handleSwitchInstrumentClick = () => {
    setInstrumentInput(''); // Clear previous input
    setShowInstrumentPopup(true);
  };

  // Handle closing the instrument popup
  const handleCloseInstrumentPopup = () => {
    setShowInstrumentPopup(false);
    setInstrumentInput('');
  };

  // Handle input change in the popup
  const handleInstrumentInputChange = (e) => {
    setInstrumentInput(e.target.value.toUpperCase()); // Store input, maybe force uppercase?
  };

  // Handle submission from the instrument popup (e.g., Enter key)
  const handleInstrumentSubmit = (e) => {
    // Check if Enter key was pressed
    if (e.key === 'Enter' && instrumentInput.trim()) {
      console.log(`User switched instrument to ${instrumentInput.trim()}`);
      
      // Send IPC message to main process to switch instrument
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('switch-instrument', instrumentInput.trim());
        console.log('TradeManager: Sent switch-instrument IPC message:', instrumentInput.trim());
      } catch (error) {
        console.error('TradeManager: Error sending switch-instrument IPC message:', error);
      }
      
      handleCloseInstrumentPopup(); // Close popup after submission
    }
  };
  
  // Render platform selection

  

  

  
  // Render account details
  const renderAccountDetails = () => {
    if (!selectedAccount) {
      return <div className="message">Select an account to view details</div>;
    }
    
    if (!accountDetails) {
      return <div className="message">Loading account details...</div>;
    }
    
    // Get live price for display from DataClient
    const symbol = marketData.currentSymbol;
    const price = marketData.latestPrice;
    const instrumentProperties = marketData.instrumentProperties;
    
    // Log the values being used for debugging
    console.log("TradeManager: Rendering account details with:", {
      symbol,
      price,
      instrumentProperties: instrumentProperties ? {
        contractMultiplier: instrumentProperties.contractMultiplier,
        tickSize: instrumentProperties.tickSize
      } : "undefined"
    });
    
    // Format the current price for display
    const formattedCurrentPrice = (price !== null && price !== undefined) 
      ? `$${Number(price).toFixed(2)}` 
      : 'n/a';
    
    // Calculate counts for tabs
    const positionCount = accountDetails?.positions?.length || 0;
    const orderCount = Object.values(ordersRef.current).filter(
      order => order.accountId === selectedAccount?.id || order.accountId === selectedAccount?.accountId
    ).length;

    // Calculate working order count
    const workingOrderStates = ['Working', 'Accepted', 'PendingSubmit', 'Submitted'];
    const workingOrderCount = Object.values(ordersRef.current).filter(
      order => 
        (order.accountId === selectedAccount?.id || order.accountId === selectedAccount?.accountId) &&
        workingOrderStates.includes(order.state)
    ).length;

    // Convert CME symbol to NinjaTrader format
    const currentNtSymbol = symbol ? convertCmeToNinjaTrader(symbol) : 'n/a';

    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{accountDetails.name} {accountDetails.displayName ? `(${accountDetails.displayName})` : ''}</h3>
        </div>
        
        <div className="card-body">
          <div className="overview-container">
            <div className="overview-section">
              <h4>Overview</h4>
              <AccountOverview accountDetails={accountDetails} />
            </div>
            
            <div className="current-instrument-section">
              <div className="current-instrument-display">
                <div className="instrument-header">
                  <h4 className="instrument-title">Current Instrument</h4>
                </div>
                <div className="instrument-body">
                  <div className="instrument-info-row">
                    <div className="info-label">Symbol:</div>
                    <div className="info-value">
                      <div className="symbol-container">
                        <span className="primary-symbol">{symbol || 'No instrument selected'}</span>
                        {symbol && <span className="secondary-symbol">({convertCmeToNinjaTrader(symbol)})</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="instrument-info-row">
                    <div className="info-label">Contract Multiplier:</div>
                    <div className="info-value">
                      {instrumentProperties?.pointValue || 'n/a'}
                    </div>
                  </div>
                  
                  <div className="instrument-info-row">
                    <div className="info-label">Tick Size:</div>
                    <div className="info-value">
                      {instrumentProperties?.tickSize || 'n/a'}
                    </div>
                  </div>
                  
                  <div className="instrument-info-row">
                    <div className="info-label">Latest Price:</div>
                    <div className="price-value">{formattedCurrentPrice}</div>
                  </div>
                  
                  <div className="instrument-info-row">
                    <div className="button-container">
                      <button
                        className="trade-button"
                        onClick={handleTrade}
                        disabled={!symbol || !isConnected}
                      >
                        Trade
                      </button>
                      <button
                        className="switch-instrument-button"
                        onClick={handleSwitchInstrumentClick}
                        disabled={!isConnected}
                      >
                        Switch Instrument
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabbed section for Positions and Orders */}
          <div className="list-tabs-container">
            <div 
              className={`list-tab ${activeListTab === 'positions' ? 'active' : ''}`}
              onClick={() => setActiveListTab('positions')}
            >
              Positions <span className={`tab-count ${activeListTab === 'positions' ? 'active' : ''}`}>{positionCount}</span>
            </div>
            <div 
              className={`list-tab ${activeListTab === 'orders' ? 'active' : ''}`} 
              onClick={() => setActiveListTab('orders')}
            >
              Orders <span className={`tab-count ${activeListTab === 'orders' ? 'active' : ''}`}>{orderCount}</span> 
              {workingOrderCount > 0 && (
                <span className="working-order-count">({workingOrderCount})</span>
              )}
            </div>
          </div>

          <div className="list-tab-content">
            {activeListTab === 'positions' && 
              <PositionsTable
                accountDetails={accountDetails}
                marketData={marketData}
                selectedAccount={selectedAccount}
                isConnected={isConnected}
                setPopupContent={setPopupContent}
                setShowPopup={setShowPopup}
                smartStopSettings={smartStopSettings}
              />
            }
            {activeListTab === 'orders' && 
              <OrdersTable
                selectedAccount={selectedAccount}
                isConnected={isConnected}
                ordersRef={ordersRef}
                setPopupContent={setPopupContent}
                setShowPopup={setShowPopup}
                smartStopSettings={smartStopSettings}
                handleModifyOrderClick={handleModifyOrderClick}
              />
            }
          </div>

        </div>
      </div>
    );
  };
  
  // Add state for order modification popup
  const [showModifyOrderPopup, setShowModifyOrderPopup] = useState(false);
  const [orderToModify, setOrderToModify] = useState(null);
  const [modifiedQuantity, setModifiedQuantity] = useState('');
  const [modifiedLimitPrice, setModifiedLimitPrice] = useState('');
  const [modifiedStopPrice, setModifiedStopPrice] = useState('');
  
  // Add a function to handle order modification
  const handleModifyOrderClick = (order) => {
    setOrderToModify(order);
    setModifiedQuantity(order.quantity.toString());
    
    // Set appropriate prices based on order type
    if (order.limitPrice) {
      setModifiedLimitPrice(order.limitPrice.toString());
    } else {
      setModifiedLimitPrice('');
    }
    
    if (order.stopPrice) {
      setModifiedStopPrice(order.stopPrice.toString());
    } else {
      setModifiedStopPrice('');
    }
    
    setShowModifyOrderPopup(true);
  };

  // Add a function to close the modify order popup
  const handleCloseModifyOrderPopup = () => {
    setShowModifyOrderPopup(false);
    setOrderToModify(null);
    setModifiedQuantity('');
    setModifiedLimitPrice('');
    setModifiedStopPrice('');
  };

  // Add a function to submit the modified order
  const handleSubmitModifiedOrder = () => {
    if (!orderToModify || !selectedAccount || !isConnected) {
      console.error("Cannot modify order: No selected account or not connected.");
      setPopupContent({
        title: 'Error',
        message: 'Cannot modify order: No account selected or connection lost.'
      });
      setShowPopup(true);
      handleCloseModifyOrderPopup();
      return;
    }
    
    // Parse values to ensure correct types
    const quantity = parseInt(modifiedQuantity, 10);
    const limitPrice = modifiedLimitPrice !== '' ? parseFloat(modifiedLimitPrice) : null;
    const stopPrice = modifiedStopPrice !== '' ? parseFloat(modifiedStopPrice) : null;
    
    // Validate inputs
    if (isNaN(quantity) || quantity <= 0) {
      setPopupContent({
        title: 'Validation Error',
        message: 'Quantity must be a positive integer.'
      });
      setShowPopup(true);
      return;
    }
    
    // Check if this is a pure limit order or MIT order (requires limit price)
    const isLimitTypeOrder = orderToModify.type.toUpperCase() === 'LIMIT' || 
                             orderToModify.type.toUpperCase() === 'MIT';
    
    // Check if this is a stop order (requires stop price)
    const isStopTypeOrder = orderToModify.type.toUpperCase().includes('STOP');
    
    // Validate limit price for limit-type orders
    if (isLimitTypeOrder && (isNaN(limitPrice) || limitPrice <= 0)) {
      setPopupContent({
        title: 'Validation Error',
        message: 'Limit price must be a positive number for this order type.'
      });
      setShowPopup(true);
      return;
    }
    
    // Validate stop price for stop-type orders
    if (isStopTypeOrder && (isNaN(stopPrice) || stopPrice <= 0)) {
      setPopupContent({
        title: 'Validation Error',
        message: 'Stop price must be a positive number for this order type.'
      });
      setShowPopup(true);
      return;
    }
    
    // Send the modify order request
    console.log(`Sending modify order request: Account=${selectedAccount.id || selectedAccount.accountId}, OrderId=${orderToModify.orderId}, Quantity=${quantity}, LimitPrice=${limitPrice}, StopPrice=${stopPrice}`);
    
    // For StopLimit orders, set both limit and stop prices to the same value (the entered stop price)
    let finalLimitPrice = limitPrice;
    if (orderToModify.type.toUpperCase() === 'STOPLIMIT' && stopPrice) {
      finalLimitPrice = stopPrice; // For StopLimit, limit price should match stop price
      console.log(`Order is StopLimit - setting both limit and stop to the same price: ${stopPrice}`);
    }
    
    sendToNTBridge({
      type: 'modify_order',
      accountId: selectedAccount.id || selectedAccount.accountId,
      orderId: orderToModify.orderId,
      quantity: quantity,
      limitPrice: finalLimitPrice,
      stopPrice: stopPrice
    });
    
    // Close the popup
    handleCloseModifyOrderPopup();
  };
  
  // Add Smart Stop management state
  const [smartStopSettings, setSmartStopSettings] = useState({
    stopQtyFollowsPosition: false,
    trailStopEnabled: false,
    trailStopPoints: 5,
    candleStopEnabled: false,
    candleTimeframe: '1m',
    candleType: 'favorable',
    cancelOrdersOnCloseReverse: false
  });
  
  // Refs for tracking state changes and performance optimization
  const positionsRef = useRef({});
  const prevPositionsRef = useRef({}); // Add ref to track previous positions for detecting changes
  const smartStopQtyAdjustmentLogRef = useRef([]);
  
  // Add reference to track throttling for trailing stop modifications
  const trailStopThrottleMapRef = useRef({});
  // Set minimum time between modifications for same order (in milliseconds)
  const TRAIL_STOP_THROTTLE_MS = 500; // Adjust this value as needed - 1 second minimum between updates
  
  // Add a function to detect position closures and reversals
  const checkForPositionChanges = useCallback(() => {
    // Skip if feature is not enabled
    if (!smartStopSettings.cancelOrdersOnCloseReverse) {
      return;
    }

    // Skip if no account selected
    if (!selectedAccount) {
      return;
    }

    console.log('TradeManager: Checking for position changes to determine if we need to cancel orders');
    
    const currentPositionsMap = positionsRef.current;
    const previousPositionsMap = prevPositionsRef.current;
    
    // Get instrument symbols from both current and previous positions
    const allInstruments = new Set([
      ...Object.keys(currentPositionsMap),
      ...Object.keys(previousPositionsMap)
    ]);
    
    console.log(`TradeManager: Checking position changes for ${allInstruments.size} instruments`);
    
    // Iterate through all instruments
    allInstruments.forEach(instrumentSymbol => {
      const currentPosition = currentPositionsMap[instrumentSymbol];
      const previousPosition = previousPositionsMap[instrumentSymbol];
      
      // Skip if both are undefined (shouldn't happen, but just in case)
      if (!previousPosition && !currentPosition) return;
      
      console.log(`TradeManager: Checking position change for ${instrumentSymbol}`, {
        previous: previousPosition ? 
          `${previousPosition.marketPosition} ${previousPosition.quantity}` : 'none',
        current: currentPosition ? 
          `${currentPosition.marketPosition} ${currentPosition.quantity}` : 'none'
      });
      
      // Case 1: Position existed before but doesn't exist now (position closed)
      if (previousPosition && !currentPosition) {
        console.log(`TradeManager: Position for ${instrumentSymbol} was closed`);
        cancelAllOrdersForInstrument(instrumentSymbol, 'Position closed');
        return;
      }
      
      // Case 2: Position didn't exist before but exists now (new position)
      if (!previousPosition && currentPosition) {
        console.log(`TradeManager: New position for ${instrumentSymbol}, no need to cancel orders`);
        return;
      }
      
      // Case 3: Position existed before and still exists (check for reversal)
      if (previousPosition && currentPosition) {
        // Check if position reversed
        if (previousPosition.marketPosition !== currentPosition.marketPosition) {
          console.log(`TradeManager: Position for ${instrumentSymbol} reversed from ${previousPosition.marketPosition} to ${currentPosition.marketPosition}`);
          cancelAllOrdersForInstrument(instrumentSymbol, 'Position reversed');
          return;
        }
        
        // Check if position was closed and reopened (quantity went to 0 and back)
        if (previousPosition.quantity > 0 && currentPosition.quantity === 0) {
          console.log(`TradeManager: Position for ${instrumentSymbol} was closed (quantity became 0)`);
          cancelAllOrdersForInstrument(instrumentSymbol, 'Position closed (quantity zero)');
        }
      }
    });
    
    // Update previous positions reference for next time
    prevPositionsRef.current = { ...currentPositionsMap };
  }, [selectedAccount, smartStopSettings.cancelOrdersOnCloseReverse]);

  // Add a helper function to cancel all orders for an instrument
  const cancelAllOrdersForInstrument = (instrumentSymbol, reason) => {
    if (!selectedAccount || !instrumentSymbol) {
      console.error('TradeManager: Cannot cancel orders - missing account or instrument');
      return;
    }
    
    console.log(`TradeManager: Canceling all orders for ${instrumentSymbol} due to: ${reason}`);
    
    // Use the existing cancel_all_orders command
    const request = {
      type: 'cancel_all_orders',
      accountId: selectedAccount.accountId || selectedAccount.id,
      instrumentSymbol: instrumentSymbol
    };
    
    // Send the request to NT Bridge
    sendToNTBridge(request);
    
    // Log the action
    console.log(`TradeManager: Sent request to cancel all orders for ${instrumentSymbol}`);
  };
  
  // Update refs after render to have current values in callbacks
  useEffect(() => {
    accountDetailsRef.current = accountDetails;
    ordersRef.current = orders;
    
    // Update positions ref when account details change
    if (accountDetails && accountDetails.positions) {
      // Convert positions array to a map by instrument for easier lookup
      const posMap = {};
      accountDetails.positions.forEach(pos => {
        const instr = pos.ninjaTraderSymbol || pos.instrument;
        if (instr) {
          posMap[instr] = pos;
        }
      });
      
      // Update the ref
      positionsRef.current = posMap;
      
      // Check for position changes and handle cancellations if needed
      checkForPositionChanges();
    }
  }, [accountDetails, orders, checkForPositionChanges]);
  
  // Handle IPC messages for Smart Stop settings
  useEffect(() => {
    try {
      // Import the electron IPC renderer
      const { ipcRenderer } = window.require('electron');
      
      // Listen for Smart Stop settings changes from other windows
      ipcRenderer.on('smart-stop-settings-changed', (event, settings) => {
        console.log('TradeManager: Received Smart Stop settings changed:', settings);
        
        // Update our local settings state with all received settings
        setSmartStopSettings(prevSettings => ({
          ...prevSettings,
          ...(settings.stopQtyFollowsPosition !== undefined ? { stopQtyFollowsPosition: settings.stopQtyFollowsPosition } : {}),
          ...(settings.trailStopEnabled !== undefined ? { trailStopEnabled: settings.trailStopEnabled } : {}),
          ...(settings.trailStopPoints !== undefined ? { trailStopPoints: settings.trailStopPoints } : {}),
          ...(settings.candleStopEnabled !== undefined ? { candleStopEnabled: settings.candleStopEnabled } : {}),
          ...(settings.candleTimeframe !== undefined ? { candleTimeframe: settings.candleTimeframe } : {}),
          ...(settings.candleType !== undefined ? { candleType: settings.candleType } : {}),
          ...(settings.cancelOrdersOnCloseReverse !== undefined ? { cancelOrdersOnCloseReverse: settings.cancelOrdersOnCloseReverse } : {})
        }));
        
        // Handle quantity adjustments if enabled
        if (settings.stopQtyFollowsPosition) {
          checkAndAdjustStopOrderQuantities();
        }
        
        // If candle stop has been enabled, subscribe to candle data
        if (settings.candleStopEnabled) {
          subscribeToCandleData(settings.candleTimeframe || smartStopSettings.candleTimeframe);
        }
        
        // Log the changed settings
        console.log('TradeManager: Updated Smart Stop settings:', settings);
      });

      // Listen for candle data events from the main window
      ipcRenderer.on('candle-closed', (event, data) => {
        console.log('TradeManager: Received candle closed event:', data);
        
        // Process candle data for stop adjustment if candle stop is enabled
        if (smartStopSettings.candleStopEnabled) {
          processCandleData(data);
        }
      });
    } catch (error) {
      console.error('TradeManager: Error setting up Smart Stop IPC listener:', error);
    }
    
    return () => {
      // Improved cleanup for IPC listeners
      try {
        const { ipcRenderer } = window.require('electron');
        console.log('TradeManager: Removing Smart Stop IPC listeners');
        ipcRenderer.removeAllListeners('smart-stop-settings-changed');
        ipcRenderer.removeAllListeners('candle-closed');
      } catch (error) {
        console.error('TradeManager: Error removing Smart Stop IPC listeners:', error);
      }
    };
  }, [smartStopSettings.candleStopEnabled, smartStopSettings.candleTimeframe]);

  // Also add useEffect to subscribe when candleStopEnabled changes directly
  useEffect(() => {
    // Subscribe to candle data when candleStopEnabled is true and we have a timeframe
    if (smartStopSettings.candleStopEnabled && smartStopSettings.candleTimeframe) {
        console.log(`TradeManager: Smart Stop by Candle enabled, subscribing to ${smartStopSettings.candleTimeframe} data`);
        subscribeToCandleData(smartStopSettings.candleTimeframe);
    }
}, [smartStopSettings.candleStopEnabled, smartStopSettings.candleTimeframe]);

  // Add a ref to track active position symbols
  const activePositionSymbolsRef = useRef(new Set());

  // Function to check and adjust stop orders whenever positions or orders change
  const checkAndAdjustStopOrderQuantities = useCallback(() => {
    // Only perform adjustments if Smart Stop qty tracking is enabled
    if (!smartStopSettings.stopQtyFollowsPosition) {
      return;
    }

    const currentPositions = accountDetailsRef.current?.positions || [];
    const currentOrders = ordersRef.current;
    
    console.log('TradeManager: Smart Stop - Checking position and order quantities');
    console.log('TradeManager: Positions:', currentPositions);
    console.log('TradeManager: Orders:', Object.values(currentOrders));

    // Early return if no account selected
    if (!selectedAccount) {
      console.log('TradeManager: Smart Stop - No account selected, skipping adjustment');
      return;
    }
    
    // Get current active position symbols
    const currentPositionSymbols = new Set(
      currentPositions.map(position => position.ninjaTraderSymbol || position.instrument)
    );
    
    // Find symbols that had positions but are now closed
    const closedPositionSymbols = Array.from(activePositionSymbolsRef.current)
      .filter(symbol => !currentPositionSymbols.has(symbol));
    
    console.log('TradeManager: Smart Stop - Previously active symbols:', Array.from(activePositionSymbolsRef.current));
    console.log('TradeManager: Smart Stop - Current active symbols:', Array.from(currentPositionSymbols));
    console.log('TradeManager: Smart Stop - Closed position symbols:', closedPositionSymbols);
    
    // Cancel stop orders for closed positions
    closedPositionSymbols.forEach(ninjaTraderSymbol => {
      console.log(`TradeManager: Smart Stop - Position ${ninjaTraderSymbol} was closed, canceling related stops`);
      
      // Find all stop orders for this symbol
      Object.values(currentOrders).forEach(order => {
        // Only process stop orders for this symbol and account
        const isStopOrder = order.type && (order.type.toUpperCase().includes('STOP'));
        const matchesSymbol = order.instrument === ninjaTraderSymbol;
        const isWorkingOrder = ['Working', 'Accepted', 'Submitted', 'PendingSubmit'].includes(order.state);
        
        if (isStopOrder && matchesSymbol && isWorkingOrder) {
          console.log(`TradeManager: Smart Stop - Canceling stop order ${order.orderId} for closed position ${ninjaTraderSymbol}`);
          
          // Send cancel order request
          sendToNTBridge({
            type: 'cancel_order',
            accountId: selectedAccount.accountId || selectedAccount.id,
            orderId: order.orderId
          });
          
          // Log the adjustment
          smartStopQtyAdjustmentLogRef.current.push({
            timestamp: new Date(),
            action: 'CANCEL',
            symbol: ninjaTraderSymbol,
            orderId: order.orderId,
            reason: 'Position closed'
          });
        }
      });
    });
    
    // Update active position symbols reference for next comparison
    activePositionSymbolsRef.current = currentPositionSymbols;
    
    // Process each active position
    currentPositions.forEach(position => {
      const ninjaTraderSymbol = position.ninjaTraderSymbol || position.instrument;
      const marketPosition = position.marketPosition;
      const positionQty = position.quantity;
      
      // Skip positions with zero quantity
      if (positionQty <= 0 || marketPosition === 'Flat') {
        console.log(`TradeManager: Smart Stop - Position ${ninjaTraderSymbol} is flat, canceling related stops`);
        
        // If position is closed (flat), cancel all stop orders for this symbol
        Object.values(currentOrders).forEach(order => {
          // Only process stop orders for this symbol and account
          const isStopOrder = order.type && (order.type.toUpperCase().includes('STOP'));
          const matchesSymbol = order.instrument === ninjaTraderSymbol;
          const isWorkingOrder = ['Working', 'Accepted', 'Submitted', 'PendingSubmit'].includes(order.state);
          
          if (isStopOrder && matchesSymbol && isWorkingOrder) {
            console.log(`TradeManager: Smart Stop - Canceling stop order ${order.orderId} for closed position ${ninjaTraderSymbol}`);
            
            // Send cancel order request
            sendToNTBridge({
              type: 'cancel_order',
              accountId: selectedAccount.accountId || selectedAccount.id,
              orderId: order.orderId
            });
            
            // Log the adjustment
            smartStopQtyAdjustmentLogRef.current.push({
              timestamp: new Date(),
              action: 'CANCEL',
              symbol: ninjaTraderSymbol,
              orderId: order.orderId,
              reason: 'Position closed'
            });
          }
        });
        
        return;
      }
      
      // Find all stop orders for this symbol and account that need quantity adjustment
      Object.values(currentOrders).forEach(order => {
        // Only process stop orders for this symbol and account
        const isStopOrder = order.type && (order.type.toUpperCase().includes('STOP'));
        const matchesSymbol = order.instrument === ninjaTraderSymbol;
        const isWorkingOrder = ['Working', 'Accepted', 'Submitted', 'PendingSubmit'].includes(order.state);
        
        if (isStopOrder && matchesSymbol && isWorkingOrder) {
          // Check if order quantity doesn't match position quantity
          if (order.quantity !== positionQty) {
            console.log(`TradeManager: Smart Stop - Modifying stop order ${order.orderId} quantity from ${order.quantity} to ${positionQty}`);
            
            // Create a modify order request that keeps the same prices but updates quantity
            const modifyRequest = {
              type: 'modify_order',
              accountId: selectedAccount.accountId || selectedAccount.id,
              orderId: order.orderId,
              quantity: positionQty,
              limitPrice: order.limitPrice,
              stopPrice: order.stopPrice
            };
            
            // Send the modify order request
            sendToNTBridge(modifyRequest);
            
            // Log the adjustment
            smartStopQtyAdjustmentLogRef.current.push({
              timestamp: new Date(),
              action: 'MODIFY',
              symbol: ninjaTraderSymbol,
              orderId: order.orderId,
              oldQty: order.quantity,
              newQty: positionQty,
              reason: 'Position quantity changed'
            });
          }
        }
      });
    });
  }, [smartStopSettings.stopQtyFollowsPosition, selectedAccount]);
  
  // Watch for orders/position changes to adjust stop orders
  useEffect(() => {
    // Check if we need to adjust stop order quantities when orders change
    if (smartStopSettings.stopQtyFollowsPosition) {
      checkAndAdjustStopOrderQuantities();
    }
  }, [orders, accountDetails, smartStopSettings.stopQtyFollowsPosition, checkAndAdjustStopOrderQuantities]);

  // Update the activePositionSymbolsRef whenever accountDetails changes
  useEffect(() => {
    if (accountDetails && accountDetails.positions) {
      const currentSymbols = new Set(
        accountDetails.positions
          .filter(pos => pos.quantity > 0 && pos.marketPosition !== 'Flat')
          .map(pos => pos.ninjaTraderSymbol || pos.instrument)
      );
      
      console.log('TradeManager: Updating active position symbols from account details:', 
        Array.from(currentSymbols));
      activePositionSymbolsRef.current = currentSymbols;
    }
  }, [accountDetails]);

  // Add a new function to handle trailing stops based on price movement
  const checkAndAdjustTrailingStops = useCallback(() => {
    // Skip if trailing stop feature is not enabled
    if (!smartStopSettings.trailStopEnabled) {
      return;
    }
    
    // Get the current price, positions, and orders
    const currentPrice = marketData.latestPrice;
    const currentPositions = accountDetailsRef.current?.positions || [];
    const currentOrders = ordersRef.current;
    
    // Skip if price is invalid or no account is selected
    if (!currentPrice || !selectedAccount) {
      console.log('TradeManager: Trail Stop - Skipping adjustment due to invalid price or no account selected');
      return;
    }
    
    console.log('TradeManager: Trail Stop - Checking price and stop orders');
    
    const currentTime = Date.now();
    
    // Create a set of active order IDs to use for throttle map cleanup
    const activeOrderIds = new Set(
      Object.values(currentOrders)
        .filter(order => ['Working', 'Accepted', 'Submitted', 'PendingSubmit'].includes(order.state))
        .map(order => order.orderId)
    );
    
    // Clean up throttle map - remove entries for orders that no longer exist or are no longer working
    Object.keys(trailStopThrottleMapRef.current).forEach(orderId => {
      if (!activeOrderIds.has(orderId)) {
        console.log(`TradeManager: Trail Stop - Cleaning up throttle entry for completed/cancelled order ${orderId}`);
        delete trailStopThrottleMapRef.current[orderId];
      }
    });
    
    // Process each active position
    currentPositions.forEach(position => {
      const ninjaTraderSymbol = position.ninjaTraderSymbol || position.instrument;
      const marketPosition = position.marketPosition;
      const positionQty = position.quantity;
      
      // Skip positions with zero quantity
      if (positionQty <= 0 || marketPosition === 'Flat') {
        return;
      }
      
      // Get all working stop orders for this position
      const stopOrders = Object.values(currentOrders).filter(order => {
        const isStopOrder = order.type && (order.type.toUpperCase().includes('STOP'));
        const matchesSymbol = order.instrument === ninjaTraderSymbol;
        const isWorkingOrder = ['Working', 'Accepted', 'Submitted', 'PendingSubmit'].includes(order.state);
        const matchesAccount = order.accountId === (selectedAccount.accountId || selectedAccount.id);
        
        return isStopOrder && matchesSymbol && isWorkingOrder && matchesAccount;
      });
      
      if (stopOrders.length === 0) {
        return; // No stop orders for this position
      }
      
      // Get instrument properties for price calculations
      const tickSize = marketData.instrumentProperties?.tickSize || 0.25; // Default to 0.25 for ES futures
      const trailPoints = smartStopSettings.trailStopPoints;
      
      // Calculate trail amount in DIRECT PRICE TERMS
      // For futures like ES, the trail points should represent actual points (not tick counts)
      // For ES, 1 point = $50 and 1 tick = 0.25 points
      // IMPORTANT FIX: Use the direct point value, not tick multiplier
      const trailAmount = trailPoints; // Direct price points, not tick-based
      
      console.log(`TradeManager: Trail Stop - Processing ${marketPosition} position for ${ninjaTraderSymbol}`);
      console.log(`TradeManager: Trail Stop - Trail amount: ${trailAmount} points (not scaled by tick size)`);
      console.log(`TradeManager: Trail Stop - Current price: ${currentPrice}`);
      
      // Process each stop order for this position
      stopOrders.forEach(order => {
        // Skip if no stop price
        if (!order.stopPrice) {
          return;
        }
        
        const orderId = order.orderId;
        
        // Check throttle - don't modify orders too frequently
        const lastModTime = trailStopThrottleMapRef.current[orderId];
        if (lastModTime && (currentTime - lastModTime < TRAIL_STOP_THROTTLE_MS)) {
          console.log(`TradeManager: Trail Stop - Throttling modification for order ${orderId}. `
                    + `Last modified ${currentTime - lastModTime}ms ago (throttle: ${TRAIL_STOP_THROTTLE_MS}ms)`);
          return; // Skip this order if we modified it too recently
        }
        
        // Determine if this is a buy or sell stop
        const isBuyStop = order.action.toUpperCase() === 'BUY';
        const isSellStop = order.action.toUpperCase() === 'SELL';
        
        // Calculate new stop price based on market position
        let newStopPrice = null;
        let shouldModify = false;
        
        if (marketPosition === 'Long' && isSellStop) {
          // For LONG positions, trail SELL stop below current price
          const idealStopPrice = currentPrice - trailAmount;
          
          // Only move the stop up (to lock in profits), never move it lower
          if (idealStopPrice > order.stopPrice) {
            newStopPrice = idealStopPrice;
            shouldModify = true;
            console.log(`TradeManager: Trail Stop - Moving SELL stop for LONG position UP from ${order.stopPrice} to ${newStopPrice}`);
          }
        } 
        else if (marketPosition === 'Short' && isBuyStop) {
          // For SHORT positions, trail BUY stop above current price
          const idealStopPrice = currentPrice + trailAmount;
          
          // Only move the stop down (to lock in profits), never move it higher
          if (idealStopPrice < order.stopPrice) {
            newStopPrice = idealStopPrice;
            shouldModify = true;
            console.log(`TradeManager: Trail Stop - Moving BUY stop for SHORT position DOWN from ${order.stopPrice} to ${newStopPrice}`);
          }
        }
        
        // Modify the order if needed
        if (shouldModify && newStopPrice !== null) {
          // Create modify order request
          const modifyRequest = {
            type: 'modify_order',
            accountId: selectedAccount.accountId || selectedAccount.id,
            orderId: order.orderId,
            quantity: order.quantity,
            limitPrice: order.type.toUpperCase() === 'LIMITSTOP' ? newStopPrice : order.limitPrice,
            stopPrice: newStopPrice
          };
          
          // Send the modify order request
          console.log(`TradeManager: Trail Stop - Sending modify request:`, modifyRequest);
          sendToNTBridge(modifyRequest);
          
          // Update the throttle map with current time for this order
          trailStopThrottleMapRef.current[orderId] = currentTime;
        }
      });
    });
  }, [smartStopSettings.trailStopEnabled, smartStopSettings.trailStopPoints, marketData.latestPrice, marketData.instrumentProperties, selectedAccount]);

  // Update useEffect to trigger trailing stop checks when price changes
  useEffect(() => {
    // When market data or price changes, check if we need to adjust trailing stops
    if (smartStopSettings.trailStopEnabled && marketData.latestPrice > 0) {
      checkAndAdjustTrailingStops();
    }
  }, [marketData.latestPrice, smartStopSettings.trailStopEnabled, checkAndAdjustTrailingStops]);

  // Fix for instrumentProperties - ensure we request properties when symbol changes
  useEffect(() => {
    // When current symbol changes and we're connected, request instrument properties
    if (marketData.currentSymbol && isConnected) {
      console.log(`TradeManager: Current symbol changed to ${marketData.currentSymbol}, requesting instrument properties`);
      const ntSymbol = convertCmeToNinjaTrader(marketData.currentSymbol);
      sendToNTBridge({ 
        type: 'getInstrumentProperties',
        symbol: ntSymbol
      });
    }
  }, [marketData.currentSymbol, isConnected]);

  // Specifically request instrument properties when connection is established
  useEffect(() => {
    if (isConnected && marketData.currentSymbol) {
      console.log(`TradeManager: Connected to NT Bridge, requesting instrument properties for ${marketData.currentSymbol}`);
      const ntSymbol = convertCmeToNinjaTrader(marketData.currentSymbol);
      
      // Add debug logging for the symbol conversion
      console.log(`TradeManager: Converted symbol ${marketData.currentSymbol} to ${ntSymbol} for properties request`);
      
      // Send the request to get instrument properties
      sendToNTBridge({ 
        type: 'getInstrumentProperties',
        symbol: ntSymbol
      });
    }
  }, [isConnected, marketData.currentSymbol]);

  // Function to update the price while preserving instrument properties
  const updatePrice = useCallback((newPrice) => {
    setMarketData(prevData => ({
      ...prevData,
      latestPrice: newPrice
    }));
  }, []);

  // In the IPC event listener for price-update
  useEffect(() => {
    try {
      const { ipcRenderer } = window.require('electron');

      // Handle price updates from the main window
      const handlePriceUpdate = (event, price) => {
        console.log(`TradeManager: Received price update: ${price}`);
        updatePrice(price);
      };

      // Register event listener
      ipcRenderer.on('price-update', handlePriceUpdate);

      // Clean up function
      return () => {
        ipcRenderer.removeListener('price-update', handlePriceUpdate);
      };
    } catch (err) {
      console.error("Error setting up price update listener:", err);
    }
  }, [updatePrice]);

  // Add effect to sync instrument properties from DataClient if needed
  useEffect(() => {
    // Only run if we're connected, have a symbol, but are missing instrument properties
    if (isConnected && marketData.currentSymbol && !marketData.instrumentProperties && dataClientRef.current) {
      console.log(`TradeManager: No instrument properties in state, checking DataClient for ${marketData.currentSymbol}`);
      
      // Try to get properties from DataClient
      dataClientRef.current.getMarketData()
        .then(data => {
          if (data && data.instrumentProperties) {
            console.log("TradeManager: Found instrument properties in DataClient, syncing to state:", data.instrumentProperties);
            
            // Update our local state
            setMarketData(prevData => ({
              ...prevData,
              instrumentProperties: data.instrumentProperties
            }));
          } else {
            console.log("TradeManager: No instrument properties found in DataClient, requesting from NT Bridge");
            
            // Request properties from NT Bridge
            const ntSymbol = convertCmeToNinjaTrader(marketData.currentSymbol);
            sendToNTBridge({ 
              type: 'getInstrumentProperties',
              symbol: ntSymbol
            });
          }
        })
        .catch(error => {
          console.error("TradeManager: Error fetching market data from DataClient:", error);
        });
    }
  }, [isConnected, marketData.currentSymbol, marketData.instrumentProperties]);

  // Add reference for candle tracking and stop adjustment
  const lastProcessedCandleRef = useRef({});
  const candleStopThrottleMapRef = useRef({});
  // Set minimum time between modifications for same order (in milliseconds)
  const CANDLE_STOP_THROTTLE_MS = 1000; // Adjust this value as needed

  // Add a function to subscribe to candle data for the specified timeframe
  const subscribeToCandleData = (timeframe) => {
    try {
      const { ipcRenderer } = window.require('electron');
      console.log(`TradeManager: Subscribing to ${timeframe} candle data`);
      
      // Send request to main window to start sending candle closure events
      ipcRenderer.send('subscribe-to-candle-data', {
        timeframe: timeframe
      });
    } catch (error) {
      console.error('TradeManager: Error subscribing to candle data:', error);
    }
  };

  // Add a function to process candle data and adjust stop orders if needed
  const processCandleData = (candleData) => {
    // Update position annotations when new candle data arrives to ensure
    // they stay one candle ahead of the live candle
    if (selectedAccount && tradeAnnotationServiceRef.current) {
      try {
        // Get active positions for the current symbol
        const positions = (accountDetailsRef.current?.positions || []).filter(position => 
          position.quantity > 0 && 
          position.cmeSymbol === candleData.symbol
        );
        
        // If we have positions for this symbol, update their annotations
        if (positions.length > 0) {
          console.log(`TradeManager: Updating position annotations for ${positions.length} positions on ${candleData.symbol} after candle update`);
          
          // Update position timestamps for this candle's timeframe
          positions.forEach(position => {
            const positionId = position.positionId || position.instrument;
            const key = `${selectedAccount.id || selectedAccount.accountId}_${positionId}`;
            
            // Store the current candle timestamp and timeframe
            // This will be used to calculate the position annotation placement
            positionTimestampsRef.current[key] = {
              timestamp: candleData.timestamp,
              timeframe: candleData.timeframe
            };
            
            // Enrich the position object with timeframe information
            position.timeframe = candleData.timeframe;
          });
          
          // Trigger annotation update
          fetchLatestCandleAndUpdateAnnotations();
        }
      } catch (err) {
        console.error('TradeManager: Error updating position annotations after candle update:', err);
      }
    }
    
    // Skip smart stop processing if not enabled or no account selected
    if (!smartStopSettings.candleStopEnabled || !selectedAccount) {
      console.log('TradeManager: Skipping candle processing - feature not enabled or no account selected');
      return;
    }
    
    console.log(`TradeManager: Processing ${candleData.timeframe} candle data for stop adjustment (our timeframe: ${smartStopSettings.candleTimeframe})`);
    
    // Verify that the candle timeframe matches the one we're interested in
    if (candleData.timeframe !== smartStopSettings.candleTimeframe) {
      console.log(`TradeManager: Ignoring candle data with timeframe ${candleData.timeframe}, we're tracking ${smartStopSettings.candleTimeframe}`);
      return;
    }
    
    // Check if we've already processed this candle (prevent duplicate processing)
    const candleKey = `${candleData.symbol}_${candleData.timestamp}`;
    if (lastProcessedCandleRef.current[candleKey]) {
      console.log(`TradeManager: Already processed candle ${candleKey}, skipping`);
      return;
    }
    
    // Mark this candle as processed
    lastProcessedCandleRef.current[candleKey] = true;
    console.log(`TradeManager: Processing new candle ${candleKey}`);
    
    // Extract candle data
    const { symbol, open, high, low, close, timestamp } = candleData;
    console.log(`TradeManager: Candle OHLC: Open=${open}, High=${high}, Low=${low}, Close=${close}`);
    
    // Get current positions for this symbol
    const currentPositions = accountDetailsRef.current?.positions?.filter(
      position => position.cmeSymbol === symbol
    ) || [];
    
    // Skip if no positions for this symbol
    if (currentPositions.length === 0) {
      console.log(`TradeManager: No positions found for symbol ${symbol}, skipping candle processing`);
      return;
    }
    
    console.log(`TradeManager: Found ${currentPositions.length} positions for symbol ${symbol}`);
    
    // Process each position
    currentPositions.forEach(position => {
      const marketPosition = position.marketPosition;
      const ninjaTraderSymbol = position.ninjaTraderSymbol || position.instrument;
      
      // Skip flat positions
      if (position.quantity <= 0 || marketPosition === 'Flat') {
        console.log(`TradeManager: Position ${ninjaTraderSymbol} is flat, skipping`);
        return;
      }
      
      console.log(`TradeManager: Processing ${marketPosition} position of ${position.quantity} contracts for ${ninjaTraderSymbol}`);
      
      // Determine if candle meets the type criteria
      let candleMeetsCriteria = false;
      
      // Check "favorable" condition - green candle for long, red candle for short
      const isFavorableCandle = (marketPosition === 'Long' && close > open) || 
                               (marketPosition === 'Short' && open > close);
      
      // Check "unfavorable" condition - red candle for long, green candle for short
      const isUnfavorableCandle = (marketPosition === 'Long' && close <= open) || 
                                 (marketPosition === 'Short' && open <= close);
      
      // Apply the criteria based on selected candle type
      if ((smartStopSettings.candleType === 'favorable' || smartStopSettings.candleType === 'green') && isFavorableCandle) {
        candleMeetsCriteria = true;
        console.log(`TradeManager: Candle is ${smartStopSettings.candleType} (green for long, red for short) for ${marketPosition} position`);
      } else if ((smartStopSettings.candleType === 'unfavorable' || smartStopSettings.candleType === 'red') && isUnfavorableCandle) {
        candleMeetsCriteria = true;
        console.log(`TradeManager: Candle is ${smartStopSettings.candleType} (red for long, green for short) for ${marketPosition} position`);
      } else if (smartStopSettings.candleType === 'any') {
        candleMeetsCriteria = true;
        console.log(`TradeManager: Using any candle type`);
      } else {
        console.log(`TradeManager: Candle does not meet ${smartStopSettings.candleType} criteria for ${marketPosition} position`);
      }
      
      // Log whether the candle meets criteria
      console.log(`TradeManager: Candle for ${symbol} meets ${smartStopSettings.candleType} criteria: ${candleMeetsCriteria}`);
      
      // If candle doesn't meet criteria, skip
      if (!candleMeetsCriteria) {
        return;
      }
      
      // Get all working stop orders for this position
      const stopOrders = Object.values(ordersRef.current).filter(order => {
        const isStopOrder = order.type && (order.type.toUpperCase().includes('STOP'));
        const matchesSymbol = order.instrument === ninjaTraderSymbol;
        const isWorkingOrder = ['Working', 'Accepted', 'Submitted', 'PendingSubmit'].includes(order.state);
        const matchesAccount = order.accountId === (selectedAccount.accountId || selectedAccount.id);
        
        return isStopOrder && matchesSymbol && isWorkingOrder && matchesAccount;
      });
      
      console.log(`TradeManager: Found ${stopOrders.length} stop orders for ${ninjaTraderSymbol}`);
      
      if (stopOrders.length === 0) {
        console.log(`TradeManager: No stop orders found for ${ninjaTraderSymbol}, skipping candle stop adjustment`);
        return;
      }
      
      // Process each stop order
      stopOrders.forEach(order => {
        // Skip if no stop price
        if (!order.stopPrice) {
          console.log(`TradeManager: Order ${order.orderId} has no stop price, skipping`);
          return;
        }
        
        const orderId = order.orderId;
        const currentTime = Date.now();
        
        // Check throttle - don't modify orders too frequently
        const lastModTime = candleStopThrottleMapRef.current[orderId];
        if (lastModTime && (currentTime - lastModTime < CANDLE_STOP_THROTTLE_MS)) {
          console.log(`TradeManager: Throttling modification for order ${orderId}. `
                    + `Last modified ${currentTime - lastModTime}ms ago (throttle: ${CANDLE_STOP_THROTTLE_MS}ms)`);
          return; // Skip this order if we modified it too recently
        }
        
        // Determine if this is a buy or sell stop
        const isBuyStop = order.action.toUpperCase() === 'BUY';
        const isSellStop = order.action.toUpperCase() === 'SELL';
        
        console.log(`TradeManager: Order ${orderId} is a ${order.action} ${order.type} order with stop price ${order.stopPrice}`);
        
        // Calculate new stop price based on market position
        let newStopPrice = null;
        let shouldModify = false;
        
        if (marketPosition === 'Long' && isSellStop) {
          // For LONG positions, use LOW of the candle for SELL stops
          // Only move the stop up (to lock in profits), never move it lower
          if (low > order.stopPrice) {
            newStopPrice = low;
            shouldModify = true;
            console.log(`TradeManager: Moving SELL stop for LONG position UP from ${order.stopPrice} to ${newStopPrice} (candle low)`);
          } else {
            console.log(`TradeManager: Not moving SELL stop (${order.stopPrice}) because candle low (${low}) is not higher`);
          }
        } 
        else if (marketPosition === 'Short' && isBuyStop) {
          // For SHORT positions, use HIGH of the candle for BUY stops
          // Only move the stop down (to lock in profits), never move it higher
          if (high < order.stopPrice) {
            newStopPrice = high;
            shouldModify = true;
            console.log(`TradeManager: Moving BUY stop for SHORT position DOWN from ${order.stopPrice} to ${newStopPrice} (candle high)`);
          } else {
            console.log(`TradeManager: Not moving BUY stop (${order.stopPrice}) because candle high (${high}) is not lower`);
          }
        } else {
          console.log(`TradeManager: Order action (${order.action}) doesn't match position direction (${marketPosition}), skipping`);
        }
        
        // Modify the order if needed
        if (shouldModify && newStopPrice !== null) {
          // Create modify order request
          const modifyRequest = {
            type: 'modify_order',
            accountId: selectedAccount.accountId || selectedAccount.id,
            orderId: order.orderId,
            quantity: order.quantity,
            limitPrice: order.type.toUpperCase() === 'LIMITSTOP' ? newStopPrice : order.limitPrice,
            stopPrice: newStopPrice
          };
          
          // Send the modify order request
          console.log(`TradeManager: Sending modify request:`, modifyRequest);
          sendToNTBridge(modifyRequest);
          
          // Update the throttle map with current time for this order
          candleStopThrottleMapRef.current[orderId] = currentTime;
        }
      });
    });
  };

  // Handler for when a trade order annotation is dragged on the chart
  const handleOrderAnnotationDragEnded = (orderId, dragArgs) => {
    if (!dragArgs || typeof dragArgs.y1 !== 'number') {
      console.error('TradeManager: Invalid dragArgs received from annotation drag:', dragArgs);
      return;
    }

    const newPrice = dragArgs.y1;
    console.log(`TradeManager: Order annotation with ID ${orderId} dragged. New y1 (price): ${newPrice}`);

    // Add debugging to show available orders
    console.log('TradeManager: Available orders in ordersRef.current:', Object.keys(ordersRef.current));
    console.log('TradeManager: Looking for order ID:', orderId);
    console.log('TradeManager: Full ordersRef.current:', ordersRef.current);

    const orderToModify = ordersRef.current[orderId];

    if (!orderToModify) {
      console.error(`TradeManager: Could not find order with ID ${orderId} to modify.`);
      console.error('TradeManager: Available order IDs:', Object.keys(ordersRef.current));
      setPopupContent({ title: 'Error', message: `Order ${orderId} not found for modification.` });
      setShowPopup(true);
      return;
    }

    if (!selectedAccountRef.current || !isConnectedRef.current) {
      console.error("TradeManager: Cannot modify order via chart drag: No selected account or not connected.");
      console.error('TradeManager: selectedAccount:', selectedAccount);
      console.error('TradeManager: isConnected:', isConnected);
      console.error('TradeManager: selectedAccountRef.current:', selectedAccountRef.current);
      console.error('TradeManager: isConnectedRef.current:', isConnectedRef.current);
      console.error('TradeManager: selectedAccount type:', typeof selectedAccount);
      console.error('TradeManager: selectedAccount keys:', selectedAccount ? Object.keys(selectedAccount) : 'N/A');
      setPopupContent({ title: 'Error', message: 'Cannot modify order: No account or connection.' });
      setShowPopup(true);
      return;
    }

    console.log('TradeManager: Found order to modify:', orderToModify);

    // Determine price fields to update based on order type
    const orderType = orderToModify.type.toLowerCase();
    let newLimitPrice = orderToModify.limitPrice;
    let newStopPrice = orderToModify.stopPrice;
    let priceChanged = false;

    console.log(`TradeManager: Order type: ${orderType}, current limitPrice: ${orderToModify.limitPrice}, current stopPrice: ${orderToModify.stopPrice}`);

    // Build the modification request with only the appropriate fields for each order type
    const modifyRequest = {
      type: 'modify_order',
      accountId: selectedAccountRef.current.accountId || selectedAccountRef.current.id,
      orderId: orderToModify.orderId,
      quantity: orderToModify.quantity, // Quantity is not changed by dragging price line
    };

    if (orderType === 'limit') {
      // Limit orders ONLY have limitPrice
      if (orderToModify.limitPrice !== newPrice) {
        newLimitPrice = newPrice;
        modifyRequest.limitPrice = newLimitPrice;
        priceChanged = true;
        console.log(`TradeManager: Limit order - setting limitPrice from ${orderToModify.limitPrice} to ${newPrice}`);
      }
    } else if (orderType === 'stop' || orderType === 'stopmarket') {
      // Stop Market orders ONLY have stopPrice
      if (orderToModify.stopPrice !== newPrice) {
        newStopPrice = newPrice;
        modifyRequest.stopPrice = newStopPrice;
        priceChanged = true;
        console.log(`TradeManager: Stop Market order - setting stopPrice from ${orderToModify.stopPrice} to ${newPrice}`);
      }
    } else if (orderType === 'stoplimit') {
      // Stop Limit orders have BOTH limitPrice and stopPrice
      if (orderToModify.stopPrice !== newPrice) {
        newStopPrice = newPrice;
        newLimitPrice = newPrice; // For StopLimit, typically both prices move together
        modifyRequest.limitPrice = newLimitPrice;
        modifyRequest.stopPrice = newStopPrice;
        priceChanged = true;
        console.log(`TradeManager: Stop Limit order - setting both limitPrice and stopPrice from ${orderToModify.stopPrice} to ${newPrice}`);
      }
    } else {
      console.warn(`TradeManager: Order type ${orderType} is not draggable or modification logic not implemented.`);
      setPopupContent({ title: 'Warning', message: `Order type ${orderType} cannot be modified by dragging.` });
      setShowPopup(true);
      return;
    }

    if (!priceChanged) {
      console.log(`TradeManager: Order ${orderId} price unchanged after drag (${newPrice}), no modification sent.`);
      return;
    }
    
    console.log(`TradeManager: Sending modify_order for ${orderId}:`, modifyRequest);

    // Send the request with only the appropriate price fields
    sendToNTBridge(modifyRequest);

    // Update the local order data immediately to reflect the new prices
    // This ensures that when annotations are recreated (e.g., when "Done Modifying" is clicked),
    // they show the new prices instead of reverting to the original prices
    setOrders(prevOrders => {
      const updatedOrders = { ...prevOrders };
      if (updatedOrders[orderId]) {
        updatedOrders[orderId] = {
          ...updatedOrders[orderId],
          limitPrice: newLimitPrice,
          stopPrice: newStopPrice
        };
        console.log(`TradeManager: Updated local order data for ${orderId}. New Limit: ${newLimitPrice}, New Stop: ${newStopPrice}`);
      }
      return updatedOrders;
    });

    // Also update the ordersRef to keep it in sync
    if (ordersRef.current[orderId]) {
      ordersRef.current[orderId] = {
        ...ordersRef.current[orderId],
        limitPrice: newLimitPrice,
        stopPrice: newStopPrice
      };
    }

    // Order modification completed successfully - no popup needed
    console.log(`TradeManager: Order ${orderToModify.name || orderId} price modification sent successfully`);
  };

  // Handlers for chart modification mode IPC messages - simplified
  const handleShowModifyOverlay = () => {
    console.log('TradeManager: Activating chart order modification mode via IPC.');
    setIsChartModificationModeActive(true);
  };

  const handleHideModifyOverlay = () => {
    console.log('TradeManager: Deactivating chart order modification mode via IPC.');
    setIsChartModificationModeActive(false);
  };

  return (
    <div className="trade-manager-container">
      <div className="header">
        <h1 className="header-title">Trade Manager</h1>
        <div className="connection-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
          <span className={`status-text ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      
      <div className="main-content">
        <div className="sidebar">
          <h2 className="sidebar-title">Platforms</h2>
          <PlatformSelection 
            selectedPlatform={selectedPlatform}
            isConnected={isConnected}
            isConnecting={isConnecting}
            handlePlatformChange={handlePlatformChange}
            handleConnect={handleConnect}
            handleDisconnect={handleDisconnect}
          />
          
          <h2 className="sidebar-title">Accounts</h2>
          <AccountList 
            isConnected={isConnected}
            ntAccounts={ntAccounts}
            selectedAccount={selectedAccount}
            handleAccountSelect={handleAccountSelect}
          />
        </div>
        
        <div className="content-area">
          {renderAccountDetails()}
        </div>
      </div>
      
      {showPopup && (
        <div className="overlay">
          <div className="popup-box">
            <h3 className="popup-title">{popupContent.title}</h3>
            <div className="popup-message">{popupContent.message}</div>
            <button className="button primary" onClick={handleClosePopup}>OK</button>
          </div>
        </div>
      )}

      {/* Instrument Switch Popup */}
      {showInstrumentPopup && (
        <div className="overlay" onClick={handleCloseInstrumentPopup}>
          <div className="popup-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="popup-title">Choose Instrument:</h3>
            <div className="form-group">
              <input
                className="input"
                type="text"
                value={instrumentInput}
                onChange={handleInstrumentInputChange}
                onKeyDown={handleInstrumentSubmit}
                placeholder="Enter instrument symbol"
                autoFocus
              />
            </div>
            <div className="button-group">
              <button className="button primary" onClick={() => {
                 handleInstrumentSubmit({ key: 'Enter' });
               }} disabled={!instrumentInput.trim()}>
                Switch
              </button>
              <button className="button" onClick={handleCloseInstrumentPopup}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modify Order Popup */}
      {showModifyOrderPopup && orderToModify && (
        <div className="overlay" onClick={handleCloseModifyOrderPopup}>
          <div className="popup-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="popup-title">Modify Order</h3>
            
            {/* Read-only information section with different styling */}
            <div style={{ 
              background: '#2a2a2a', 
              padding: '10px', 
              borderRadius: '4px', 
              marginBottom: '15px',
              border: '1px solid #333'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#aaa' }}>Order Information (Read-only)</h4>
              
              <div className="form-group">
                <label className="label">Instrument:</label>
                <div style={{ color: '#ddd', fontSize: '14px', padding: '4px 0' }}>
                  {orderToModify.instrument}
                </div>
              </div>
              <div className="form-group">
                <label className="label">Order Type:</label>
                <div style={{ color: '#ddd', fontSize: '14px', padding: '4px 0' }}>
                  {orderToModify.type}
                </div>
              </div>
              <div className="form-group">
                <label className="label">Action:</label>
                <div style={{ color: '#ddd', fontSize: '14px', padding: '4px 0' }}>
                  {orderToModify.action}
                </div>
              </div>
            </div>
            
            {/* Editable section with a different styling */}
            <div style={{ 
              background: '#2c3e50', 
              padding: '10px', 
              borderRadius: '4px',
              border: '1px solid #375a7f',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#4CAF50' }}>Modifiable Parameters</h4>
              
              <div className="form-group">
                <label className="label">Quantity:</label>
                <input
                  className="input"
                  type="number"
                  value={modifiedQuantity}
                  onChange={(e) => setModifiedQuantity(e.target.value)}
                  min="1"
                  step="1"
                  style={{ borderColor: '#4CAF50', background: '#1e2b38' }}
                />
              </div>
              {/* Only show limit price for pure Limit orders and MIT orders, not StopLimit */}
              {(orderToModify.type.toUpperCase() === 'LIMIT' || 
                orderToModify.type.toUpperCase() === 'MIT') && (
                <div className="form-group">
                  <label className="label">Limit Price:</label>
                  <input
                    className="input"
                    type="number"
                    value={modifiedLimitPrice}
                    onChange={(e) => setModifiedLimitPrice(e.target.value)}
                    min="0.01"
                    step="0.01"
                    style={{ borderColor: '#4CAF50', background: '#1e2b38' }}
                  />
                </div>
              )}
              {/* Show stop price for any order type that includes "STOP" */}
              {(orderToModify.type.toUpperCase().includes('STOP')) && (
                <div className="form-group">
                  <label className="label">Stop Price:</label>
                  <input
                    className="input"
                    type="number"
                    value={modifiedStopPrice}
                    onChange={(e) => setModifiedStopPrice(e.target.value)}
                    min="0.01"
                    step="0.01"
                    style={{ borderColor: '#4CAF50', background: '#1e2b38' }}
                  />
                </div>
              )}
            </div>
            
            <div className="button-group">
              <button className="button primary" onClick={handleSubmitModifiedOrder}>
                Submit Changes
              </button>
              <button className="button" onClick={handleCloseModifyOrderPopup}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TradeManager; 