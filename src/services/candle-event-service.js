/**
 * Candle Event Service
 * 
 * Tracks candle updates and detects when candles close,
 * emitting events that can be used for trade management.
 */

class CandleEventService {
  constructor() {
    // Store last candles for each symbol/timeframe
    this.lastCandles = new Map(); // key: `${symbol}_${timeframe}`, value: candle object
    // Store registered callbacks
    this.candleClosureCallbacks = new Set();
  }
  
  /**
   * Process a new candle update
   * @param {string} symbol The instrument symbol
   * @param {string} timeframe The candle timeframe (e.g., '1m', '5m', '15m')
   * @param {Object} candle The candle object with open, high, low, close, volume, timestamp
   * @returns {boolean} Whether a candle closure was detected
   */
  processCandle(symbol, timeframe, candle) {
    if (!symbol || !timeframe || !candle || !candle.timestamp) {
      console.error('CandleEventService: Invalid candle data', { symbol, timeframe, candle });
      return false;
    }
    
    const key = `${symbol}_${timeframe}`;
    const lastCandle = this.lastCandles.get(key);
    
    // If no previous candle, just store this one and return
    if (!lastCandle) {
      this.lastCandles.set(key, { ...candle });
      console.log(`CandleEventService: First candle for ${symbol} ${timeframe} stored`);
      return false;
    }
    
    // If this is the same candle (same timestamp), just update it and return
    if (lastCandle.timestamp === candle.timestamp) {
      this.lastCandles.set(key, { ...candle });
      return false;
    }
    
    // If this is a new candle (different timestamp), the last one has closed
    if (lastCandle.timestamp !== candle.timestamp) {
      // Store the new candle
      this.lastCandles.set(key, { ...candle });
      
      // Create closure event for the previous candle
      const closureEvent = {
        symbol,
        timeframe,
        candle: lastCandle,
        timestamp: Date.now(),
        // Include OHLC properties for convenience
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
        volume: lastCandle.volume || 0
      };
      
      console.log(`CandleEventService: Candle closed for ${symbol} ${timeframe}`, closureEvent);
      
      // Notify all registered callbacks
      this.notifyCandleClosure(closureEvent);
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Notify all registered callbacks of a candle closure
   * @param {Object} event The candle closure event
   */
  notifyCandleClosure(event) {
    if (this.candleClosureCallbacks.size === 0) {
      console.log('CandleEventService: No callbacks registered for candle closure events');
    } else {
      console.log(`CandleEventService: Notifying ${this.candleClosureCallbacks.size} callbacks of candle closure`);
      
      // Notify all callbacks
      this.candleClosureCallbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('CandleEventService: Error in candle closure callback', error);
        }
      });
    }
    
    // Ensure we have a properly formatted event with all required fields
    const completeEvent = {
      ...event,
      // Ensure these fields are always present
      symbol: event.symbol,
      timeframe: event.timeframe,
      timestamp: event.timestamp || event.candle.timestamp,
      open: event.open !== undefined ? event.open : event.candle.open,
      high: event.high !== undefined ? event.high : event.candle.high,
      low: event.low !== undefined ? event.low : event.candle.low,
      close: event.close !== undefined ? event.close : event.candle.close,
      volume: event.volume !== undefined ? event.volume : (event.candle.volume || 0)
    };
    
    // Try to send via IPC for cross-process communication
    try {
      const { ipcRenderer } = window.require('electron');
      console.log('CandleEventService: Sending candle-closed IPC event for', 
        `${completeEvent.symbol} ${completeEvent.timeframe}:`,
        `O: ${completeEvent.open}, H: ${completeEvent.high}, L: ${completeEvent.low}, C: ${completeEvent.close}`);
      
      ipcRenderer.send('candle-closed', completeEvent);
    } catch (error) {
      console.error('CandleEventService: Error sending candle-closed IPC event', error);
    }
  }
  
  /**
   * Register a callback for candle closure events
   * @param {Function} callback The callback function to call when a candle closes
   * @returns {Function} A function to unregister the callback
   */
  onCandleClosure(callback) {
    if (typeof callback !== 'function') {
      console.error('CandleEventService: Invalid callback', callback);
      return () => {}; // Return empty function
    }
    
    this.candleClosureCallbacks.add(callback);
    console.log('CandleEventService: Registered candle closure callback');
    
    // Return unsubscribe function
    return () => {
      this.candleClosureCallbacks.delete(callback);
      console.log('CandleEventService: Unregistered candle closure callback');
    };
  }
  
  /**
   * Clear all stored candles and callbacks
   */
  reset() {
    this.lastCandles.clear();
    this.candleClosureCallbacks.clear();
    console.log('CandleEventService: Reset');
  }
}

// Create a singleton instance
const candleEventService = new CandleEventService();

// Export the singleton instance
export default candleEventService; 