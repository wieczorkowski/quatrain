# Quatrain API Documentation

This document provides comprehensive API documentation for developers working with Quatrain's various systems and components.

## 📡 WebSocket Communication API

### Connection

Quatrain communicates with the Chronicle backend server via WebSocket connections.

#### Connection Setup
```javascript
const websocket = new WebSocket('ws://localhost:8080');

websocket.onopen = () => {
    console.log('Connected to Chronicle server');
};

websocket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleMessage(message);
};

websocket.onerror = (error) => {
    console.error('WebSocket error:', error);
};
```

### Message Format

All messages use JSON format with a message type (`mtyp`) field.

#### Request Messages

**Data Request**
```javascript
{
    "mtyp": "request",
    "symbol": "ES",
    "timeframes": ["1m", "5m", "15m", "1h"],
    "mode": "live",        // "live", "history", "replay"
    "startTime": "2024-01-01T00:00:00Z",  // Optional for history
    "endTime": "2024-01-02T00:00:00Z"     // Optional for history
}
```

**Settings Update**
```javascript
{
    "mtyp": "settings",
    "userId": "user123",
    "settings": {
        "theme": "dark",
        "defaultTimeframes": ["1m", "5m", "15m", "1h"]
    }
}
```

**Annotation Save**
```javascript
{
    "mtyp": "annotation",
    "action": "save",
    "annotation": {
        "id": "annotation-123",
        "type": "line",
        "timeframe": "5m",
        "coordinates": {...},
        "style": {...}
    }
}
```

#### Response Messages

**Data Response**
```javascript
{
    "mtyp": "data",
    "symbol": "ES",
    "timeframe": "1m",
    "mode": "live",
    "data": [
        {
            "timestamp": 1640995200000,
            "open": 4756.25,
            "high": 4758.50,
            "low": 4755.00,
            "close": 4757.75,
            "volume": 1250
        }
        // ... more OHLCV candles
    ]
}
```

**Error Response**
```javascript
{
    "mtyp": "error",
    "code": "INVALID_SYMBOL",
    "message": "Symbol 'INVALID' not found",
    "requestId": "req-123"
}
```

## 🔄 Shared Data Service API

The Shared Data Service enables communication between multiple Quatrain windows.

### Basic Usage

```javascript
import SharedDataClient from './services/SharedDataClient';

// Initialize client
const client = new SharedDataClient();

// Subscribe to data updates
const unsubscribe = client.subscribe('chartData', (data) => {
    console.log('Received chart data:', data);
    updateCharts(data);
});

// Publish data
client.publish('chartData', {
    symbol: 'ES',
    timeframe: '5m',
    data: ohlcvData
});

// Cleanup
unsubscribe();
```

### Available Data Channels

| Channel | Description | Data Format |
|---------|-------------|-------------|
| `chartData` | OHLCV chart data | `{ symbol, timeframe, data: OHLCV[] }` |
| `annotations` | Chart annotations | `{ timeframe, annotations: Annotation[] }` |
| `settings` | User settings | `{ userId, settings: Object }` |
| `trades` | Trading data | `{ account, positions: Position[], orders: Order[] }` |
| `sessions` | Trading sessions | `{ sessions: Session[] }` |

### Advanced Usage

```javascript
// Request specific data
client.request('chartData', { symbol: 'ES', timeframe: '1m' })
    .then(data => console.log('Received data:', data))
    .catch(error => console.error('Request failed:', error));

// Batch operations
client.batch([
    { action: 'publish', channel: 'chartData', data: chartData },
    { action: 'publish', channel: 'annotations', data: annotations }
]);

// Get current state
const currentData = client.getState('chartData');
```

## 🧪 User Studies API

### Study Interface

All user studies must implement the following interface:

```javascript
class StudyInterface {
    constructor() {
        // Required properties
        this.id = 'unique-study-id';
        this.name = 'Display Name';
        this.description = 'Study description';
        this.version = '1.0.0';
        this.author = 'Author Name';
        
        // Settings schema
        this.settings = {
            period: {
                type: 'number',
                default: 14,
                min: 1,
                max: 100,
                label: 'Period',
                description: 'Number of periods for calculation'
            },
            color: {
                type: 'color',
                default: '#FF6B35',
                label: 'Line Color'
            },
            enabled: {
                type: 'boolean',
                default: true,
                label: 'Enable Study'
            }
        };
        
        // Internal state
        this.annotations = new Map();
        this.lastDataLength = {};
        this.cache = new Map();
    }

    // Required methods
    updateData(chartData, sessions) {
        // Process new data and update annotations
    }

    updateSettings(newSettings) {
        // Handle settings changes
    }

    destroy() {
        // Cleanup resources
    }

    // Optional methods
    onTimeframeChange(timeframe) {
        // Handle timeframe changes
    }

    onSymbolChange(symbol) {
        // Handle symbol changes
    }
}
```

