# Quatrain Study Development Guide

## Overview

This guide provides comprehensive instructions for developing drop-in study modules for Quatrain. Studies are self-contained JavaScript modules that analyze trading data and create chart annotations or indicators.

## System Requirements and Setup

Before developing studies, ensure you understand the system requirements:

1. **JavaScript ES6+**: Studies are written in modern JavaScript
2. **SciChart Integration**: Studies create annotations using the SciChart library
3. **File Placement**: Studies must be placed in `src/userstudies/library/` directory
4. **Auto-Discovery**: Studies are automatically discovered and loaded by Quatrain
5. **Hot Reload**: Restart Quatrain to reload modified studies

### Enable User Studies System

The User Studies system is controlled by a killswitch in App.js:

```javascript
const ENABLE_USER_STUDIES = true; // Line 1 of App.js
```

When enabled, the system:
- Auto-discovers studies in `src/userstudies/library/`
- Provides a separate "User Studies" panel (distinct from "Indicators and Studies")
- Manages study lifecycle automatically
- Generates UI dynamically from study schemas

## Core Architecture

### Study Interface

Every Quatrain study must implement the following standardized interface:

```javascript
export default {
    // Core lifecycle methods
    initialize: (sciChartSurfaceRefs, timeframes, chartData, sessions) => {},
    updateData: (chartData, sessions) => {},
    destroy: () => {},
    
    // Settings management
    getSettings: () => {},
    updateSettings: (newSettings) => {},
    
    // UI configuration
    getUIConfig: () => {}
};
```

## Required Methods

### 1. initialize(sciChartSurfaceRefs, timeframes, chartData, sessions)

Called once when Quatrain is ready to initialize your study.

**Parameters:**
- `sciChartSurfaceRefs`: Object containing SciChart surface references by timeframe
- `timeframes`: Array of active timeframes (e.g., ['1m', '5m', '15m', '1h'])
- `chartData`: Object containing candle data by timeframe
- `sessions`: Array of trading session objects

**Implementation Pattern:**
```javascript
initialize(sciChartSurfaceRefs, timeframes, chartData, sessions) {
    this.sciChartSurfaceRefs = sciChartSurfaceRefs;
    this.timeframes = timeframes;
    this.chartData = chartData;
    this.sessions = sessions;
    
    console.log(`${this.getUIConfig().displayName} initialized`);
    
    // Perform initial calculations and create annotations
    this.calculateIndicators();
    this.createAnnotations();
}
```

### 2. updateData(chartData, sessions)

Called whenever new data arrives (live mode) or when replay data changes.

**Parameters:**
- `chartData`: Updated candle data object by timeframe
- `sessions`: Updated trading sessions array

**Implementation Pattern:**
```javascript
updateData(chartData, sessions) {
    if (!this.sciChartSurfaceRefs) return;
    
    this.chartData = chartData;
    this.sessions = sessions;
    
    // Recalculate indicators and update annotations
    this.calculateIndicators();
    this.updateAnnotations();
}
```

### 3. destroy()

Called when Quatrain is resetting or shutting down. Must clean up all annotations and resources.

**Implementation Pattern:**
```javascript
destroy() {
    this.removeAllAnnotations();
    
    // Clear any cached data
    this.chartData = null;
    this.sessions = null;
    this.sciChartSurfaceRefs = null;
    
    console.log(`${this.getUIConfig().displayName} destroyed`);
}
```

### 4. getSettings()

Returns current study settings object for UI initialization.

**Implementation Pattern:**
```javascript
getSettings() {
    return { ...this.settings }; // Return copy to prevent mutation
}
```

### 5. updateSettings(newSettings)

Called when user changes settings in the UI. Must apply changes and refresh annotations.

**CRITICAL**: The UI sends settings in **nested format** based on your schema sections, but your study should store settings in **flat format**. You must flatten the nested settings.

**Implementation Pattern:**
```javascript
updateSettings(newSettings) {
    console.log('[DEBUG] Received settings:', JSON.stringify(newSettings, null, 2));
    
    // CRITICAL: Flatten nested settings from UI schema to flat structure
    const flattenedSettings = { ...newSettings };
    
    // Handle each section defined in your UI schema
    if (newSettings.main) {
        Object.assign(flattenedSettings, newSettings.main);
        delete flattenedSettings.main;
    }
    
    if (newSettings.appearance) {
        Object.assign(flattenedSettings, newSettings.appearance);
        delete flattenedSettings.appearance;
    }
    
    // Add more sections as needed based on your schema...
    
    // Merge with existing settings
    this.settings = { ...this.settings, ...flattenedSettings };
    
    console.log('[DEBUG] Final flat settings:', JSON.stringify(this.settings, null, 2));
    
    // Refresh annotations with new settings
    if (this.sciChartSurfaceRefs) {
        this.removeAllAnnotations();
        if (this.settings.enabled) {
            this.createAnnotations();
        }
    }
}
```

### 6. getUIConfig()

Returns UI configuration schema for automatic UI generation.

**Implementation Pattern:**
```javascript
getUIConfig() {
    return {
        id: 'myStudy',
        displayName: 'My Custom Study',
        description: 'Brief description of what this study does',
        category: 'custom', // Groups studies in sidebar
        settingsSchema: [
            {
                type: 'section',
                title: 'Main Settings',
                key: 'main',  // CRITICAL: Creates nested structure {main: {...}}
                controls: [
                    {
                        key: 'enabled',
                        type: 'checkbox',
                        label: 'Enable Study',
                        tooltip: 'Turn the study on/off',
                        default: true
                    }
                ]
            },
            {
                type: 'section',
                title: 'Appearance',
                key: 'appearance',  // CRITICAL: Creates nested structure {appearance: {...}}
                controls: [
                    {
                        key: 'color',
                        type: 'color',
                        label: 'Line Color',
                        default: '#FF0000'
                    }
                ]
            }
        ]
    };
}
```

## Data Access Patterns

### Chart Data Structure

Quatrain provides candle data in the following structure:

```javascript
chartData = {
    '1m': [
        {
            timestamp: 1640995200000, // Unix timestamp in milliseconds
            open: 1.23456,
            high: 1.23567,
            low: 1.23234,
            close: 1.23345,
            volume: 1000
        },
        // ... more candles
    ],
    '5m': [...],
    '15m': [...],
    '1h': [...]
};
```

