/**
 * Data Client for Quatrain
 * 
 * Client adapter for renderer processes to connect to the shared data service
 * in the main process. Provides methods for subscribing to data updates and
 * requesting data on demand.
 */

// RxJS for reactive programming
import { BehaviorSubject } from 'rxjs';

// Only import ipcRenderer in Electron environment
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

class DataClient {
  constructor() {
    this.windowId = null;
    this.subscriptions = new Map();
    this.observables = new Map();
    this.callbacks = new Map();
    
    // Initialize window ID
    this.initializeWindowId();
    
    // Setup IPC event listeners
    if (ipcRenderer) {
      ipcRenderer.on('data:update', this.handleDataUpdate.bind(this));
    }
  }

  /**
   * Initialize window ID for tracking subscriptions
   */
  async initializeWindowId() {
    if (ipcRenderer) {
      try {
        // Use syncronous call to get window ID
        this.windowId = ipcRenderer.sendSync('get-window-id');
        console.log(`DataClient: Initialized with window ID ${this.windowId}`);
      } catch (error) {
        console.error('DataClient: Error getting window ID:', error);
        // Fallback to random ID
        this.windowId = `window-${Math.random().toString(36).substr(2, 9)}`;
      }
    }
  }

  /**
   * Handle data updates from the main process
   * @param {Object} event IPC event
   * @param {Object} message Update message
   */
  handleDataUpdate(event, message) {
    const { channel, data } = message;
    
    // Update observable if exists
    if (this.observables.has(channel)) {
      this.observables.get(channel).next(data);
    }
    
    // Call registered callbacks
    if (this.callbacks.has(channel)) {
      this.callbacks.get(channel).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`DataClient: Error in callback for ${channel}:`, error);
        }
      });
    }
  }

  /**
   * Subscribe to a data channel
   * @param {string} channel Channel to subscribe to
   * @param {Function} callback Callback function to call when data updates
   * @returns {Function} Unsubscribe function
   */
  subscribe(channel, callback) {
    if (!ipcRenderer) {
      console.error('DataClient: Cannot subscribe, not in Electron environment');
      return () => {};
    }
    
    // Register the callback
    if (!this.callbacks.has(channel)) {
      this.callbacks.set(channel, new Set());
    }
    this.callbacks.get(channel).add(callback);
    
    // Send subscription to main process if not already subscribed
    if (!this.subscriptions.has(channel)) {
      ipcRenderer.invoke('data:subscribe', {
        channel,
        windowId: this.windowId
      }).then(success => {
        if (success) {
          this.subscriptions.set(channel, true);
          console.log(`DataClient: Subscribed to ${channel}`);
        } else {
          console.error(`DataClient: Failed to subscribe to ${channel}`);
        }
      }).catch(error => {
        console.error(`DataClient: Error subscribing to ${channel}:`, error);
      });
    }
    
    // Return unsubscribe function
    return () => {
      if (this.callbacks.has(channel)) {
        this.callbacks.get(channel).delete(callback);
      }
    };
  }

  /**
   * Get an observable for a data channel
   * @param {string} channel Channel to observe
   * @returns {BehaviorSubject} Observable for the channel
   */
  observe(channel) {
    // Create a new observable if it doesn't exist
    if (!this.observables.has(channel)) {
      const subject = new BehaviorSubject(null);
      this.observables.set(channel, subject);
      
      // Subscribe to the channel
      this.subscribe(channel, data => {
        subject.next(data);
      });
    }
    
    return this.observables.get(channel);
  }

  /**
   * Request data from the main process
   * @param {string} channel Channel to request data from
   * @param {Object} query Query parameters
   * @returns {Promise<*>} Requested data
   */
  async request(channel, query = {}) {
    if (!ipcRenderer) {
      console.error('DataClient: Cannot request data, not in Electron environment');
      return null;
    }
    
    try {
      const data = await ipcRenderer.invoke('data:request', {
        channel,
        windowId: this.windowId,
        query
      });
      
      return data;
    } catch (error) {
      console.error(`DataClient: Error requesting data from ${channel}:`, error);
      return null;
    }
  }

  /**
   * Push data to the main process
   * @param {string} channel Channel to push data to
   * @param {*} data Data to push
   * @returns {Promise<boolean>} Success status
   */
  async push(channel, data) {
    if (!ipcRenderer) {
      console.error('DataClient: Cannot push data, not in Electron environment');
      return false;
    }
    
    try {
      const success = await ipcRenderer.invoke('data:push', {
        channel,
        windowId: this.windowId,
        data
      });
      
      return success;
    } catch (error) {
      console.error(`DataClient: Error pushing data to ${channel}:`, error);
      return false;
    }
  }

  /**
   * Request candles for a specific instrument and timeframe
   * @param {string} instrument Instrument symbol
   * @param {string} timeframe Timeframe
   * @param {Object} query Query parameters (start, end, limit)
   * @returns {Promise<Array>} Array of candles
   */
  async getCandles(instrument, timeframe, query = {}) {
    const channel = `candles:${instrument}:${timeframe}`;
    return this.request(channel, query);
  }

  /**
   * Subscribe to candle updates for a specific instrument and timeframe
   * @param {string} instrument Instrument symbol
   * @param {string} timeframe Timeframe
   * @param {Function} callback Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribeToCandles(instrument, timeframe, callback) {
    const channel = `candles:${instrument}:${timeframe}`;
    return this.subscribe(channel, callback);
  }

  /**
   * Get the latest market data
   * @returns {Promise<Object>} Market data
   */
  async getMarketData() {
    return this.request('market:data');
  }

  /**
   * Subscribe to market data updates
   * @param {Function} callback Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribeToMarketData(callback) {
    return this.subscribe('market:data', callback);
  }

  /**
   * Get an observable for market data
   * @returns {BehaviorSubject} Observable for market data
   */
  observeMarketData() {
    return this.observe('market:data');
  }

  /**
   * Update market data
   * @param {Object} data Market data
   * @returns {Promise<boolean>} Success status
   */
  async updateMarketData(data) {
    return this.push('market:data', data);
  }
}

export default DataClient; 