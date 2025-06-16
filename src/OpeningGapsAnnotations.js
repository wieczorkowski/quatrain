import { BoxAnnotation, LineAnnotation, TextAnnotation, AnnotationBase } from 'scichart';

class OpeningGapsAnnotations {
    constructor() {
        this.sciChartSurfaceRefs = null;
        this.timeframes = [];
        this.candleData = {};
        
        // Settings - organized by gap type
        this.settings = {
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
        
        // Storage for detected gaps and annotations
        this.ndogGaps = []; // Array of {timestamp, high, low, mid, type: 'bullish'|'bearish'}
        this.nwogGaps = []; // Array of {timestamp, high, low, mid, type: 'bullish'|'bearish'}
        this.ehpdaLevels = []; // Array of {timestamp, level}
        
        // Annotation tracking for cleanup
        this.gapAnnotations = []; // Box and line annotations for gaps
        this.ehpdaAnnotations = []; // Line annotations for EHPDA
    }
    
    initialize(sciChartSurfaceRefs, timeframes, candleData) {
        this.sciChartSurfaceRefs = sciChartSurfaceRefs;
        this.timeframes = timeframes;
        this.candleData = candleData;
        
        console.log('OpeningGapsAnnotations initialized');
        this.updateData(candleData);
    }
    
    updateData(candleData) {
        if (!this.sciChartSurfaceRefs || !candleData) return;
        
        this.candleData = candleData;
        
        // Detect gaps from 1m data
        this.detectGaps();
        
        // Calculate EHPDA levels
        this.calculateEHPDA();
        
        // Update annotations on charts
        this.updateAnnotations();
    }
    
    detectGaps() {
        const oneMinuteData = this.candleData['1m'] || [];
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
        
        console.log(`Detected ${this.ndogGaps.length} NDOG gaps and ${this.nwogGaps.length} NWOG gaps`);
    }
    
    createGapData(prevClose, currOpen, timestamp) {
        const high = Math.max(prevClose, currOpen);
        const low = Math.min(prevClose, currOpen);
        const mid = (high + low) / 2;
        const type = currOpen > prevClose ? 'bullish' : 'bearish';
        
        return { timestamp, high, low, mid, type };
    }
    
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
        
        console.log(`Calculated ${this.ehpdaLevels.length} EHPDA levels`);
    }
    
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
    
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        // Trigger update when settings change
        this.updateData(this.candleData);
    }
    
    getSettings() {
        return { ...this.settings };
    }
    
    // Cleanup method for when component unmounts
    destroy() {
        this.removeAllAnnotations();
        this.sciChartSurfaceRefs = null;
        this.timeframes = [];
        this.candleData = {};
        this.ndogGaps = [];
        this.nwogGaps = [];
        this.ehpdaLevels = [];
    }
}

// Create singleton instance
const openingGapsAnnotations = new OpeningGapsAnnotations();

export default openingGapsAnnotations; 