### Session Data Structure

Trading sessions are provided as:

```javascript
sessions = [
    {
        relativeNumber: 0,      // Current session
        startTime: 1640995200000,
        endTime: null,          // null if session is active
        duration: 3600000       // Duration in milliseconds
    },
    {
        relativeNumber: -1,     // Previous session
        startTime: 1640991600000,
        endTime: 1640995200000,
        duration: 3600000
    }
    // ... more sessions
];
```

### Accessing Different Timeframes

```javascript
// Get 1-minute data for detailed analysis
const oneMinData = this.chartData['1m'] || [];

// Get higher timeframe for broader patterns
const hourlyData = this.chartData['1h'] || [];

// Always check for data availability
if (oneMinData.length < 2) return;

// Data is sorted by timestamp (oldest first)
const latestCandle = oneMinData[oneMinData.length - 1];
const previousCandle = oneMinData[oneMinData.length - 2];
```

## Annotation Management

### Creating Annotations

Use SciChart annotation objects to visualize your analysis:

```javascript
import { 
    HorizontalLineAnnotation, 
    LineAnnotation, 
    BoxAnnotation, 
    TextAnnotation,
    ELabelPlacement 
} from 'scichart';

createHorizontalLine(price, color, label) {
    this.timeframes.forEach(timeframe => {
        const surface = this.sciChartSurfaceRefs[timeframe];
        if (!surface) return;
        
        const annotation = new HorizontalLineAnnotation({
            id: `myStudy_line_${Date.now()}_${timeframe}`,
            y1: price,
            stroke: color,
            strokeThickness: 2,
            showLabel: true,
            labelValue: label,
            labelPlacement: ELabelPlacement.BottomRight,
            xAxisId: 'xAxis',
            yAxisId: 'yAxis'
        });
        
        surface.annotations.add(annotation);
        this.annotations.push(annotation); // Track for cleanup
    });
}
```

### Annotation Best Practices

1. **Unique IDs**: Always use unique annotation IDs to prevent conflicts
2. **Track Annotations**: Store references for proper cleanup
3. **Multi-timeframe**: Apply annotations to all active timeframes
4. **Memory Management**: Call `.delete()` on WebGL annotations before removal

```javascript
removeAllAnnotations() {
    this.timeframes.forEach(timeframe => {
        const surface = this.sciChartSurfaceRefs[timeframe];
        if (!surface) return;

        // Remove all annotations with our prefix
        const annotationsToRemove = [];
        surface.annotations.asArray().forEach(annotation => {
            if (annotation.id && annotation.id.startsWith('myStudy_')) {
                annotationsToRemove.push(annotation);
            }
        });

        annotationsToRemove.forEach(annotation => {
            surface.annotations.remove(annotation);
            
            // Important: Delete WebGL resources
            if (annotation.delete) {
                annotation.delete();
            }
        });
    });
    
    this.annotations = [];
}
```

## UI Configuration Schema

### Settings Architecture

The User Studies system uses a **dual-layer settings architecture**:

1. **UI Layer**: Uses nested, sectioned settings schema for organized user interface
2. **Study Layer**: Uses flat settings object for simple study implementation  
3. **Translation Layer**: Your `updateSettings()` method must flatten nested UI settings

### Schema Structure

Settings are organized into **sections** that create nested structure in the UI:

```javascript
getUIConfig() {
    return {
        id: 'myStudy',
        displayName: 'My Study',
        settingsSchema: [
            {
                type: 'section',
                title: 'Main Settings',
                key: 'main',  // Creates nested structure: {main: {...}}
                controls: [
                    {
                        key: 'enabled',
                        type: 'checkbox',
                        label: 'Enable Study',
                        default: true
                    }
                ]
            },
            {
                type: 'section', 
                title: 'Appearance',
                key: 'appearance',  // Creates nested structure: {appearance: {...}}
                controls: [
                    {
                        key: 'color',
                        type: 'color',
                        label: 'Color',
                        default: '#FF0000'
                    }
                ]
            }
        ]
    };
}
```

**Result**: UI sends `{main: {enabled: true}, appearance: {color: "#FF0000"}}` but your study should store `{enabled: true, color: "#FF0000"}`.

### Control Types

The UI system supports the following control types:

#### Checkbox
```javascript
{
    key: 'enabled',
    type: 'checkbox',
    label: 'Enable Feature',
    tooltip: 'Optional explanation',
    default: true
}
```

#### Color Picker
```javascript
{
    key: 'lineColor',
    type: 'color',
    label: 'Line Color',
    default: '#FF0000'
}
```

#### Range Slider
```javascript
{
    key: 'opacity',
    type: 'range',
    label: 'Opacity',
    min: 0,
    max: 1,
    step: 0.1,
    showPercentage: true, // Shows value as percentage
    default: 0.5
}
```

#### Number Input
```javascript
{
    key: 'period',
    type: 'number',
    label: 'Period',
    suffix: 'bars', // Optional text after input
    min: 1,
    max: 200,
    default: 20
}
```

#### Select Dropdown
```javascript
{
    key: 'lineStyle',
    type: 'select',
    label: 'Line Style',
    options: [
        { value: 'solid', label: 'Solid' },
        { value: 'dashed', label: 'Dashed' },
        { value: 'dotted', label: 'Dotted' }
    ],
    default: 'solid'
}
```

#### Time Picker
```javascript
{
    key: 'startTime',
    type: 'time',
    label: 'Start Time',
    default: '09:30'
}
```

### Settings Data Flow

**From UI to Study (updateSettings)**:
- UI sends: `{main: {enabled: true}, appearance: {color: "#FF0000"}}`
- Study must flatten to: `{enabled: true, color: "#FF0000"}`

**From Study to UI (getSettings)**:
- Study returns: `{enabled: true, color: "#FF0000"}`  
- UI automatically maps flat settings to nested controls

**Critical**: Always implement proper flattening in your `updateSettings()` method!

## File Organization and Auto-Discovery

### Directory Structure

Studies must be placed in the correct directory for auto-discovery:

```
src/
├── userstudies/
│   ├── library/                    ← YOUR STUDIES GO HERE
│   │   ├── MyCustomStudy.js       ← Drop study files here
│   │   ├── AdvancedStrategy.js
│   │   └── HighLowTracker.js      ← Example study
│   ├── core/                      ← System files (don't modify)
│   │   ├── UserStudyRegistry.js
│   │   ├── UserStudyLoader.js
│   │   └── UserStudyLifecycle.js
│   └── components/                ← UI files (don't modify)
│       ├── UserStudiesPanel.js
│       └── UserStudyUI.js
```

### File Naming and Export Requirements

1. **File Location**: Must be in `src/userstudies/library/`
2. **File Extension**: Must use `.js` extension
3. **Export Pattern**: Must use `export default` with study instance
4. **Study ID**: Extracted from filename (e.g., `MyStudy.js` → `MyStudy`)

**Correct Export Pattern:**
```javascript
class MyCustomStudy {
    // ... implementation
}

// Export as default for Quatrain auto-discovery
export default new MyCustomStudy();
```

### Hot Reload and Development

1. **Modify Study**: Edit your study file in `src/userstudies/library/`
2. **Restart Quatrain**: Changes require Quatrain restart to take effect
3. **Check Loading**: Use browser console to see loading status
4. **Debug Issues**: Check User Studies panel for error messages

### Loading Status and Debugging

The system provides detailed loading information:

```javascript
// Console output shows:
// ✓ Successfully loaded user study: MyStudy
// ✗ Error loading user study BadStudy: Missing required method

// In User Studies panel:
// - Green status = study loaded successfully
// - Red status = loading errors (hover for details)
// - Reload button = refresh all studies
```

## Performance Guidelines

⚠️ **Critical**: User Studies run synchronously on the main JavaScript thread and can impact Quatrain's responsiveness. Following these guidelines is essential for maintaining good performance, especially when multiple studies are active.

### 1. **Implement Intelligent Caching**

Always cache calculation results to avoid unnecessary recomputation:

#### Basic Data Hash Caching
```javascript
class MyStudy {
    constructor() {
        this.calculationCache = new Map();
        this.lastDataHash = null;
    }
    
    updateData(chartData, sessions) {
        // Generate hash to detect actual data changes
        const dataHash = this.generateDataHash(chartData);
        
        if (this.lastDataHash === dataHash) {
            console.log('Data unchanged, skipping calculation');
            return; // Skip expensive recalculation
        }
        
        this.lastDataHash = dataHash;
        this.recalculate(chartData, sessions);
    }
    
    generateDataHash(chartData) {
        // Simple hash based on data length and last timestamp
        const relevantData = chartData['1m'] || [];
        if (relevantData.length === 0) return 'empty';
        
        const lastCandle = relevantData[relevantData.length - 1];
        return `${relevantData.length}-${lastCandle.timestamp}-${lastCandle.close}`;
    }
}
```

#### Per-Timeframe Caching
```javascript
updateData(chartData, sessions) {
    this.timeframes.forEach(timeframe => {
        const data = chartData[timeframe] || [];
        const cacheKey = `${timeframe}-${data.length}`;
        
        // Only recalculate if this timeframe's data changed
        if (this.calculationCache.has(cacheKey)) {
            return; // Use cached result
        }
        
        const result = this.expensiveCalculation(data);
        this.calculationCache.set(cacheKey, result);
    });
}
```

### 2. **Optimize Algorithm Complexity**

#### Use Efficient Data Structures
```javascript
// ❌ BAD: O(n²) complexity
calculateMovingAverage(data, period) {
    return data.map((_, index) => {
        if (index < period - 1) return null;
        
        let sum = 0;
        for (let i = index - period + 1; i <= index; i++) {
            sum += data[i].close; // Recalculating sum each time
        }
        return sum / period;
    });
}

// ✅ GOOD: O(n) complexity with sliding window
calculateMovingAverage(data, period) {
    const result = [];
    let sum = 0;
    
    // Initialize first window
    for (let i = 0; i < Math.min(period, data.length); i++) {
        sum += data[i].close;
    }
    
    for (let i = period - 1; i < data.length; i++) {
        if (i >= period) {
            // Slide window: remove old, add new
            sum = sum - data[i - period].close + data[i].close;
        }
        result.push(sum / period);
    }
    
    return result;
}
```

#### Limit Lookback Periods
```javascript
getUIConfig() {
    return {
        settingsSchema: [{
            key: 'lookbackPeriod',
            type: 'number',
            min: 1,
            max: 200, // ✅ Set reasonable maximums
            default: 20,
            tooltip: 'Higher values increase calculation time'
        }]
    };
}

calculateIndicator(data) {
    // ✅ Limit actual processing regardless of user setting
    const maxSafetyLimit = 500;
    const effectiveLookback = Math.min(this.settings.lookbackPeriod, maxSafetyLimit);
    
    const startIndex = Math.max(0, data.length - effectiveLookback);
    return this.processDataSlice(data.slice(startIndex));
}
```

### 3. **Implement Selective Timeframe Processing**

Only process timeframes relevant to your study:

```javascript
class MyStudy {
    getValidTimeframes() {
        // ✅ Only process timeframes that make sense for your study
        const timeframeOrder = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
        const maxTimeframe = this.settings.maxTimeframe || '1h';
        const maxIndex = timeframeOrder.indexOf(maxTimeframe);
        
        return this.timeframes.filter(tf => {
            const index = timeframeOrder.indexOf(tf);
            return index !== -1 && index <= maxIndex;
        });
    }
    
    updateData(chartData, sessions) {
        // ✅ Only process relevant timeframes
        const validTimeframes = this.getValidTimeframes();
        
        validTimeframes.forEach(timeframe => {
            this.processTimeframe(timeframe, chartData[timeframe]);
        });
    }
}
```

### 4. **Optimize Annotation Management**

#### Batch Annotation Operations
```javascript
// ❌ BAD: Multiple individual operations
removeOldAnnotations() {
    this.annotations.forEach(annotation => {
        surface.annotations.remove(annotation); // Multiple WebGL calls
    });
}

// ✅ GOOD: Batch operations
removeOldAnnotations() {
    const surface = this.sciChartSurfaceRefs[timeframe];
    const toRemove = [];
    
    // Collect first
    surface.annotations.asArray().forEach(annotation => {
        if (annotation.id && annotation.id.startsWith(this.annotationPrefix)) {
            toRemove.push(annotation);
        }
    });
    
    // Batch remove
    toRemove.forEach(annotation => {
        surface.annotations.remove(annotation);
        if (annotation.delete) annotation.delete(); // Free WebGL resources
    });
    
    // Single invalidation
    surface.invalidateElement();
}
```