### Data Access

#### Chart Data Structure
```javascript
// chartData parameter structure
{
    "1m": [
        {
            timestamp: 1640995200000,
            open: 4756.25,
            high: 4758.50,
            low: 4755.00,
            close: 4757.75,
            volume: 1250
        }
        // ... more candles
    ],
    "5m": [...],
    "15m": [...],
    "1h": [...]
}
```

#### Sessions Data Structure
```javascript
// sessions parameter structure
[
    {
        id: "session-1",
        name: "London Session",
        startTime: "08:00",
        endTime: "17:00",
        timezone: "Europe/London",
        color: "#FF6B35",
        enabled: true
    }
    // ... more sessions
]
```

### Annotation Creation

```javascript
// Create line annotation
createLineAnnotation(timeframe, startPoint, endPoint, style = {}) {
    const annotation = {
        type: 'line',
        timeframe: timeframe,
        x1: startPoint.x,
        y1: startPoint.y,
        x2: endPoint.x,
        y2: endPoint.y,
        stroke: style.color || this.settings.color.default,
        strokeThickness: style.thickness || 2,
        strokeDashArray: style.dashArray || []
    };
    
    return this.addAnnotation(annotation);
}

// Create horizontal line
createHorizontalLine(timeframe, yValue, style = {}) {
    const annotation = {
        type: 'horizontalLine',
        timeframe: timeframe,
        y1: yValue,
        stroke: style.color || this.settings.color.default,
        strokeThickness: style.thickness || 1,
        labelPlacement: style.labelPlacement || 'TopLeft',
        showLabel: style.showLabel !== false,
        labelValue: style.label || yValue.toFixed(2)
    };
    
    return this.addAnnotation(annotation);
}

// Create text annotation
createTextAnnotation(timeframe, x, y, text, style = {}) {
    const annotation = {
        type: 'text',
        timeframe: timeframe,
        x1: x,
        y1: y,
        text: text,
        fontSize: style.fontSize || 12,
        fontFamily: style.fontFamily || 'Arial',
        fill: style.color || '#FFFFFF',
        textAlignment: style.alignment || 'Center'
    };
    
    return this.addAnnotation(annotation);
}
```

### Performance Optimization

```javascript
// Efficient data processing
updateData(chartData, sessions) {
    const timeframe = '1m';
    const data = chartData[timeframe];
    
    // Check for new data
    if (!data || data.length === this.lastDataLength[timeframe]) {
        return; // No new data
    }
    
    // Process only new candles
    const startIndex = this.lastDataLength[timeframe] || 0;
    const newCandles = data.slice(startIndex);
    
    // Use caching for expensive calculations
    const cacheKey = `${timeframe}-${data.length}`;
    if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
    }
    
    const result = this.calculateIndicator(newCandles);
    this.cache.set(cacheKey, result);
    
    this.lastDataLength[timeframe] = data.length;
    
    // Limit cache size
    if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
    }
}
```

## 💼 Trading API (NinjaTrader Integration)

### Connection Management

```javascript
// Connect to NinjaTrader Bridge
const connectToNinjaTrader = async () => {
    try {
        const response = await fetch('http://localhost:8079/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Connected to NinjaTrader:', data);
            return data;
        }
    } catch (error) {
        console.error('Connection failed:', error);
        throw error;
    }
};
```

### Account Information

```javascript
// Get account information
const getAccountInfo = async (accountId) => {
    const response = await fetch(`http://localhost:8079/accounts/${accountId}`);
    const account = await response.json();
    
    return {
        id: account.id,
        name: account.name,
        balance: account.balance,
        buyingPower: account.buyingPower,
        positions: account.positions,
        orders: account.orders
    };
};
```

### Order Management

```javascript
// Place market order
const placeMarketOrder = async (accountId, symbol, quantity, action) => {
    const order = {
        account: accountId,
        symbol: symbol,
        quantity: Math.abs(quantity),
        action: action, // "BUY" or "SELL"
        orderType: "MARKET",
        timeInForce: "DAY"
    };
    
    const response = await fetch('http://localhost:8079/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
    });
    
    return await response.json();
};

// Place limit order
const placeLimitOrder = async (accountId, symbol, quantity, action, price) => {
    const order = {
        account: accountId,
        symbol: symbol,
        quantity: Math.abs(quantity),
        action: action,
        orderType: "LIMIT",
        price: price,
        timeInForce: "DAY"
    };
    
    const response = await fetch('http://localhost:8079/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
    });
    
    return await response.json();
};

