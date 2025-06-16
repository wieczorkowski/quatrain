/**
 * Shared Data Service for Quatrain
 * 
 * This service maintains a centralized data store in the main process
 * that can be accessed by all renderer processes (windows).
 * It provides subscription-based and request-response patterns
 * for windows to receive and request data.
 */

class DataService {
  constructor() {
    this.candleStore = {}; // Candle data organized by instrument and timeframe
    this.subscribers = new Map(); // Map of channel -> Map of windowId -> subscriber info
    this.marketData = {
      currentSymbol: null,
      latestPrice: null,
      timestamp: null
    };
    
    // Add storage for trade annotations
    this.tradeAnnotations = [];
    
    // Add storage for Smart Stop settings
    this.smartStopSettings = {
      stopQtyFollowsPosition: false
    };
  }

  /**
   * Initialize the data service with IPC handlers
   * @param {Object} ipcMain Electron's ipcMain object
   */
  initialize(ipcMain) {
    // Register IPC handlers
    ipcMain.handle('data:subscribe', this.handleSubscription.bind(this));
    ipcMain.handle('data:request', this.handleDataRequest.bind(this));
    ipcMain.handle('data:push', this.handleDataPush.bind(this));

    console.log('DataService: Initialized and ready');
  }

  /**
   * Handle subscription requests from renderer processes
   * @param {Object} event IPC event
   * @param {Object} params Subscription parameters
   * @returns {boolean} Success status
   */
  handleSubscription(event, params) {
    const { channel, windowId } = params;
    const window = event.sender;

    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Map());
    }

    this.subscribers.get(channel).set(windowId, { window });
    
    // If subscribing to market data, send current data immediately
    if (channel === 'market:data') {
      window.send('data:update', {
        channel: 'market:data',
        data: this.marketData
      });
    }
    
    // If subscribing to trade annotations, send current annotations immediately
    if (channel === 'trade:annotations') {
      window.send('data:update', {
        channel: 'trade:annotations',
        data: this.tradeAnnotations
      });
    }
    
    // If subscribing to smart stop settings, send current settings immediately
    if (channel === 'smartstop:settings') {
      window.send('data:update', {
        channel: 'smartstop:settings',
        data: this.smartStopSettings
      });
    }

    console.log(`DataService: Window ${windowId} subscribed to ${channel}`);
    return true;
  }

  /**
   * Handle data requests from renderer processes
   * @param {Object} event IPC event
   * @param {Object} params Request parameters
   * @returns {Object|null} Requested data or null
   */
  handleDataRequest(event, params) {
    const { channel, windowId, query } = params;
    console.log(`DataService: Window ${windowId} requested data from ${channel}`, query);

    // Parse the channel to determine what data to return
    const [type, instrument, timeframe] = channel.split(':');

    if (type === 'candles') {
      return this.getCandlesForInstrument(instrument, timeframe, query);
    }
    
    if (channel === 'market:data') {
      return this.marketData;
    }
    
    // Return trade annotations if requested
    if (channel === 'trade:annotations') {
      return this.tradeAnnotations;
    }
    
    // Return Smart Stop settings if requested
    if (channel === 'smartstop:settings') {
      return this.smartStopSettings;
    }

    return null;
  }

  /**
   * Handle data pushed from renderer processes
   * @param {Object} event IPC event
   * @param {Object} params Push parameters
   * @returns {boolean} Success status
   */
  handleDataPush(event, params) {
    const { channel, data, windowId } = params;
    console.log(`DataService: Window ${windowId} pushed data to ${channel}`);

    // Handle different types of data
    if (channel === 'market:data') {
      this.updateMarketData(data);
      return true;
    }

    if (channel.startsWith('candles:')) {
      const [_, instrument, timeframe] = channel.split(':');
      this.addCandles(instrument, timeframe, data);
      return true;
    }
    
    // Handle trade annotations
    if (channel === 'trade:annotations') {
      this.updateTradeAnnotations(data);
      return true;
    }
    
    // Handle Smart Stop settings
    if (channel === 'smartstop:settings') {
      this.updateSmartStopSettings(data);
      return true;
    }

    return false;
  }

  /**
   * Update Smart Stop settings and notify subscribers
   * @param {Object} settings Smart Stop settings object
   */
  updateSmartStopSettings(settings) {
    if (!settings) return;
    
    // Update stored settings
    this.smartStopSettings = {
      ...this.smartStopSettings,
      ...settings
    };
    
    // Notify subscribers
    this.notifySubscribers('smartstop:settings', this.smartStopSettings);
    
    console.log('DataService: Updated Smart Stop settings:', this.smartStopSettings);
  }

  /**
   * Update trade annotations and notify subscribers
   * @param {Array} annotations Array of annotation objects
   */
  updateTradeAnnotations(annotations) {
    // Update stored annotations
    this.tradeAnnotations = annotations || [];
    
    // Notify subscribers
    this.notifySubscribers('trade:annotations', this.tradeAnnotations);
    
    console.log(`DataService: Updated ${this.tradeAnnotations.length} trade annotations`);
  }

  /**
   * Update market data and notify subscribers
   * @param {Object} data Market data object
   */
  updateMarketData(data) {
    // Update stored market data
    this.marketData = {
      ...this.marketData,
      ...data,
      timestamp: Date.now() // Add timestamp for tracking purposes
    };

    // Notify subscribers
    this.notifySubscribers('market:data', this.marketData);
  }

  /**
   * Add candles for a specific instrument and timeframe
   * @param {string} instrument Instrument symbol
   * @param {string} timeframe Timeframe
   * @param {Array|Object} candles Candle data to add
   */
  addCandles(instrument, timeframe, candles) {
    // Initialize storage structure if needed
    if (!this.candleStore[instrument]) {
      this.candleStore[instrument] = {};
    }
    
    if (!this.candleStore[instrument][timeframe]) {
      this.candleStore[instrument][timeframe] = [];
    }

    // Handle both single candle and candle array
    const candleArray = Array.isArray(candles) ? candles : [candles];
    
    // Add candles to store
    for (const candle of candleArray) {
      // Check if candle already exists by timestamp
      const existingIndex = this.candleStore[instrument][timeframe].findIndex(
        c => c.timestamp === candle.timestamp
      );

      if (existingIndex >= 0) {
        // Update existing candle
        this.candleStore[instrument][timeframe][existingIndex] = candle;
      } else {
        // Add new candle
        this.candleStore[instrument][timeframe].push(candle);
      }
    }

    // Sort candles by timestamp
    this.candleStore[instrument][timeframe].sort((a, b) => a.timestamp - b.timestamp);

    // Notify subscribers
    const channel = `candles:${instrument}:${timeframe}`;
    this.notifySubscribers(channel, candles);

    // If this is a 1m candle and it's the latest one, update market data
    if (timeframe === '1m') {
      const latestCandle = this.getLatestCandle(instrument, timeframe);
      if (latestCandle) {
        this.updateMarketData({
          currentSymbol: instrument,
          latestPrice: latestCandle.close,
          timestamp: latestCandle.timestamp
        });
      }
    }
  }

  /**
   * Get the latest candle for an instrument and timeframe
   * @param {string} instrument Instrument symbol
   * @param {string} timeframe Timeframe
   * @returns {Object|null} Latest candle or null
   */
  getLatestCandle(instrument, timeframe) {
    if (
      !this.candleStore[instrument] ||
      !this.candleStore[instrument][timeframe] ||
      this.candleStore[instrument][timeframe].length === 0
    ) {
      return null;
    }

    const candles = this.candleStore[instrument][timeframe];
    return candles[candles.length - 1];
  }

  /**
   * Get candles for an instrument
   * @param {string} instrument Instrument symbol
   * @param {string} timeframe Timeframe
   * @param {Object} query Query parameters (start, end, limit)
   * @returns {Array} Array of candles
   */
  getCandlesForInstrument(instrument, timeframe, query = {}) {
    if (
      !this.candleStore[instrument] ||
      !this.candleStore[instrument][timeframe]
    ) {
      return [];
    }

    let candles = this.candleStore[instrument][timeframe];

    // Apply query filters
    if (query.start) {
      candles = candles.filter(c => c.timestamp >= query.start);
    }

    if (query.end) {
      candles = candles.filter(c => c.timestamp <= query.end);
    }

    if (query.limit) {
      candles = candles.slice(-query.limit);
    }

    return candles;
  }

  /**
   * Notify subscribers of data updates
   * @param {string} channel Channel name
   * @param {*} data Data to send
   */
  notifySubscribers(channel, data) {
    if (!this.subscribers.has(channel)) {
      return;
    }

    this.subscribers.get(channel).forEach((subscriber, windowId) => {
      try {
        subscriber.window.send('data:update', {
          channel,
          data
        });
      } catch (error) {
        console.error(`DataService: Error notifying window ${windowId}:`, error);
        // Remove invalid subscribers
        this.subscribers.get(channel).delete(windowId);
      }
    });
  }

  /**
   * Unsubscribe a window from all channels
   * @param {string} windowId Window ID to unsubscribe
   */
  unsubscribeWindow(windowId) {
    this.subscribers.forEach((subscriberMap, channel) => {
      if (subscriberMap.has(windowId)) {
        subscriberMap.delete(windowId);
        console.log(`DataService: Window ${windowId} unsubscribed from ${channel}`);
      }
    });
  }
}

module.exports = DataService; 