#### Limit Annotation Count
```javascript
class MyStudy {
    constructor() {
        this.maxAnnotationsPerTimeframe = 50; // ✅ Set limits
        this.annotations = {};
    }
    
    addAnnotation(timeframe, annotation) {
        if (!this.annotations[timeframe]) {
            this.annotations[timeframe] = [];
        }
        
        // ✅ Remove oldest if at limit
        if (this.annotations[timeframe].length >= this.maxAnnotationsPerTimeframe) {
            const oldest = this.annotations[timeframe].shift();
            this.removeAnnotation(timeframe, oldest);
        }
        
        this.annotations[timeframe].push(annotation);
        surface.annotations.add(annotation);
    }
}
```

### 5. **Implement Incremental Updates**

Process only new data when possible:

```javascript
class MyStudy {
    constructor() {
        this.lastProcessedIndex = {};
    }
    
    updateData(chartData, sessions) {
        this.timeframes.forEach(timeframe => {
            const data = chartData[timeframe] || [];
            const lastIndex = this.lastProcessedIndex[timeframe] || 0;
            
            if (data.length <= lastIndex) return; // No new data
            
            // ✅ Only process new candles
            const newData = data.slice(lastIndex);
            this.processIncrementalUpdate(timeframe, newData, data);
            
            this.lastProcessedIndex[timeframe] = data.length;
        });
    }
    
    processIncrementalUpdate(timeframe, newCandles, allData) {
        // Process only the new candles and update indicators incrementally
        newCandles.forEach(candle => {
            this.updateIndicatorWithNewCandle(timeframe, candle);
        });
    }
}
```

### 6. **Memory Management Best Practices**

#### Proper Resource Cleanup
```javascript
destroy() {
    // ✅ Comprehensive cleanup
    console.log(`${this.getUIConfig().displayName} destroying...`);
    
    // Remove all annotations with proper WebGL cleanup
    this.removeAllAnnotations();
    
    // Clear caches
    this.calculationCache?.clear();
    this.annotations = {};
    this.lastProcessedIndex = {};
    
    // Null out references
    this.chartData = null;
    this.sessions = null;
    this.sciChartSurfaceRefs = null;
    
    // Clear any intervals/timeouts
    if (this.updateTimer) {
        clearInterval(this.updateTimer);
        this.updateTimer = null;
    }
}
```

#### Avoid Memory Leaks
```javascript
// ❌ BAD: Holding references to large objects
class MyStudy {
    updateData(chartData, sessions) {
        this.allHistoricalData = chartData; // Keeps growing!
        this.processData();
    }
}

// ✅ GOOD: Process and release
class MyStudy {
    updateData(chartData, sessions) {
        const processedResults = this.processData(chartData);
        this.updateAnnotations(processedResults);
        // Don't store the full chartData reference
    }
}
```

### 7. **Performance-Aware Settings Design**

Provide performance guidance to users:

```javascript
getUIConfig() {
    return {
        settingsSchema: [{
            type: 'section',
            title: 'Performance Settings',
            description: 'Higher values may impact chart performance',
            controls: [{
                key: 'complexity',
                type: 'select',
                label: 'Calculation Complexity',
                options: [
                    { value: 'low', label: 'Low (Fast)' },
                    { value: 'medium', label: 'Medium (Balanced)' },
                    { value: 'high', label: 'High (Slow but Accurate)' }
                ],
                default: 'medium',
                tooltip: 'Low: 20 periods, Medium: 50 periods, High: 100 periods'
            }]
        }]
    };
}

getEffectiveLookback() {
    const complexityMap = {
        'low': 20,
        'medium': 50,
        'high': 100
    };
    return complexityMap[this.settings.complexity] || 50;
}
```

### 8. **Early Exit Strategies**

Skip unnecessary processing:

```javascript
updateData(chartData, sessions) {
    // ✅ Early exits
    if (!this.settings.enabled) return;
    if (!this.sciChartSurfaceRefs) return;
    if (!chartData || Object.keys(chartData).length === 0) return;
    
    // Check if we have minimum required data
    const primaryData = chartData['1m'] || [];
    if (primaryData.length < this.getMinimumDataRequired()) {
        console.log(`${this.getUIConfig().displayName}: Insufficient data`);
        return;
    }
    
    this.performCalculations(chartData, sessions);
}

getMinimumDataRequired() {
    return Math.max(this.settings.lookbackPeriod || 20, 10);
}
```

### 9. **Computational Complexity Guidelines**

#### Target Complexities
```javascript
// ✅ Simple indicators (moving averages, etc.): O(n) where n ≤ 200
calculateSimpleMA(data, period) {
    // Linear time, single pass
}

// ✅ Complex indicators (bands, oscillators): O(n log n) maximum
calculateBollingerBands(data, period) {
    // May need sorting/statistical operations
}

// ❌ Avoid: O(n²) or higher complexity
// Don't do nested loops over large datasets
```

#### Performance Budgets
```javascript
// ✅ Target processing times per study:
// - Simple studies: < 5ms per update
// - Complex studies: < 20ms per update
// - Maximum acceptable: < 50ms per update

updateData(chartData, sessions) {
    const startTime = performance.now();
    
    try {
        this.performCalculations(chartData, sessions);
    } finally {
        const duration = performance.now() - startTime;
        
        if (duration > 10) {
            console.warn(`${this.getUIConfig().displayName}: Slow update ${duration.toFixed(2)}ms`);
        }
        
        if (duration > 50) {
            console.error(`${this.getUIConfig().displayName}: VERY SLOW update ${duration.toFixed(2)}ms`);
        }
    }
}
```

### 10. **Performance Testing and Monitoring**