// Cancel order
const cancelOrder = async (orderId) => {
    const response = await fetch(`http://localhost:8079/orders/${orderId}`, {
        method: 'DELETE'
    });
    
    return await response.json();
};
```

### Position Management

```javascript
// Get current positions
const getPositions = async (accountId) => {
    const response = await fetch(`http://localhost:8079/accounts/${accountId}/positions`);
    const positions = await response.json();
    
    return positions.map(position => ({
        symbol: position.symbol,
        quantity: position.quantity,
        averagePrice: position.averagePrice,
        unrealizedPnL: position.unrealizedPnL,
        realizedPnL: position.realizedPnL
    }));
};

// Close position
const closePosition = async (accountId, symbol) => {
    const response = await fetch(`http://localhost:8079/accounts/${accountId}/positions/${symbol}/close`, {
        method: 'POST'
    });
    
    return await response.json();
};
```

## 🎨 UI Component API

### Chart Integration

```javascript
// Access chart surfaces
const chartSurfaces = sciChartSurfaceRefs.current;

// Get specific timeframe chart
const chart1m = chartSurfaces['1m'];
const chart5m = chartSurfaces['5m'];

// Add annotation to chart
const addAnnotationToChart = (timeframe, annotation) => {
    const chart = chartSurfaces[timeframe];
    if (chart && chart.annotations) {
        chart.annotations.add(annotation);
    }
};

// Remove annotation from chart
const removeAnnotationFromChart = (timeframe, annotationId) => {
    const chart = chartSurfaces[timeframe];
    if (chart && chart.annotations) {
        const annotation = chart.annotations.getById(annotationId);
        if (annotation) {
            chart.annotations.remove(annotation);
        }
    }
};
```

### Settings Management

```javascript
// Save user settings
const saveSettings = async (settings) => {
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            console.log('Settings saved successfully');
        }
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
};

// Load user settings
const loadSettings = async () => {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
        return null;
    }
};
```

## 🔧 Utility Functions

### Data Processing

```javascript
// Calculate Simple Moving Average
const calculateSMA = (data, period) => {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1)
            .reduce((acc, candle) => acc + candle.close, 0);
        result.push(sum / period);
    }
    return result;
};

// Calculate Exponential Moving Average
const calculateEMA = (data, period) => {
    const multiplier = 2 / (period + 1);
    const result = [data[0].close];
    
    for (let i = 1; i < data.length; i++) {
        const ema = (data[i].close * multiplier) + (result[i - 1] * (1 - multiplier));
        result.push(ema);
    }
    
    return result;
};

// Find highest/lowest values
const findHighLow = (data, period) => {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const high = Math.max(...slice.map(candle => candle.high));
        const low = Math.min(...slice.map(candle => candle.low));
        result.push({ high, low });
    }
    return result;
};
```

### Time Utilities

```javascript
// Convert timestamp to readable format
const formatTimestamp = (timestamp, timeframe) => {
    const date = new Date(timestamp);
    
    switch (timeframe) {
        case '1m':
        case '5m':
            return date.toLocaleTimeString();
        case '15m':
        case '1h':
            return date.toLocaleString();
        default:
            return date.toLocaleDateString();
    }
};

// Get timeframe duration in milliseconds
const getTimeframeDuration = (timeframe) => {
    const durations = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '30m': 30 * 60 * 1000,
        '1h': 60 * 60 * 1000
    };
    
    return durations[timeframe] || 60 * 1000;
};
```

## 🚨 Error Handling

### Standard Error Format

```javascript
class QuatrainError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'QuatrainError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

// Usage
throw new QuatrainError(
    'Failed to connect to Chronicle server',
    'WEBSOCKET_CONNECTION_FAILED',
    { url: 'ws://localhost:8080', retryCount: 3 }
);
```

### Error Codes

| Code | Description |
|------|-------------|
| `WEBSOCKET_CONNECTION_FAILED` | WebSocket connection failed |
| `INVALID_TIMEFRAME` | Invalid timeframe specified |
| `STUDY_LOAD_FAILED` | User study failed to load |
| `ANNOTATION_CREATE_FAILED` | Failed to create annotation |
| `NINJATRADER_CONNECTION_FAILED` | NinjaTrader bridge connection failed |
| `INVALID_ORDER_PARAMETERS` | Invalid order parameters |
| `INSUFFICIENT_PERMISSIONS` | Insufficient permissions for operation |

---

This API documentation provides the foundation for developing with Quatrain. For specific implementation examples, refer to the source code and example studies in the repository. 