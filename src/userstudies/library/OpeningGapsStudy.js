/**
 * Opening Gaps Study v1.0 (User Study)
 * 
 * Description: Tracks New Day Opening Gaps (NDOG), New Week Opening Gaps (NWOG), 
 *             and Event Horizon Price Delivery Array (EHPDA) levels based on ICT methodology
 * Author: Quatrain Development Team
 * Date: 2024-01-01
 * 
 * Installation: Drop this file into src/userstudies/library/ and restart Quatrain
 * 
 * Requirements: None
 * Performance: Efficient gap detection with proper WebGL memory management
 */

import { BoxAnnotation, LineAnnotation, TextAnnotation } from 'scichart';

class OpeningGapsStudy {
    constructor() {
        this.settings = {
            enabled: true,
            showNDOG: false, // Default unchecked
            ndogAmount: 5,
            ndogBullishColor: '#FFD700', // Medium yellow for NDOG bullish
            ndogBearishColor: '#FFD700', // Medium yellow for NDOG bearish
            showNWOG: true, // Default checked
            nwogAmount: 5,
            nwogBullishColor: '#ba68c8', // Magenta for NWOG bullish
            nwogBearishColor: '#ba68c8', // Magenta for NWOG bearish
            showEHPDA: true,
            paneLabels: true,
            ehpdaColor: '#808080', // Gray for EHPDA
        };
        
        this.sciChartSurfaceRefs = null;
        this.timeframes = [];
        this.chartData = {};
        this.sessions = [];
        
        // Storage for detected gaps and annotations
        this.ndogGaps = []; // Array of {timestamp, high, low, mid, type: 'bullish'|'bearish'}
        this.nwogGaps = []; // Array of {timestamp, high, low, mid, type: 'bullish'|'bearish'}
        this.ehpdaLevels = []; // Array of {timestamp, level}
        
        // Annotation tracking for cleanup
        this.gapAnnotations = []; // Box and line annotations for gaps
        this.ehpdaAnnotations = []; // Line annotations for EHPDA
    }
    
    /**
     * Initialize the Opening Gaps study
     */
    initialize(sciChartSurfaceRefs, timeframes, chartData, sessions) {
        this.sciChartSurfaceRefs = sciChartSurfaceRefs;
        this.timeframes = timeframes;
        this.chartData = chartData;
        this.sessions = sessions;
        
        console.log(`[USER-STUDIES] ${this.getUIConfig().displayName} initialized`);
        
        if (this.settings.enabled) {
            this.updateData(chartData, sessions);
        }
    }
    