#### Built-in Performance Monitoring
```javascript
class MyStudy {
    constructor() {
        this.performanceStats = {
            totalUpdates: 0,
            totalTime: 0,
            maxTime: 0,
            recentTimes: []
        };
    }
    
    updateData(chartData, sessions) {
        const startTime = performance.now();
        
        try {
            this.performCalculations(chartData, sessions);
        } finally {
            const duration = performance.now() - startTime;
            this.recordPerformance(duration);
        }
    }
    
    recordPerformance(duration) {
        this.performanceStats.totalUpdates++;
        this.performanceStats.totalTime += duration;
        this.performanceStats.maxTime = Math.max(this.performanceStats.maxTime, duration);
        
        // Keep last 10 measurements
        this.performanceStats.recentTimes.push(duration);
        if (this.performanceStats.recentTimes.length > 10) {
            this.performanceStats.recentTimes.shift();
        }
        
        // Log performance warnings
        if (duration > 20) {
            console.warn(`${this.getUIConfig().displayName}: Slow update ${duration.toFixed(2)}ms`);
        }
    }
    
    getPerformanceReport() {
        const stats = this.performanceStats;
        const avgTime = stats.totalTime / stats.totalUpdates;
        const recentAvg = stats.recentTimes.reduce((a, b) => a + b, 0) / stats.recentTimes.length;
        
        return {
            averageTime: avgTime.toFixed(2),
            maxTime: stats.maxTime.toFixed(2),
            recentAverage: recentAvg.toFixed(2),
            totalUpdates: stats.totalUpdates
        };
    }
}
```

### Performance Summary - Critical Guidelines

1. **Always implement caching** for expensive calculations
2. **Limit algorithm complexity** to O(n) or O(n log n) maximum  
3. **Process only relevant timeframes** for your study
4. **Use incremental updates** when possible
5. **Batch annotation operations** to reduce WebGL overhead
6. **Set reasonable limits** on user-configurable parameters
7. **Clean up resources properly** in destroy() method
8. **Provide early exits** for unnecessary processing
9. **Monitor performance** during development
10. **Design settings with performance in mind**

**Performance Targets:**
- **Simple studies**: < 5ms per update
- **Complex studies**: < 20ms per update  
- **Maximum acceptable**: < 50ms per update
- **Annotation limit**: < 100 per timeframe

Following these guidelines ensures your studies scale well and don't impact Quatrain's responsiveness, even when multiple studies are running simultaneously.

## Quatrain Integration Patterns

### Handling Different Data Modes

Your study must work with both Live and Replay data modes:

```javascript
updateData(chartData, sessions) {
    // Determine if we're in live or replay mode
    const isLiveMode = this.detectLiveMode(chartData);
    
    if (isLiveMode) {
        // Live mode: Update only the latest calculations
        this.updateLiveCalculations(chartData);
    } else {
        // Replay mode: Recalculate everything
        this.recalculateFromScratch(chartData);
    }
}

detectLiveMode(chartData) {
    const oneMin = chartData['1m'] || [];
    if (oneMin.length === 0) return false;
    
    const latest = oneMin[oneMin.length - 1];
    const now = Date.now();
    
    // If latest candle is within 5 minutes, likely live mode
    return (now - latest.timestamp) < 5 * 60 * 1000;
}
```

### Chart Layout Compatibility

Support all Quatrain chart configurations:

```javascript
initialize(sciChartSurfaceRefs, timeframes, chartData, sessions) {
    // Dynamically adapt to available timeframes
    this.timeframes = timeframes;
    
    // Log available chart layout
    console.log(`Study initialized with timeframes: ${timeframes.join(', ')}`);
    
    // Ensure your study works with any combination:
    // 4-way: ['1m', '5m', '15m', '1h']
    // 6-way: ['1m', '5m', '15m', '30m', '1h', '4h']
    // 6-way-long: ['5m', '15m', '30m', '1h', '4h', '1d']
}
```

### Session Integration

Leverage Quatrain's session tracking for time-based analysis:

```javascript
getCurrentSession() {
    return this.sessions.find(s => s.relativeNumber === 0);
}

getPreviousSession() {
    return this.sessions.find(s => s.relativeNumber === -1);
}

getSessionData(sessionNumber, timeframe = '1m') {
    const session = this.sessions.find(s => s.relativeNumber === sessionNumber);
    if (!session) return [];
    
    const data = this.chartData[timeframe] || [];
    return data.filter(candle => 
        candle.timestamp >= session.startTime &&
        (session.endTime ? candle.timestamp <= session.endTime : true)
    );
}
```

## Complete Production Example - HighLowTracker

Here's the complete HighLowTracker study that's actually running in production in Quatrain. This demonstrates all best practices and patterns:

