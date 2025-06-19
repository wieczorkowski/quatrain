/**
 * High/Low Tracker Study v2.0 - Plugin Architecture
 * 
 * Description: Tracks the highest and lowest prices over a configurable lookback period
 * Author: Quatrain Development Team
 * Date: 2024-01-01
 * Updated: 2024-12-XX - Converted to plugin architecture
 * 
 * Installation: Drop this file into /studies folder and reload or restart Quatrain
 * 
 * Requirements: None (dependencies injected by plugin system)
 * Performance: Very lightweight - only 2 annotations total per timeframe
 */

// Dependencies will be injected by the plugin system
// No imports needed - HorizontalLineAnnotation and ELabelPlacement are provided in sandbox

class HighLowTracker {
    constructor() {
        // Initialize with UI schema defaults instead of hardcoded values
        this.settings = this.getDefaultSettings();
        
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
     * Get default settings from UI schema
     * This ensures UI defaults are always applied, especially during hot reload
     */
    getDefaultSettings() {
        const config = this.getUIConfig();
        const defaults = {};
        
        // Extract defaults from UI schema
        this.extractDefaults(config.settingsSchema, defaults);
        
        console.log('[DEBUG] 🎛️ Extracted UI schema defaults:', defaults);
        return defaults;
    }

    /**
     * Recursively extract default values from UI schema
     */
    extractDefaults(schema, defaults, prefix = '') {
        if (!schema || !Array.isArray(schema)) return;
        
        schema.forEach(item => {
            if (item.type === 'section' && item.controls) {
                // Handle section with controls
                this.extractDefaults(item.controls, defaults, prefix);
            } else if (item.key && item.default !== undefined) {
                // Extract default value
                const key = prefix ? `${prefix}.${item.key}` : item.key;
                defaults[item.key] = item.default;
                console.log(`[DEBUG] 📋 Found default: ${item.key} = ${item.default}`);
            }
        });
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
            //axisLabelFill: 'transparent',  // No background fill
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
            //axisLabelFill: 'transparent',  // No background fill
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

// Export as object for plugin system compatibility
// Plugin system will detect this pattern and return the instance
const HighLowTrackerPlugin = new HighLowTracker();

// Return the plugin instance for the plugin loader
HighLowTrackerPlugin; 