    /**
     * Update with new data
     */
    updateData(chartData, sessions) {
        if (!this.sciChartSurfaceRefs || !chartData) return;
        
        this.chartData = chartData;
        this.sessions = sessions;
        
        if (this.settings.enabled) {
            this.detectGaps();
            this.calculateEHPDA();
            this.updateAnnotations();
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
        this.ndogGaps = [];
        this.nwogGaps = [];
        this.ehpdaLevels = [];
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
        console.log('[DEBUG] 🔧 OpeningGapsStudy.updateSettings called');
        console.log('[DEBUG] 📝 New settings:', JSON.stringify(newSettings, null, 2));
        
        // Flatten nested settings from UI schema to match expected flat structure
        const flattenedSettings = { ...newSettings };
        
        // Handle main section settings
        if (newSettings.main) {
            Object.assign(flattenedSettings, newSettings.main);
            delete flattenedSettings.main;
        }
        
        // Handle ndog section settings
        if (newSettings.ndog) {
            Object.assign(flattenedSettings, newSettings.ndog);
            delete flattenedSettings.ndog;
        }
        
        // Handle nwog section settings
        if (newSettings.nwog) {
            Object.assign(flattenedSettings, newSettings.nwog);
            delete flattenedSettings.nwog;
        }
        
        // Handle ehpda section settings
        if (newSettings.ehpda) {
            Object.assign(flattenedSettings, newSettings.ehpda);
            delete flattenedSettings.ehpda;
        }
        
        this.settings = { ...this.settings, ...flattenedSettings };
        
        if (this.sciChartSurfaceRefs) {
            this.removeAllAnnotations();
            
            if (this.settings.enabled) {
                this.updateData(this.chartData, this.sessions);
            }
        }
    }
    
    /**
     * Get UI configuration schema
     */
    getUIConfig() {
        return {
            id: 'openingGapsStudy',
            displayName: 'Opening Gaps & EHPDA',
            description: 'Displays New Day Opening Gaps (NDOG), New Week Opening Gaps (NWOG), and Event Horizon Price Delivery Array (EHPDA) levels based on ICT methodology',
            category: 'ICT',
            settingsSchema: [
                {
                    type: 'section',
                    title: 'Main Settings',
                    key: 'main',
                    controls: [
                        {
                            key: 'enabled',
                            type: 'checkbox',
                            label: 'Enable Opening Gaps Study',
                            tooltip: 'Show/hide the opening gaps and EHPDA analysis',
                            default: true
                        }
                    ]
                },
                {
                    type: 'section',
                    title: 'New Day Opening Gaps (NDOG)',
                    key: 'ndog',
                    controls: [
                        {
                            key: 'showNDOG',
                            type: 'checkbox',
                            label: 'Show NDOG',
                            tooltip: 'Displays New Day Opening Gaps - gaps between daily sessions (~1 hour for CME futures)',
                            default: false
                        },
                        {
                            key: 'ndogAmount',
                            type: 'number',
                            label: 'Amount',
                            suffix: 'gaps',
                            min: 1,
                            max: 20,
                            tooltip: 'Number of NDOG gaps to display',
                            default: 5
                        },
                        {
                            key: 'ndogBullishColor',
                            type: 'color',
                            label: 'Bullish NDOG Color',
                            tooltip: 'Color for NDOG gaps where price gaps up (current open > previous close)',
                            default: '#FFD700'
                        },
                        {
                            key: 'ndogBearishColor',
                            type: 'color',
                            label: 'Bearish NDOG Color',
                            tooltip: 'Color for NDOG gaps where price gaps down (current open < previous close)',
                            default: '#FFD700'
                        }
                    ]
                },
                {
                    type: 'section',
                    title: 'New Week Opening Gaps (NWOG)',
                    key: 'nwog',
                    controls: [
                        {
                            key: 'showNWOG',
                            type: 'checkbox',
                            label: 'Show NWOG',
                            tooltip: 'Displays New Week Opening Gaps - gaps between Friday close and Sunday/Monday open (weekend gaps)',
                            default: true
                        },
                        {
                            key: 'nwogAmount',
                            type: 'number',
                            label: 'Amount',
                            suffix: 'gaps',
                            min: 1,
                            max: 20,
                            tooltip: 'Number of NWOG gaps to display',
                            default: 5
                        },
                        {
                            key: 'nwogBullishColor',
                            type: 'color',
                            label: 'Bullish NWOG Color',
                            tooltip: 'Color for NWOG gaps where price gaps up (current open > previous close)',
                            default: '#ba68c8'
                        },
                        {
                            key: 'nwogBearishColor',
                            type: 'color',
                            label: 'Bearish NWOG Color',
                            tooltip: 'Color for NWOG gaps where price gaps down (current open < previous close)',
                            default: '#ba68c8'
                        }
                    ]
                },
                {
                    type: 'section',
                    title: 'Event Horizon Price Delivery Array (EHPDA)',
                    key: 'ehpda',
                    controls: [
                        {
                            key: 'showEHPDA',
                            type: 'checkbox',
                            label: 'Show EHPDA',
                            tooltip: 'Displays Event Horizon Price Delivery Array levels - intermediary levels between gaps that act as decision points',
                            default: true
                        },
                        {
                            key: 'paneLabels',
                            type: 'checkbox',
                            label: 'Pane Labels',
                            tooltip: 'Shows "EHPDA" text labels on the Event Horizon lines for easier identification',
                            default: true
                        },
                        {
                            key: 'ehpdaColor',
                            type: 'color',
                            label: 'EHPDA Color',
                            tooltip: 'Color for Event Horizon Price Delivery Array dashed lines',
                            default: '#808080'
                        }
                    ]
                }
            ]
        };
    }
    
    /**
     * Detect gaps from 1m candle data
     */
    detectGaps() {
        const oneMinuteData = this.chartData['1m'] || [];
        if (oneMinuteData.length < 2) return;
        
        // Clear previous gaps
        this.ndogGaps = [];
        this.nwogGaps = [];
        
        // Sort by timestamp to ensure proper order
        const sortedData = [...oneMinuteData].sort((a, b) => a.timestamp - b.timestamp);
        
        for (let i = 1; i < sortedData.length; i++) {
            const prevCandle = sortedData[i - 1];
            const currCandle = sortedData[i];
            
            const gapMs = currCandle.timestamp - prevCandle.timestamp;
            const gapHours = gapMs / (1000 * 60 * 60);
            
            // Check for significant gaps
            if (gapHours >= 0.8 && gapHours <= 1.5) {
                // NDOG - Daily gap (~1 hour for CME futures)
                if (this.settings.showNDOG) {
                    const gap = this.createGapData(prevCandle.close, currCandle.open, currCandle.timestamp);
                    this.ndogGaps.push(gap);
                }
            } else if (gapHours >= 24) {
                // NWOG - Weekend gap (>24 hours)
                if (this.settings.showNWOG) {
                    const gap = this.createGapData(prevCandle.close, currCandle.open, currCandle.timestamp);
                    this.nwogGaps.push(gap);
                }
            }
        }
        
        // Limit to specified amounts (keep most recent)
        this.ndogGaps = this.ndogGaps.slice(-this.settings.ndogAmount);
        this.nwogGaps = this.nwogGaps.slice(-this.settings.nwogAmount);
        
        console.log(`[USER-STUDIES] Detected ${this.ndogGaps.length} NDOG gaps and ${this.nwogGaps.length} NWOG gaps`);
    }
    
    /**
     * Create gap data object
     */
    createGapData(prevClose, currOpen, timestamp) {
        const high = Math.max(prevClose, currOpen);
        const low = Math.min(prevClose, currOpen);
        const mid = (high + low) / 2;
        const type = currOpen > prevClose ? 'bullish' : 'bearish';
        
        return { timestamp, high, low, mid, type };
    }
    
    /**
     * Calculate EHPDA levels
     */
    calculateEHPDA() {
        this.ehpdaLevels = [];
        
        if (!this.settings.showEHPDA) return;
        
        // Combine all gaps and sort by timestamp
        const allGaps = [...this.ndogGaps, ...this.nwogGaps].sort((a, b) => a.timestamp - b.timestamp);
        
        // Calculate EHPDA levels between consecutive gaps
        for (let i = 0; i < allGaps.length - 1; i++) {
            const currentGap = allGaps[i];
            const nextGap = allGaps[i + 1];
            
            // EHPDA level is the average between current gap's bottom and next gap's top
            const ehpdaLevel = (currentGap.low + nextGap.high) / 2;
            
            this.ehpdaLevels.push({
                timestamp: currentGap.timestamp,
                level: ehpdaLevel,
                endTimestamp: nextGap.timestamp
            });
        }
        
        console.log(`[USER-STUDIES] Calculated ${this.ehpdaLevels.length} EHPDA levels`);
    }
    
    /**
     * Update all annotations
     */
    updateAnnotations() {
        // Remove existing annotations
        this.removeAllAnnotations();
        
        // Add gap annotations
        if (this.settings.showNDOG) {
            this.ndogGaps.forEach(gap => this.createGapAnnotations(gap, 'NDOG'));
        }
        
        if (this.settings.showNWOG) {
            this.nwogGaps.forEach(gap => this.createGapAnnotations(gap, 'NWOG'));
        }
        
        // Add EHPDA annotations
        if (this.settings.showEHPDA) {
            this.ehpdaLevels.forEach(ehpda => this.createEHPDAAnnotation(ehpda));
        }
    }
    
    /**
     * Create gap annotations (box and lines)
     */
    createGapAnnotations(gap, gapType) {
        this.timeframes.forEach(timeframe => {
            const sciChartSurface = this.sciChartSurfaceRefs[timeframe];
            if (!sciChartSurface) return;
            
            // Select color based on gap type (NDOG/NWOG) and bullish/bearish
            let color;
            if (gapType === 'NDOG') {
                color = gap.type === 'bullish' ? this.settings.ndogBullishColor : this.settings.ndogBearishColor;
            } else { // NWOG
                color = gap.type === 'bullish' ? this.settings.nwogBullishColor : this.settings.nwogBearishColor;
            }
            
            // Create box annotation for the gap area (95% transparency like PineScript)
            const boxAnnotation = new BoxAnnotation({
                id: `OG_${gapType}_box_${gap.timestamp}_${timeframe}`,
                x1: gap.timestamp,
                y1: gap.high,
                x2: Date.now(), // Extend to current time like PineScript
                y2: gap.low,
                fill: color + '18', // 90% transparency (hex: 18 = ~10% opacity for better visibility)
                stroke: 'transparent',
                annotationLayer: 'BelowChart', // Don't obstruct candles
                xAxisId: 'xAxis',
                yAxisId: 'yAxis'
            });
            
            // Create top line (50% transparency)
            const topLine = new LineAnnotation({
                id: `OG_${gapType}_top_${gap.timestamp}_${timeframe}`,
                x1: gap.timestamp,
                y1: gap.high,
                x2: Date.now(), // Extend to current time
                y2: gap.high,
                stroke: color + '80', // 50% transparency
                strokeThickness: 1,
                xAxisId: 'xAxis',
                yAxisId: 'yAxis'
            });
            
            // Create bottom line (50% transparency)
            const bottomLine = new LineAnnotation({
                id: `OG_${gapType}_bottom_${gap.timestamp}_${timeframe}`,
                x1: gap.timestamp,
                y1: gap.low,
                x2: Date.now(), // Extend to current time
                y2: gap.low,
                stroke: color + '80', // 50% transparency
                strokeThickness: 1,
                xAxisId: 'xAxis',
                yAxisId: 'yAxis'
            });
            
            // Create middle/average line (dotted, full opacity)
            const midLine = new LineAnnotation({
                id: `OG_${gapType}_mid_${gap.timestamp}_${timeframe}`,
                x1: gap.timestamp,
                y1: gap.mid,
                x2: Date.now(), // Extend to current time
                y2: gap.mid,
                stroke: color,
                strokeThickness: 1,
                strokeDashArray: [5, 5], // Dotted line
                xAxisId: 'xAxis',
                yAxisId: 'yAxis'
            });
            
            // Add annotations to chart
            sciChartSurface.annotations.add(boxAnnotation);
            sciChartSurface.annotations.add(topLine);
            sciChartSurface.annotations.add(bottomLine);
            sciChartSurface.annotations.add(midLine);
            
            // Track for cleanup
            this.gapAnnotations.push(boxAnnotation, topLine, bottomLine, midLine);
        });
    }
    
    /**
     * Create EHPDA annotation
     */
    createEHPDAAnnotation(ehpda) {
        this.timeframes.forEach(timeframe => {
            const sciChartSurface = this.sciChartSurfaceRefs[timeframe];
            if (!sciChartSurface) return;
            
            // Create dashed line for EHPDA level
            const ehpdaLine = new LineAnnotation({
                id: `OG_EHPDA_${ehpda.timestamp}_${timeframe}`,
                x1: ehpda.timestamp,
                y1: ehpda.level,
                x2: Date.now(), // Extend to current time
                y2: ehpda.level,
                stroke: this.settings.ehpdaColor,
                strokeThickness: 1,
                strokeDashArray: [10, 5], // Dashed line
                xAxisId: 'xAxis',
                yAxisId: 'yAxis'
            });
            
            sciChartSurface.annotations.add(ehpdaLine);
            this.ehpdaAnnotations.push(ehpdaLine);
            
            // Add label if enabled
            if (this.settings.paneLabels) {
                const ehpdaLabel = new TextAnnotation({
                    id: `OG_EHPDA_label_${ehpda.timestamp}_${timeframe}`,
                    x1: Date.now(),
                    y1: ehpda.level,
                    text: 'EHPDA',
                    fontSize: 10,
                    fontFamily: 'Arial',
                    textColor: this.settings.ehpdaColor,
                    xAxisId: 'xAxis',
                    yAxisId: 'yAxis'
                });
                
                sciChartSurface.annotations.add(ehpdaLabel);
                this.ehpdaAnnotations.push(ehpdaLabel);
            }
        });
    }
    
    /**
     * Remove all annotations with proper WebGL cleanup
     */
    removeAllAnnotations() {
        // Remove gap annotations
        this.gapAnnotations.forEach(annotation => {
            this.timeframes.forEach(timeframe => {
                const sciChartSurface = this.sciChartSurfaceRefs[timeframe];
                if (sciChartSurface && sciChartSurface.annotations) {
                    try {
                        sciChartSurface.annotations.remove(annotation);
                        // Proper WebGL memory management
                        if (typeof annotation.delete === 'function') {
                            annotation.delete();
                        }
                    } catch (error) {
                        // Annotation might already be removed
                    }
                }
            });
        });
        
        // Remove EHPDA annotations
        this.ehpdaAnnotations.forEach(annotation => {
            this.timeframes.forEach(timeframe => {
                const sciChartSurface = this.sciChartSurfaceRefs[timeframe];
                if (sciChartSurface && sciChartSurface.annotations) {
                    try {
                        sciChartSurface.annotations.remove(annotation);
                        // Proper WebGL memory management
                        if (typeof annotation.delete === 'function') {
                            annotation.delete();
                        }
                    } catch (error) {
                        // Annotation might already be removed
                    }
                }
            });
        });
        
        this.gapAnnotations = [];
        this.ehpdaAnnotations = [];
    }
}

// Export as default for Quatrain auto-discovery
export default new OpeningGapsStudy(); 