```javascript
/**
 * High/Low Tracker Study v1.0
 * 
 * Description: Tracks the highest and lowest prices over a configurable lookback period
 * Author: Quatrain Development Team
 * Date: 2024-01-01
 * 
 * Installation: Drop this file into src/userstudies/library/ and restart Quatrain
 * 
 * Requirements: None
 * Performance: Very lightweight - only 2 annotations total per timeframe
 */

import { HorizontalLineAnnotation, ELabelPlacement } from 'scichart';

class HighLowTracker {
    constructor() {
        this.settings = {
            enabled: true,
            lookbackPeriod: 10,
            highColor: '#00FF00',
            lowColor: '#FF0000',
            lineStyle: 'solid',
            thickness: 2,
            showLabels: true
        };
        
        // Store annotations per timeframe
        this.annotations = {};
        
        this.sciChartSurfaceRefs = null;
        this.timeframes = [];
        this.chartData = {};
        this.sessions = [];
        
        // Cache for performance per timeframe
        this.lastCalculated = {};
    }

    /**
     * Get timeframes that are 30m and under
     */
    getValidTimeframes() {
        const timeframeOrder = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
        const maxIndex = timeframeOrder.indexOf('30m');
        
        return this.timeframes.filter(tf => {
            const index = timeframeOrder.indexOf(tf);
            return index !== -1 && index <= maxIndex;
        });
    }

    /**
     * Initialize the High/Low Tracker study
     */
    initialize(sciChartSurfaceRefs, timeframes, chartData, sessions) {
        this.sciChartSurfaceRefs = sciChartSurfaceRefs;
        this.timeframes = timeframes;
        this.chartData = chartData;
        this.sessions = sessions;
        
        console.log(`[USER-STUDIES] ${this.getUIConfig().displayName} initialized for timeframes:`, timeframes);
        console.log(`[USER-STUDIES] Valid timeframes (30m and under):`, this.getValidTimeframes());
        
        // Calculate and draw initial high/low
        if (this.settings.enabled) {
            this.calculateAndDraw();
        }
    }

    /**
     * Update with new data
     */
    updateData(chartData, sessions) {
        console.log('[USER-STUDIES] 🔄 HighLowTracker updateData called');
        console.log('[USER-STUDIES] 📊 Chart data keys:', Object.keys(chartData || {}));
        console.log('[USER-STUDIES] ⚙️ Current enabled setting:', this.settings.enabled);
        console.log('[USER-STUDIES] 🎯 SciChart refs available:', !!this.sciChartSurfaceRefs);
        
        this.chartData = chartData;
        this.sessions = sessions;
        
        if (this.settings.enabled && this.sciChartSurfaceRefs) {
            console.log('[USER-STUDIES] ✅ Calling calculateAndDraw from updateData');
            this.calculateAndDraw();
        } else {
            console.log('[USER-STUDIES] ❌ Skipping calculateAndDraw - enabled:', this.settings.enabled, 'refs:', !!this.sciChartSurfaceRefs);
        }
    }

    /**
     * Clean up and destroy
     */
    destroy() {
        console.log(`[USER-STUDIES] ${this.getUIConfig().displayName} destroying...`);
        this.removeAllAnnotations();
        this.chartData = null;
        this.sessions = null;
        this.sciChartSurfaceRefs = null;
        this.annotations = {};
        this.lastCalculated = {};
    }

    /**
     * Get current settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Update settings and refresh
     */
    updateSettings(newSettings) {
        console.log('[DEBUG] 🔧 HighLowTracker.updateSettings called');
        console.log('[DEBUG] 📝 Old settings:', JSON.stringify(this.settings, null, 2));
        console.log('[DEBUG] 📝 New settings:', JSON.stringify(newSettings, null, 2));
        
        const oldEnabled = this.settings.enabled;
        const oldHighColor = this.settings.highColor;
        const oldLowColor = this.settings.lowColor;
        const oldShowLabels = this.settings.showLabels;
        
        // Flatten nested settings from UI schema to match expected flat structure
        const flattenedSettings = { ...newSettings };
        
        // Handle main section settings
        if (newSettings.main) {
            Object.assign(flattenedSettings, newSettings.main);
            delete flattenedSettings.main;
        }
        
        // Handle appearance section settings  
        if (newSettings.appearance) {
            Object.assign(flattenedSettings, newSettings.appearance);
            delete flattenedSettings.appearance;
        }
        
        console.log('[DEBUG] 📝 Flattened settings:', JSON.stringify(flattenedSettings, null, 2));
        
        this.settings = { ...this.settings, ...flattenedSettings };
        
        console.log('[DEBUG] 📝 Merged settings:', JSON.stringify(this.settings, null, 2));
        
        const newEnabled = this.settings.enabled;
        const newHighColor = this.settings.highColor;
        const newLowColor = this.settings.lowColor;
        const newShowLabels = this.settings.showLabels;
        
        console.log('[DEBUG] 🔍 Setting changes detected:');
        console.log(`[DEBUG]   - enabled: ${oldEnabled} → ${newEnabled}`);
        console.log(`[DEBUG]   - highColor: ${oldHighColor} → ${newHighColor}`);
        console.log(`[DEBUG]   - lowColor: ${oldLowColor} → ${newLowColor}`);
        console.log(`[DEBUG]   - showLabels: ${oldShowLabels} → ${newShowLabels}`);
        
        if (this.sciChartSurfaceRefs) {
            console.log('[DEBUG] 🧹 Removing annotations and clearing cache');
            this.removeAllAnnotations();
            
            // Clear cache to force recalculation with new settings
            this.lastCalculated = {};
            
            if (this.settings.enabled) {
                console.log('[DEBUG] ✅ Study enabled, calling calculateAndDraw');
                this.calculateAndDraw();
            } else {
                console.log('[DEBUG] ❌ Study disabled, not calling calculateAndDraw');
            }
        } else {
            console.log('[DEBUG] ❌ No sciChartSurfaceRefs available in updateSettings');
        }
        
        console.log('[DEBUG] 🔧 HighLowTracker.updateSettings completed');
    }

    /**
     * Get UI configuration schema
     */
    getUIConfig() {
        return {
            id: 'highLowTracker',
            displayName: 'High/Low Tracker',
            description: 'Tracks highest and lowest prices over a configurable lookback period (30m timeframes and under)',
            category: 'examples',
            settingsSchema: [
                {
                    type: 'section',
                    title: 'Tracking Settings',
                    key: 'main',
                    controls: [
                        {
                            key: 'enabled',
                            type: 'checkbox',
                            label: 'Enable High/Low Tracker',
                            tooltip: 'Show/hide the high and low lines',
                            default: true
                        },
                        {
                            key: 'lookbackPeriod',
                            type: 'number',
                            label: 'Lookback Period',
                            suffix: 'candles',
                            min: 2,
                            max: 100,
                            tooltip: 'Number of candles to look back for high/low calculation (per timeframe)',
                            default: 10
                        }
                    ]
                },
                {
                    type: 'section',
                    title: 'Appearance',
                    key: 'appearance',
                    controls: [
                        {
                            key: 'highColor',
                            type: 'color',
                            label: 'High Line Color',
                            tooltip: 'Color of the high price line',
                            default: '#00FF00'
                        },
                        {
                            key: 'lowColor',
                            type: 'color',
                            label: 'Low Line Color',
                            tooltip: 'Color of the low price line',
                            default: '#FF0000'
                        },
                        {
                            key: 'lineStyle',
                            type: 'select',
                            label: 'Line Style',
                            options: [
                                { value: 'solid', label: 'Solid' },
                                { value: 'dashed', label: 'Dashed' },
                                { value: 'dotted', label: 'Dotted' }
                            ],
                            tooltip: 'Style of the high/low lines',
                            default: 'solid'
                        },
                        {
                            key: 'thickness',
                            type: 'number',
                            label: 'Line Thickness',
                            suffix: 'px',
                            min: 1,
                            max: 5,
                            tooltip: 'Thickness of the high/low lines',
                            default: 2
                        },
                        {
                            key: 'showLabels',
                            type: 'checkbox',
                            label: 'Show Labels',
                            tooltip: 'Display high/low value labels',
                            default: true
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Calculate high/low and draw on charts
     */
    calculateAndDraw() {
        console.log('[USER-STUDIES] 🔍 HighLowTracker calculateAndDraw called');
        
        const validTimeframes = this.getValidTimeframes();
        console.log(`[USER-STUDIES] 📊 Processing timeframes: ${validTimeframes.join(', ')}`);
        
        // Process each valid timeframe independently
        validTimeframes.forEach(timeframe => {
            const data = this.chartData[timeframe] || [];
            const surface = this.sciChartSurfaceRefs[timeframe];
            
            console.log(`[USER-STUDIES] 📊 Timeframe: ${timeframe}, data length: ${data.length}`);
            
            if (!surface) {
                console.log(`[USER-STUDIES] ❌ No surface for timeframe: ${timeframe}`);
                return;
            }
            
            if (data.length < this.settings.lookbackPeriod) {
                console.log(`[USER-STUDIES] ❌ Not enough data for ${timeframe}: ${data.length} < ${this.settings.lookbackPeriod}`);
                return;
            }

            // Check if we need to recalculate for this timeframe
            const lastCandle = data[data.length - 1];
            const lastTimestamp = lastCandle ? lastCandle.timestamp : 0;
            const cacheKey = timeframe;
            
            if (!this.lastCalculated[cacheKey]) {
                this.lastCalculated[cacheKey] = {};
            }
            
            const cache = this.lastCalculated[cacheKey];
            
            console.log(`[USER-STUDIES] 🔍 Cache check for ${timeframe} - Length: ${data.length} vs ${cache.length}, Timestamp: ${lastTimestamp} vs ${cache.timestamp}`);
            
            // Calculate high/low for this timeframe's data
            const { high, low } = this.calculateHighLow(data, this.settings.lookbackPeriod);
            
            console.log(`[USER-STUDIES] 📈 ${timeframe} - High: ${high}, Low: ${low}`);

            // Check if we need to update (data changed OR values changed)
            const dataChanged = data.length !== cache.length || lastTimestamp !== cache.timestamp;
            const valuesChanged = high !== cache.high || low !== cache.low;
            
            if (!dataChanged && !valuesChanged) {
                console.log(`[USER-STUDIES] 📋 No changes for ${timeframe}, skipping update`);
                return;
            }

            console.log(`[USER-STUDIES] 🔄 Updating ${timeframe} - Data changed: ${dataChanged}, Values changed: ${valuesChanged}`);

            // Remove existing annotations for this timeframe only
            this.removeTimeframeAnnotations(timeframe);

            // Update cache
            cache.length = data.length;
            cache.timestamp = lastTimestamp;
            cache.high = high;
            cache.low = low;

            // Draw high/low lines for this timeframe
            this.drawHighLowLines(timeframe, high, low);
        });
        
        console.log('[USER-STUDIES] ✅ HighLowTracker calculateAndDraw completed for all valid timeframes');
    }

    /**
     * Calculate high and low prices over the lookback period
     * @param {Array} data - Candle data
     * @param {number} lookbackPeriod - Number of candles to look back
     * @returns {Object} - {high, low} values
     */
    calculateHighLow(data, lookbackPeriod) {
        const startIndex = Math.max(0, data.length - lookbackPeriod);
        const relevantData = data.slice(startIndex);
        
        let high = relevantData[0].high;
        let low = relevantData[0].low;
        
        for (let i = 1; i < relevantData.length; i++) {
            if (relevantData[i].high > high) high = relevantData[i].high;
            if (relevantData[i].low < low) low = relevantData[i].low;
        }
        
        return { high, low };
    }

    /**
     * Draw high and low lines for a specific timeframe
     * @param {string} timeframe - The timeframe to draw on
     * @param {number} high - High price
     * @param {number} low - Low price
     */
    drawHighLowLines(timeframe, high, low) {
        const surface = this.sciChartSurfaceRefs[timeframe];
        if (!surface) return;

        // Create high line
        const highAnnotation = new HorizontalLineAnnotation({
            id: `highlow_high_${timeframe}_${Date.now()}`,
            y1: high,
            stroke: this.settings.highColor,
            strokeThickness: this.settings.thickness,
            strokeDashArray: this.getStrokeDashArray(),
            showLabel: this.settings.showLabels,
            labelPlacement: ELabelPlacement.BottomRight,
            labelValue: this.settings.showLabels ? `High: ${high.toFixed(2)}` : '',
            axisFontSize: 10,
            axisLabelStroke: '#000000',  // Black text for labels
            xAxisId: 'xAxis',
            yAxisId: 'yAxis'
        });

        // Create low line
        const lowAnnotation = new HorizontalLineAnnotation({
            id: `highlow_low_${timeframe}_${Date.now()}`,
            y1: low,
            stroke: this.settings.lowColor,
            strokeThickness: this.settings.thickness,
            strokeDashArray: this.getStrokeDashArray(),
            showLabel: this.settings.showLabels,
            labelPlacement: ELabelPlacement.BottomRight,
            labelValue: this.settings.showLabels ? `Low: ${low.toFixed(2)}` : '',
            axisFontSize: 10,
            axisLabelStroke: '#000000',  // Black text for labels
            xAxisId: 'xAxis',
            yAxisId: 'yAxis'
        });

        surface.annotations.add(highAnnotation);
        surface.annotations.add(lowAnnotation);

        // Store references for this timeframe
        if (!this.annotations[timeframe]) {
            this.annotations[timeframe] = {};
        }
        this.annotations[timeframe].high = highAnnotation;
        this.annotations[timeframe].low = lowAnnotation;
        
        console.log(`[USER-STUDIES] ✅ Added high/low annotations for ${timeframe}`);
    }

    /**
     * Get stroke dash array based on line style setting
     * @returns {Array} - Dash pattern array
     */
    getStrokeDashArray() {
        switch (this.settings.lineStyle) {
            case 'dashed':
                return [8, 4];
            case 'dotted':
                return [2, 2];
            default:
                return []; // Solid line
        }
    }

    /**
     * Remove all high/low annotations efficiently
     */
    removeAllAnnotations() {
        const validTimeframes = this.getValidTimeframes();
        
        validTimeframes.forEach(timeframe => {
            const surface = this.sciChartSurfaceRefs[timeframe];
            if (!surface) return;

            // Remove all annotations with our prefix
            const annotationsToRemove = [];
            surface.annotations.asArray().forEach(annotation => {
                if (annotation.id && annotation.id.startsWith('highlow_')) {
                    annotationsToRemove.push(annotation);
                }
            });

            annotationsToRemove.forEach(annotation => {
                surface.annotations.remove(annotation);
                if (annotation.delete) {
                    annotation.delete();
                }
            });
        });

        // Clear references
        this.annotations = {};
    }

    /**
     * Remove existing annotations for a specific timeframe
     * @param {string} timeframe - The timeframe to remove annotations for
     */
    removeTimeframeAnnotations(timeframe) {
        const surface = this.sciChartSurfaceRefs[timeframe];
        if (!surface) return;

        // Remove all annotations with our prefix
        const annotationsToRemove = [];
        surface.annotations.asArray().forEach(annotation => {
            if (annotation.id && annotation.id.startsWith('highlow_')) {
                annotationsToRemove.push(annotation);
            }
        });

        annotationsToRemove.forEach(annotation => {
            surface.annotations.remove(annotation);
            if (annotation.delete) {
                annotation.delete();
            }
        });
    }
}

// Export as default for Quatrain auto-discovery
export default new HighLowTracker();
```

