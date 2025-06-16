// NinjaTrader Bridge Service
// This module manages the WebSocket connection to NinjaTrader Bridge

// Singleton instance variables
let ntBridgeConnectionManagerInitialized = false;
let ntBridgeWebSocket = null;
let ntBridgeConnectionStatus = false;
let messageHandlers = [];
let reconnectTimer = null;
let ipcHandlersRegistered = false;
// State update callback array
let connectionStateCallbacks = [];

// Initialize the NT Bridge Connection Manager
export const initNTBridgeConnectionManager = (ipcRenderer) => {
  if (ntBridgeConnectionManagerInitialized) return;
  
  console.log('Initializing NinjaTrader Bridge Connection Manager');
  ntBridgeConnectionManagerInitialized = true;
  
  // Register IPC handlers if they haven't been registered yet
  if (!ipcHandlersRegistered) {
    console.log('Registering IPC handlers for NT Bridge Connection Manager');
    
    // Handle connect requests from other components
    ipcRenderer.on('nt-bridge-connect-request', () => {
      console.log('NT Bridge Connection Manager: Received connect request');
      connectToNTBridge();
    });
    
    // Handle disconnect requests from other components
    ipcRenderer.on('nt-bridge-disconnect-request', () => {
      console.log('NT Bridge Connection Manager: Received disconnect request');
      disconnectFromNTBridge();
    });
    
    // Handle send message requests from other components
    ipcRenderer.on('nt-bridge-send-request', (event, data) => {
      // Handle both formats: {requestId, message} and {message}
      const message = data.message;
      const requestId = data.requestId;
      
      // Add special logging for chart click orders
      if (message && message.type === 'place_order') {
        const isChartClick = !requestId; // Chart clicks come directly from main process without requestId
        console.log(`NT Bridge Connection Manager: Received ${isChartClick ? 'CHART CLICK' : 'regular'} order request:`, 
          message.action, message.orderType, message.symbol, 
          message.limitPrice || message.stopPrice);
      } else {
        console.log('NT Bridge Connection Manager: Received send request', 
          message?.type, requestId ? `(ID: ${requestId})` : '');
      }
      
      // Verify the socket connection before sending
      if (!ntBridgeWebSocket || ntBridgeWebSocket.readyState !== WebSocket.OPEN) {
        console.error('NT Bridge Connection Manager: Cannot send message - WebSocket not connected');
        
        // If a requestId is provided, send error response back
        if (requestId) {
          try {
            event.sender.send(`nt-bridge-send-response-${requestId}`, {
              success: false,
              error: 'WebSocket not connected to NinjaTrader Bridge',
              originalMessage: message
            });
          } catch (error) {
            console.error('Error sending response:', error);
          }
        } else {
          // Send general error response
          try {
            event.sender.send('nt-bridge-send-response', {
              success: false,
              error: 'WebSocket not connected to NinjaTrader Bridge',
              originalMessage: message
            });
          } catch (error) {
            console.error('Error sending general response:', error);
          }
        }
        return;
      }
      
      // Send the message to NinjaTrader Bridge
      const success = sendToNTBridge(message);
      
      // If a requestId is provided, send a response back to the sender
      if (requestId) {
        try {
          // Send response using the requestId
          event.sender.send(`nt-bridge-send-response-${requestId}`, {
            success,
            error: success ? null : 'Failed to send message to NinjaTrader Bridge',
            originalMessage: message
          });
        } catch (error) {
          console.error('Error sending response:', error);
        }
      } else {
        // Send response back to the requester (old format for backward compatibility)
        try {
          event.sender.send('nt-bridge-send-response', {
            success,
            error: success ? null : 'Failed to send message to NinjaTrader Bridge',
            originalMessage: message
          });
        } catch (error) {
          console.error('Error sending general response:', error);
        }
      }
    });
    
    // Handle status requests from other components
    ipcRenderer.on('nt-bridge-status-request', (event) => {
      console.log('NT Bridge Connection Manager: Received status request');
      event.sender.send('nt-bridge-connected', ntBridgeConnectionStatus);
    });
    
    ipcHandlersRegistered = true;
  }
  
  // Don't connect automatically at initialization
  // We'll connect only when the user explicitly requests it
};

// Connect to NinjaTrader Bridge
export const connectToNTBridge = () => {
  if (ntBridgeWebSocket && ntBridgeWebSocket.readyState === WebSocket.OPEN) {
    console.log('NT Bridge Connection Manager: Already connected');
    return;
  }
  
  if (ntBridgeWebSocket && ntBridgeWebSocket.readyState === WebSocket.CONNECTING) {
    console.log('NT Bridge Connection Manager: Already connecting');
    return;
  }
  
  // Clear any existing socket
  if (ntBridgeWebSocket) {
    try {
      ntBridgeWebSocket.terminate();
    } catch (e) {
      console.error('Error terminating existing socket:', e);
    }
    ntBridgeWebSocket = null;
  }
  
  // Clear any reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  // Update connection status
  updateConnectionStatus(false);
  
  // Create new WebSocket connection
  try {
    console.log('NT Bridge Connection Manager: Creating new WebSocket connection');
    ntBridgeWebSocket = new WebSocket('ws://localhost:8079');
    
    ntBridgeWebSocket.onopen = () => {
      console.log('NT Bridge Connection Manager: Connected to NinjaTrader Bridge');
      
      // Send connect message to the bridge
      ntBridgeWebSocket.send(JSON.stringify({ type: 'connect' }));
      
      // Update status AFTER we've sent the connect message
      updateConnectionStatus(true);
      
      // Request accounts list immediately after setting connected state
      console.log('NT Bridge Connection Manager: Requesting account list');
      ntBridgeWebSocket.send(JSON.stringify({ type: 'getAccounts' }));
    };
    
    ntBridgeWebSocket.onclose = (event) => {
      console.log(`NT Bridge Connection Manager: Connection closed. Code: ${event.code}, Reason: ${event.reason || 'none'}`);
      updateConnectionStatus(false);
      scheduleReconnect();
    };
    
    ntBridgeWebSocket.onerror = (error) => {
      console.error('NT Bridge Connection Manager: WebSocket error:', error);
      updateConnectionStatus(false);
      scheduleReconnect();
    };
    
    ntBridgeWebSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('NT Bridge Connection Manager: Received message:', message.type);
        
        // Broadcast message to all registered handlers
        for (const handler of messageHandlers) {
          try {
            handler(message);
          } catch (error) {
            console.error('Error in message handler:', error);
          }
        }
        
        // Also broadcast to all windows via IPC
        try {
          const { ipcRenderer } = window.require('electron');
          ipcRenderer.send('nt-bridge-message-broadcast', message);
        } catch (error) {
          console.error('Error broadcasting message via IPC:', error);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  } catch (error) {
    console.error('NT Bridge Connection Manager: Error connecting to NinjaTrader Bridge:', error);
    updateConnectionStatus(false);
    scheduleReconnect();
  }
};

// Disconnect from NinjaTrader Bridge
export const disconnectFromNTBridge = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  if (ntBridgeWebSocket) {
    try {
      ntBridgeWebSocket.close();
    } catch (e) {
      console.error('Error closing WebSocket:', e);
    }
    ntBridgeWebSocket = null;
  }
  
  updateConnectionStatus(false);
};

