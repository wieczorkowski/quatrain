import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Stores the CME symbol (e.g., "ESM5") of the instrument currently charted
  currentSymbol: null, 
  // Stores the latest closing price from the live candle update
  latestPrice: null, 
  // Could add more here later, like last candle timestamp, volume, etc.
};

export const marketDataSlice = createSlice({
  name: 'marketData',
  initialState,
  reducers: {
    // Action to update the current symbol and latest price
    // Expects payload like: { symbol: "ESM5", price: 5300.25 }
    setMarketData: (state, action) => {
      // Validate the payload before updating state
      if (!action.payload) {
        console.warn('[Reducer: setMarketData] Received null or undefined payload');
        return;
      }
      
      // Log inside the reducer (only in development)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Reducer: setMarketData] Action received', 
          {
            currentStateBefore: { ...state }, // Log state *before* update
            actionPayload: action.payload
          }
        );
      }
      
      // Validate the payload
      const hasValidSymbol = typeof action.payload.symbol === 'string' && action.payload.symbol.trim() !== '';
      const hasValidPrice = action.payload.price !== null && action.payload.price !== undefined && !isNaN(Number(action.payload.price));
      
      // Update state with validated data
      if (hasValidSymbol) {
        state.currentSymbol = action.payload.symbol;
      } else {
        console.warn('[Reducer: setMarketData] Invalid symbol in payload:', action.payload.symbol);
      }
      
      if (hasValidPrice) {
        state.latestPrice = action.payload.price;
      } else {
        console.warn('[Reducer: setMarketData] Invalid price in payload:', action.payload.price);
      }
      
      // Log after update (only in development)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Reducer: setMarketData] State after update', 
          { 
            currentStateAfter: { ...state } // Log state *after* update
          }
        );
      }
    },
    // Could add other actions like clearMarketData, etc.
  },
  // Add an extraReducers function to handle other actions if needed
  extraReducers: (builder) => {
    // This ensures proper handling of actions not explicitly defined in this slice
    // It's empty now but provides a place to handle other actions if needed
  }
});

// Export the action creators
export const { setMarketData } = marketDataSlice.actions;

// Export the reducer
export default marketDataSlice.reducer; 