## Debugging and Development

### Settings Debugging

Common settings issues and solutions:

**Issue**: Settings not updating in UI
- **Cause**: Study not returning flat settings from `getSettings()`
- **Solution**: Ensure `getSettings()` returns flat object with all settings

**Issue**: Study not receiving setting changes  
- **Cause**: `updateSettings()` not flattening nested settings from UI
- **Solution**: Implement proper flattening logic for each section

**Issue**: Controls showing wrong values
- **Cause**: Mismatch between section keys and control paths
- **Solution**: Verify section `key` matches the nested structure being sent

**Issue**: Study not refreshing when settings change
- **Cause**: Not calling calculation methods after settings update
- **Solution**: Always refresh display when enabled and surfaces available

### Console Logging

Use structured logging for debugging:

```javascript
console.group(`${this.getUIConfig().displayName} Debug`);
console.log('Chart Data:', this.chartData);
console.log('Sessions:', this.sessions);
console.log('Settings:', this.settings);
console.groupEnd();
```

### Error Handling

Implement robust error handling:

```javascript
updateData(chartData, sessions) {
    try {
        this.chartData = chartData;
        this.sessions = sessions;
        
        if (this.settings.enabled) {
            this.calculateAndDraw();
        }
    } catch (error) {
        console.error(`Error in ${this.getUIConfig().displayName}:`, error);
        // Don't crash Quatrain - degrade gracefully
    }
}
```