// Send message to NinjaTrader Bridge
export const sendToNTBridge = (message) => {
  // Check if we're sending a place_order message (might be from chart trader)
  const isOrderMessage = message && message.type === 'place_order';
  
  if (isOrderMessage) {
    console.log(`NT Bridge Connection Manager: About to send ${message.action} ${message.orderType} order for ${message.symbol}:`, message);
    
    // Validate stop orders
    if (message.orderType === 'MARKETSTOP' || message.orderType === 'LIMITSTOP') {
      if (message.stopPrice === undefined || message.stopPrice === null) {
        console.error(`NT Bridge Connection Manager: Missing stopPrice for ${message.orderType} order:`, message);
        return false;
      }
    }
    
    // Validate limit orders
    if (message.orderType === 'LIMIT' || message.orderType === 'LIMITSTOP') {
      if (message.limitPrice === undefined || message.limitPrice === null) {
        console.error(`NT Bridge Connection Manager: Missing limitPrice for ${message.orderType} order:`, message);
        return false;
      }
    }
    
  } else {
    console.log(`NT Bridge Connection Manager: About to send message of type: ${message?.type || 'unknown'}`);
  }
  
  // Add detailed debugging to help diagnose connection issues
  console.log(`Connection status: ${ntBridgeConnectionStatus}, Socket exists: ${!!ntBridgeWebSocket}, Socket state: ${ntBridgeWebSocket ? ntBridgeWebSocket.readyState : 'null'}`);
  
  if (!ntBridgeConnectionStatus || !ntBridgeWebSocket) {
    console.error('NT Bridge Connection Manager: Not connected. Message not sent:', JSON.stringify(message));
    return false;
  }
  
  if (ntBridgeWebSocket.readyState !== WebSocket.OPEN) {
    console.error(`NT Bridge Connection Manager: Socket exists but is not in OPEN state. Current state: ${ntBridgeWebSocket.readyState}`);
    return false;
  }
  
  try {
    const messageStr = JSON.stringify(message);
    console.log(`NT Bridge Connection Manager: Sending message: ${messageStr}`);
    ntBridgeWebSocket.send(messageStr);
    
    if (isOrderMessage) {
      console.log(`NT Bridge Connection Manager: Successfully sent ${message.action} ${message.orderType} order to NinjaTrader Bridge`);
    }
    
    return true;
  } catch (error) {
    console.error('NT Bridge Connection Manager: Error sending message:', error);
    return false;
  }
};

// Schedule reconnection to NinjaTrader Bridge
const scheduleReconnect = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  reconnectTimer = setTimeout(() => {
    console.log('NT Bridge Connection Manager: Attempting to reconnect...');
    connectToNTBridge();
  }, 5000); // 5 seconds delay
};

// Update connection status and notify all components
const updateConnectionStatus = (connected) => {
  if (ntBridgeConnectionStatus === connected) return;
  
  ntBridgeConnectionStatus = connected;
  console.log(`NT Bridge Connection Manager: Connection status updated to ${connected}`);
  
  // Call all registered callbacks with the new state
  connectionStateCallbacks.forEach(callback => {
    try {
      callback(connected);
    } catch (error) {
      console.error('Error in connection state callback:', error);
    }
  });
  
  // Notify all components via IPC
  try {
    const { ipcRenderer } = window.require('electron');
    ipcRenderer.send('nt-bridge-status-broadcast', connected);
  } catch (error) {
    console.error('Error broadcasting connection status via IPC:', error);
  }
};

// Register a connection state callback
export const registerConnectionStateCallback = (callback) => {
  connectionStateCallbacks.push(callback);
  return () => {
    // Return unregister function
    const index = connectionStateCallbacks.indexOf(callback);
    if (index !== -1) {
      connectionStateCallbacks.splice(index, 1);
    }
  };
};

// Register a message handler
export const registerMessageHandler = (handler) => {
  messageHandlers.push(handler);
  return () => {
    // Return unregister function
    const index = messageHandlers.indexOf(handler);
    if (index !== -1) {
      messageHandlers.splice(index, 1);
    }
  };
};

// Export a function to get the current connection status
export const getNTBridgeConnectionStatus = () => {
  return ntBridgeConnectionStatus;
} 