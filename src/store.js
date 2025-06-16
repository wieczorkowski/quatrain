import { configureStore } from '@reduxjs/toolkit';
import marketDataReducer from './features/marketData/marketDataSlice';
import { createElectronStore } from './utils/electronStore';

// Create a store enhancer that syncs actions between Electron windows
const { electronStoreEnhancer } = createElectronStore();

export const store = configureStore({
  reducer: {
    // Add reducers from slices here
    marketData: marketDataReducer,
    // Example: if you had a tradeManager slice, you'd add it:
    // tradeManager: tradeManagerReducer, 
  },
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware({
      // Configure middleware options
      serializableCheck: {
        // Ignore specific action types if they contain non-serializable values
        ignoredActions: ['redux-state-sync'],
      },
    }),
  enhancers: [electronStoreEnhancer],
  // Add development-only error handling and logging
  devTools: process.env.NODE_ENV !== 'production',
});

// Type definitions removed for JavaScript project
// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch; 