### Development Tips

1. **Hot Reload**: Restart Quatrain to test changes to user studies
2. **Data Validation**: Always check for data availability before processing
3. **Performance Monitoring**: Use `console.time()` for performance testing
4. **Memory Monitoring**: Check browser dev tools for memory leaks
5. **Cross-timeframe Testing**: Test with different chart layouts

## Accessing the User Studies System

### Opening the User Studies Panel

The User Studies panel is accessed through the Quatrain interface:

1. **Menu Integration**: Opens via IPC message `'open-user-studies'`
2. **Separate Panel**: Completely independent from "Indicators and Studies"
3. **Full-screen Modal**: 90% overlay with click-to-close functionality
4. **Auto-discovery**: Automatically loads studies from `src/userstudies/library/`

### Panel Features

- **Study Management**: Enable/disable individual studies
- **Dynamic Settings**: UI generated automatically from study schemas
- **Import/Export**: Save and restore study configurations
- **Reload Function**: Refresh studies without restarting Quatrain
- **Error Reporting**: Clear feedback on loading issues
- **Search and Filter**: Find studies by name, description, or category

## System Architecture Details

### App.js Integration

The User Studies system integrates minimally with App.js:

```javascript
// Line 1: Killswitch control
const ENABLE_USER_STUDIES = true;

// Lines 40-44: Conditional imports
let UserStudyManager = null;
let UserStudiesPanel = null;
if (ENABLE_USER_STUDIES) {
    UserStudyManager = require('./userstudies/UserStudyManager').default;
    UserStudiesPanel = require('./userstudies/components/UserStudiesPanel').default;
}

// Line 169: State management
const [showUserStudies, setShowUserStudies] = useState(false);

// Lines 814-815: Initialization
if (ENABLE_USER_STUDIES && UserStudyManager && !UserStudyManager.isInitialized()) {
    UserStudyManager.initialize(sciChartSurfaceRefs.current, currentTimeframes, chartData, sessions);
}

// Lines 2514-2515: Data updates
if (ENABLE_USER_STUDIES && UserStudyManager) {
    UserStudyManager.updateAllStudies(chartData, sessions);
}

// Lines 2991-2997: UI rendering
{ENABLE_USER_STUDIES && showUserStudies && UserStudiesPanel && (
    <UserStudiesPanel
        onClose={() => setShowUserStudies(false)}
        sciChartSurfaceRefs={sciChartSurfaceRefs.current}
        timeframes={timeframes}
        chartData={chartData}
        sessions={sessions}
    />
)}
```

### Complete Separation Strategy

The system maintains complete separation from existing studies:

1. **No Code Modification**: Existing studies remain untouched
2. **Separate Registry**: UserStudyRegistry is independent
3. **Different UI**: User Studies panel vs Indicators and Studies panel
4. **Isolated Lifecycle**: Independent initialization and cleanup
5. **Zero Interference**: Cannot affect existing study functionality

## Distribution and Deployment

Studies can be distributed as single `.js` files that users drop into their `src/userstudies/library/` directory. Include documentation comments in your study file:

```javascript
/**
 * My Custom Study v1.0
 * 
 * Description: This study analyzes price patterns and creates annotations
 * Author: Your Name
 * Date: 2024-01-01
 * 
 * Installation: Drop this file into src/userstudies/library/ and restart Quatrain
 * 
 * Requirements: None
 * Performance: Lightweight - suitable for real-time use
 */
```

This guide provides everything needed to create professional-quality studies that integrate seamlessly with Quatrain's architecture while maintaining high performance and reliability.
