# Quatrain Shared Data Service

## Overview

The Quatrain Shared Data Service is a centralized data management solution that enables efficient data sharing between multiple Electron windows in the Quatrain application. It consists of:

1. **Main Process Service**: A singleton data manager running in the Electron main process
2. **Client Adapters**: Interface code in each renderer process (window)
3. **Communication Protocol**: Structured API for windows to request and receive data

This architecture provides several benefits:
- **Centralized Data Store**: Single source of truth for all data
- **Memory Efficiency**: Data stored only once in the main process
- **Bandwidth Control**: Windows only receive the data they need
- **Real-time Updates**: Reactive updates using a subscription model

## Architecture

### Components

- **DataService** (`src/services/data-service.js`): Main process service that stores data and handles IPC communications
- **DataClient** (`src/services/data-client.js`): Client adapter for renderer processes to connect to the shared service
- **IPC Communication**: Uses Electron's IPC mechanism for data transfer between processes

### Data Flow

1. **Data Collection**: The main Quatrain window collects data (candles, market info, etc.) and pushes it to the shared service
2. **Data Storage**: The service stores data in memory, organized by channels (e.g., `candles:ESM5:1m`)
3. **Data Distribution**: Other windows subscribe to data channels and receive updates as data changes
4. **Data Requests**: Windows can request specific data on demand (e.g., historical candles)

## Using the Shared Data Service

### Initializing the Client

In any renderer process component that needs to access shared data, import and initialize `DataClient`:

```javascript
import DataClient from '../services/data-client';

function MyComponent() {
  // Create a ref to hold the DataClient instance
  const dataClientRef = useRef(null);
  
  // Initialize DataClient in a useEffect
  useEffect(() => {
    if (!dataClientRef.current) {
      dataClientRef.current = new DataClient();
      console.log('DataClient initialized');
    }
  }, []);

  // ... rest of component
}
```

### Getting Market Data

To get the current market data (instrument symbol and price):

```javascript
// Get market data (one-time)
async function fetchMarketData() {
  const marketData = await dataClientRef.current.getMarketData();
  console.log('Current market data:', marketData);
  // marketData = { currentSymbol: "ESM5", latestPrice: 5300.25, timestamp: 1622548800000 }
}

// Subscribe to market data updates
useEffect(() => {
  if (dataClientRef.current) {
    const unsubscribe = dataClientRef.current.subscribeToMarketData((data) => {
      console.log('Market data update:', data);
      // Update component state with new data
      setSymbol(data.currentSymbol);
      setPrice(data.latestPrice);
    });
    
    // Clean up subscription on unmount
    return () => unsubscribe();
  }
}, [dataClientRef.current]);
```

### Getting Candle Data

To get candle data for a specific instrument and timeframe:

```javascript
// Get candle data (one-time)
async function fetchCandles(instrument, timeframe) {
  const candles = await dataClientRef.current.getCandles(instrument, timeframe, { limit: 100 });
  console.log(`Retrieved ${candles.length} candles for ${instrument} ${timeframe}`);
  return candles;
}

// Subscribe to candle updates
function subscribeToCandles(instrument, timeframe) {
  if (dataClientRef.current) {
    const unsubscribe = dataClientRef.current.subscribeToCandles(instrument, timeframe, (candles) => {
      console.log(`Received candle update for ${instrument} ${timeframe}:`, candles);
      // Process new candle data
      updateChart(candles);
    });
    
    // Return unsubscribe function for cleanup
    return unsubscribe;
  }
}
```

### Using RxJS Observables

For components that prefer reactive programming, `DataClient` also provides observables:

```javascript
import { useEffect } from 'react';
import { useObservable } from 'rxjs-hooks';

function PriceDisplay() {
  const dataClient = useRef(new DataClient()).current;
  const marketData = useObservable(() => dataClient.observeMarketData(), null);
  
  return (
    <div>
      <h2>Current Price</h2>
      <p>{marketData?.currentSymbol}: ${marketData?.latestPrice}</p>
    </div>
  );
}
```

### Pushing Data to the Service

Components that generate or receive data can push it to the shared service:

```javascript
// Update market data
async function updateMarketData(symbol, price) {
  await dataClientRef.current.updateMarketData({
    currentSymbol: symbol,
    latestPrice: price
  });
}

// Add a new candle
async function addCandle(instrument, timeframe, candle) {
  const channel = `candles:${instrument}:${timeframe}`;
  await dataClientRef.current.push(channel, candle);
}
```

## Available Data Channels

The shared data service currently supports the following data channels:

### Market Data

- **Channel**: `market:data`
- **Data Format**: `{ currentSymbol: string, latestPrice: number, timestamp: number }`

### Candle Data

- **Channel Format**: `candles:<instrument>:<timeframe>`
- **Examples**: `candles:ESM5:1m`, `candles:ESM5:5m`, etc.
- **Timeframes**: `1m`, `5m`, `10m`, `15m`, `30m`, `1h`
- **Data Format**: `{ timestamp: number, open: number, high: number, low: number, close: number, volume: number }`

## Migration from Redux

Quatrain has fully migrated from Redux to the Shared Data Service for cross-window data sharing. This migration provides several benefits:

1. **Simplified Architecture**: Single mechanism for data sharing instead of dual Redux/IPC approach
2. **Better Performance**: Reduced IPC overhead by eliminating redundant data synchronization
3. **Memory Efficiency**: Data stored only once in the main process, not duplicated in each window's Redux store
4. **Cleaner Code**: Direct data access and subscriptions instead of Redux actions and selectors

The migration steps included:
1. Creating the `DataService` in the main process for centralized data management
2. Implementing `DataClient` for renderer processes to access the shared data
3. Removing Redux-specific code in components, using DataClient instead
4. Simplifying IPC handlers in main.js, focusing on shared data communication

Components now manage state independently through React hooks, while shared data is accessed through the `DataClient` API.

## Future Expansion

The shared data service can be expanded to include additional data types:

- **Annotations**: Chart annotations and drawings
- **Trading Information**: Order status, fills, positions
- **User Preferences**: Settings and preferences
- **Chart Configurations**: Chart layouts and indicators

## Performance Considerations

- The service is optimized for frequent small updates (like candle ticks)
- Large datasets (like historical candles) are transferred on demand
- Data is stored in memory for fast access
- Subscriptions notify only when relevant data changes

## Troubleshooting

Common issues and solutions:

1. **Data Not Updating**: Ensure the client is properly subscribed to the correct channel
2. **Missing Data**: Check if the data has been pushed to the correct channel
3. **Performance Issues**: Limit the amount of data requested at once

## Example: Trading Window Integration

The Trade Manager window uses the shared data service to get market data:

```javascript
// Inside TradeManager component
const [marketData, setMarketData] = useState({ currentSymbol: null, latestPrice: null });

useEffect(() => {
  if (dataClientRef.current) {
    // Subscribe to market data updates
    const unsubscribe = dataClientRef.current.subscribeToMarketData((data) => {
      setMarketData(data);
    });
    
    // Get initial market data
    dataClientRef.current.getMarketData().then(setMarketData);
    
    return unsubscribe;
  }
}, []);

// Use marketData.currentSymbol and marketData.latestPrice in the component
``` 