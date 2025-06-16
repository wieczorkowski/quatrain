import WebSocket from 'ws';

class NinjaTraderService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectTimeout = null;
    this.listeners = {};
    this.serverUrl = 'ws://localhost:8079';
    this.reconnectDelay = 5000; // 5 seconds
  }

  /**
   * Add an event listener
   * @param {string} event - Event name
   * @param {function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {function} callback - Callback function
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Trigger an event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  /**
   * Connect to the NinjaTrader Bridge
   */
  connect() {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    
    // Close any existing connection
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }

    // Clear any reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Create new WebSocket connection
    this.ws = new WebSocket(this.serverUrl);

    // Connection opened
    this.ws.on('open', () => {
      console.log('Connected to NinjaTrader Bridge');
      this.isConnected = true;
      this.isConnecting = false;
      this.emit('connected', true);
    });

    // Connection closed
    this.ws.on('close', () => {
      console.log('Disconnected from NinjaTrader Bridge');
      this.isConnected = false;
      this.isConnecting = false;
      this.emit('connected', false);
      
      // Schedule reconnect
      this.scheduleReconnect();
    });

    // Connection error
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.isConnecting = false;
      
      // Schedule reconnect
      this.scheduleReconnect();
    });

    // Message received
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });
  }

  /**
   * Schedule reconnect
   */
  scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect to NinjaTrader Bridge...');
      this.connect();
    }, this.reconnectDelay);
  }

  /**
   * Disconnect from the NinjaTrader Bridge
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    this.emit('connected', false);
  }

  /**
   * Send a message to the NinjaTrader Bridge
   * @param {object} message - Message to send
   */
  send(message) {
    if (!this.isConnected || !this.ws) {
      console.error('Not connected to NinjaTrader Bridge');
      return;
    }
    
    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  /**
   * Handle incoming messages
   * @param {object} message - Received message
   */
  handleMessage(message) {
    switch (message.type) {
      case 'connectionStatus':
        this.emit('connectionStatus', message.connected);
        break;
        
      case 'accountList':
        this.emit('accountList', message.accounts);
        break;
        
      case 'accountDetails':
        this.emit('accountDetails', message.account);
        break;
        
      case 'accountsUpdate':
        this.emit('accountsUpdate', message.accounts);
        break;
        
      case 'error':
        console.error('Error from NinjaTrader Bridge:', message.message);
        this.emit('error', message.message);
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * Get the connection status
   * @returns {boolean} Connection status
   */
  isConnectedToNinjaTrader() {
    return this.isConnected;
  }

  /**
   * Get the list of accounts
   */
  getAccounts() {
    if (!this.isConnected) {
      console.error('Not connected to NinjaTrader Bridge');
      return;
    }
    
    this.send({ type: 'getAccounts' });
  }

  /**
   * Get account details
   * @param {string} accountId - Account ID
   */
  getAccountDetails(accountId) {
    if (!this.isConnected) {
      console.error('Not connected to NinjaTrader Bridge');
      return;
    }
    
    this.send({ 
      type: 'getAccountDetails',
      accountId
    });
  }
}

// Create singleton instance
const ninjaTraderService = new NinjaTraderService();

export default ninjaTraderService; 