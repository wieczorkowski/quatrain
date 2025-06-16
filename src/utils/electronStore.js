/**
 * Redux state synchronization for Electron windows
 * This implementation forwards Redux actions between windows to keep state in sync
 */

// Only import ipcRenderer in Electron environment
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

// Action types for sync
const SYNC_ACTION_TYPE = 'REDUX_ACTION_SYNC';
const SYNC_STATE_TYPE = 'REDUX_STATE_SYNC';
const REQUEST_STATE_TYPE = 'REDUX_REQUEST_STATE';

/**
 * Creates a Redux store enhancer that synchronizes actions between Electron windows
 */
export const createElectronStore = () => {
  let storeRef = null;
  
  // Only setup IPC communication in Electron environment
  if (ipcRenderer) {
    // Setup IPC listeners when the enhancer is created
    
    // Listen for actions dispatched in other windows
    ipcRenderer.on('redux-action-forward', (event, action) => {
      // Only process if we have a store reference and it's not a sync action to avoid loops
      if (storeRef && action.type !== SYNC_ACTION_TYPE) {
        try {
          // Validate the action before dispatching
          if (action && typeof action.type === 'string') {
            storeRef.dispatch(action);
          } else {
            console.warn('Received invalid action via IPC:', action);
          }
        } catch (error) {
          console.error('Error dispatching forwarded action:', error);
        }
      }
    });
    
    // Listen for state sync requests from other windows
    ipcRenderer.on('redux-request-state', () => {
      // Send our current state to the requesting window
      if (storeRef) {
        try {
          ipcRenderer.send('redux-state-sync', storeRef.getState());
        } catch (error) {
          console.error('Error sending state sync response:', error);
        }
      }
    });
    
    // Listen for full state updates (used for initial sync)
    ipcRenderer.on('redux-state-sync', (event, state) => {
      if (storeRef) {
        try {
          // Use a special action type that will replace the entire state
          storeRef.dispatch({
            type: SYNC_STATE_TYPE,
            payload: state
          });
        } catch (error) {
          console.error('Error dispatching state sync action:', error);
        }
      }
    });
    
    // Request initial state from other windows
    try {
      ipcRenderer.send('redux-request-state');
    } catch (error) {
      console.error('Error requesting initial state:', error);
    }
  }
  
  // Create the store enhancer
  const electronStoreEnhancer = createStore => (rootReducer, preloadedState, enhancer) => {
    // Create a wrapper reducer that can handle the sync state action
    const syncReducer = (state, action) => {
      try {
        if (action.type === SYNC_STATE_TYPE && action.payload) {
          // Replace the entire state with the one from another window
          return action.payload;
        }
        
        // Otherwise use the normal reducer
        return rootReducer(state, action);
      } catch (error) {
        console.error('Error in syncReducer:', error);
        // Return previous state on error
        return state;
      }
    };
    
    // Create the store with our enhanced reducer
    const store = createStore(syncReducer, preloadedState, enhancer);
    storeRef = store;
    
    // Enhance the dispatch method to forward actions to other windows
    const originalDispatch = store.dispatch;
    store.dispatch = action => {
      try {
        // Call the original dispatch first
        const result = originalDispatch(action);
        
        // If we're in Electron and this isn't a sync action (to avoid loops)
        if (
          ipcRenderer && 
          action && 
          typeof action.type === 'string' &&
          action.type !== SYNC_ACTION_TYPE && 
          action.type !== SYNC_STATE_TYPE
        ) {
          // Forward the action to the main process to be sent to other windows
          try {
            ipcRenderer.send('redux-action-forward', action);
          } catch (error) {
            console.error('Error forwarding action to main process:', error);
          }
        }
        
        return result;
      } catch (error) {
        console.error('Error in enhanced dispatch:', error, action);
        throw error; // Re-throw to maintain Redux error handling
      }
    };
    
    return store;
  };
  
  return {
    electronStoreEnhancer,
    // We don't need preloaded state as we request it on init
    rehydratedState: {}
  };
}; 