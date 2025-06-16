import { LineAnnotation, TextAnnotation } from 'scichart';

/**
 * ICT Price Lines Annotations Manager
 * Simple implementation using internal time-based session calculations
 * Similar to Killzones and other internal studies
 */
class IctPriceLinesAnnotations {
    constructor() {
        this.annotationsByChart = new Map(); // Track annotations by chart
        this.isInitialized = false;
        this.sessionStartHour = 18; // CME futures session starts at 18:00 (6 PM ET)
        
        // Default colors match the TradingView PineScript settings
        this.settings = {
            daysBack: 2,
            textColor: '#555555', // Default text color for labels
            londonTimeRange: {
                beginTime: '03:00',
                endTime: '07:00'
            },
            ny0000: {
                enabled: true,
                color: '#d40c0c',  // Red
                opacity: 1.0,
                lineType: 'dashed'
            },
            ny0830: {
                enabled: true,
                color: '#fbc02d',  // Yellow
                opacity: 1.0,
                lineType: 'solid'
            },
            ny0930: {
                enabled: true,
                color: '#00cd88',  // Green
                opacity: 1.0,
                lineType: 'solid'
            },
            londonOpen: {
                enabled: true,
                color: '#008fff',  // Blue
                opacity: 1.0,
                lineType: 'solid'
            },
            londonHighLow: {
                enabled: true,
                color: '#a2a2a2',  // Medium Gray
                opacity: 1.0,
                lineType: 'solid'
            }
        };
    }

    /**
     * Initialize the manager with chart references
     */
    initialize(chartSurfaces, timeframes, candleData) {
        this.chartSurfaces = chartSurfaces;
        this.timeframes = timeframes;
        this.candleData = candleData;
        this.isInitialized = true;
        
        console.log('ICT Price Lines: Initialized with simple time-based calculations');
        this.refreshAnnotations();
    }

    /**
     * Update settings and refresh annotations
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.refreshAnnotations();
    }

    /**
     * Get current settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Refresh all annotations
     */
    refreshAnnotations() {
        if (!this.isInitialized) return;
        
        this.removeAllAnnotations();
        this.createPriceLineAnnotations();
    }

    /**
     * Remove all annotations
     */
    removeAllAnnotations() {
        for (const [chartKey, annotations] of this.annotationsByChart) {
            const chartSurface = this.chartSurfaces[chartKey];
            if (chartSurface) {
                annotations.forEach(annotation => {
                    if (typeof annotation.delete === 'function') {
                        try {
                            annotation.delete();
                        } catch (error) {
                            console.warn(`Error deleting ICT annotation: ${error.message}`);
                        }
                    }
                    chartSurface.annotations.remove(annotation);
                });
            }
        }
        this.annotationsByChart.clear();
    }

    /**
     * Create price line annotations for all enabled timeframes
     */
    createPriceLineAnnotations() {
        if (!this.chartSurfaces || !this.candleData) return;

        Object.keys(this.chartSurfaces).forEach(chartKey => {
            const chartSurface = this.chartSurfaces[chartKey];
            const candles = this.candleData[chartKey];
            
            if (!chartSurface || !candles || candles.length === 0) {
                return;
            }

            console.log(`ICT: Creating price lines for ${chartKey}`);
            
            const annotations = [];
            
            // Get current time from latest candle
            const currentTime = new Date(candles[candles.length - 1].timestamp);
            
            // Create price lines for current session and specified days back
            const sessionsToCreate = this.settings.daysBack + 1;
            
            for (let sessionOffset = 0; sessionOffset < sessionsToCreate; sessionOffset++) {
                const sessionStart = this.getSessionStart(sessionOffset, currentTime);
                const sessionEnd = this.getSessionEnd(sessionStart);
                const tradingDay = this.getSessionTradingDay(sessionStart);
                
                // Skip weekends
                if (tradingDay.getDay() === 0 || tradingDay.getDay() === 6) {
                    continue;
                }
                
                console.log(`ICT: Processing session ${sessionOffset} for trading day ${tradingDay.toISOString().split('T')[0]}`);
                
                // Get session candles
                const sessionCandles = this.getSessionCandles(candles, sessionStart, sessionEnd);
                
                if (sessionCandles.length === 0) {
                    console.log(`ICT: No candles found for session ${sessionOffset}`);
                    continue;
                }
                
                // Create opening price lines
                const openingLines = this.createOpeningPriceLines(sessionCandles, tradingDay, sessionEnd);
                annotations.push(...openingLines);
                
                // Create London High/Low lines
                const londonLines = this.createLondonHighLowLines(sessionCandles, tradingDay, sessionEnd);
                annotations.push(...londonLines);
            }

            console.log(`ICT: Created ${annotations.length} annotations for ${chartKey}`);
            
            // Add all annotations to the chart
            annotations.forEach(annotation => {
                chartSurface.annotations.add(annotation);
            });

            // Store annotations for cleanup
            this.annotationsByChart.set(chartKey, annotations);
        });
    }

    /**
     * Get session start time (18:00 ET) for sessions back from current time
     */
    getSessionStart(sessionsBack, currentTime = null) {
        if (!currentTime) currentTime = new Date();
        
        // Find the most recent 18:00 ET
        const sessionStart = new Date(currentTime);
        sessionStart.setHours(this.sessionStartHour, 0, 0, 0);
        
        // If current time is before today's 18:00, use yesterday's 18:00
        if (currentTime.getTime() < sessionStart.getTime()) {
            sessionStart.setDate(sessionStart.getDate() - 1);
        }
        
        // Go back the specified number of sessions
        sessionStart.setDate(sessionStart.getDate() - sessionsBack);
        
        return sessionStart;
    }

    /**
     * Get session end time (18:00 ET next day)
     */
    getSessionEnd(sessionStart) {
        const sessionEnd = new Date(sessionStart);
        sessionEnd.setDate(sessionEnd.getDate() + 1);
        return sessionEnd;
    }

    /**
     * Get the trading day for a session (the day after session start)
     */
    getSessionTradingDay(sessionStart) {
        const tradingDay = new Date(sessionStart);
        tradingDay.setDate(tradingDay.getDate() + 1);
        tradingDay.setHours(0, 0, 0, 0);
        return tradingDay;
    }

    /**
     * Get candles within a session timeframe
     */
    getSessionCandles(candles, sessionStart, sessionEnd) {
        return candles.filter(candle => {
            const candleTime = candle.timestamp;
            return candleTime >= sessionStart.getTime() && candleTime < sessionEnd.getTime();
        });
    }

    /**
     * Create opening price lines (NY 00:00, 08:30, 09:30, London Open)
     */
    createOpeningPriceLines(sessionCandles, tradingDay, sessionEnd) {
        const annotations = [];
        
        // NY 00:00 (Midnight)
        if (this.settings.ny0000.enabled) {
            const midnight = this.findCandleAtTime(sessionCandles, tradingDay, 0, 0);
            if (midnight) {
                const line = this.createPriceLine(
                    midnight.open,
                    midnight.timestamp,
                    sessionEnd.getTime(),
                    this.settings.ny0000,
                    '00.00'
                );
                if (line) annotations.push(...line);
            }
        }
        
        // NY 08:30
        if (this.settings.ny0830.enabled) {
            const ny0830 = this.findCandleAtTime(sessionCandles, tradingDay, 8, 30);
            if (ny0830) {
                const line = this.createPriceLine(
                    ny0830.open,
                    ny0830.timestamp,
                    sessionEnd.getTime(),
                    this.settings.ny0830,
                    '08.30'
                );
                if (line) annotations.push(...line);
            }
        }
        
        // NY 09:30 (Market Open)
        if (this.settings.ny0930.enabled) {
            const ny0930 = this.findCandleAtTime(sessionCandles, tradingDay, 9, 30);
            if (ny0930) {
                const line = this.createPriceLine(
                    ny0930.open,
                    ny0930.timestamp,
                    sessionEnd.getTime(),
                    this.settings.ny0930,
                    '09.30'
                );
                if (line) annotations.push(...line);
            }
        }
        
        // London Open (03:00)
        if (this.settings.londonOpen.enabled) {
            const londonOpen = this.findCandleAtTime(sessionCandles, tradingDay, 3, 0);
            if (londonOpen) {
                const line = this.createPriceLine(
                    londonOpen.open,
                    londonOpen.timestamp,
                    sessionEnd.getTime(),
                    this.settings.londonOpen,
                    'Lon O'
                );
                if (line) annotations.push(...line);
            }
        }
        
        return annotations;
    }

    /**
     * Create London High/Low lines
     */
    createLondonHighLowLines(sessionCandles, tradingDay, sessionEnd) {
        const annotations = [];
        
        if (!this.settings.londonHighLow.enabled) {
            return annotations;
        }
        
        const londonData = this.getLondonSessionData(sessionCandles, tradingDay);
        
        if (londonData.high !== null) {
            const highLine = this.createPriceLine(
                londonData.high,
                londonData.highTimestamp,
                sessionEnd.getTime(),
                this.settings.londonHighLow,
                'Lon H'
            );
            if (highLine) annotations.push(...highLine);
        }
        
        if (londonData.low !== null) {
            const lowLine = this.createPriceLine(
                londonData.low,
                londonData.lowTimestamp,
                sessionEnd.getTime(),
                this.settings.londonHighLow,
                'Lon L'
            );
            if (lowLine) annotations.push(...lowLine);
        }
        
        return annotations;
    }

    /**
     * Find candle at specific time on trading day
     */
    findCandleAtTime(sessionCandles, tradingDay, hours, minutes) {
        const targetTime = new Date(tradingDay);
        targetTime.setHours(hours, minutes, 0, 0);
        const targetTimestamp = targetTime.getTime();
        
        return sessionCandles.find(candle => candle.timestamp === targetTimestamp);
    }

    /**
     * Get London session high/low data
     */
    getLondonSessionData(sessionCandles, tradingDay) {
        const [beginHour, beginMin] = this.settings.londonTimeRange.beginTime.split(':').map(Number);
        const [endHour, endMin] = this.settings.londonTimeRange.endTime.split(':').map(Number);
        
        const beginTime = new Date(tradingDay);
        beginTime.setHours(beginHour, beginMin, 0, 0);
        
        const endTime = new Date(tradingDay);
        endTime.setHours(endHour, endMin, 0, 0);
        
        let londonHigh = -Infinity;
        let londonLow = Infinity;
        let highTimestamp = null;
        let lowTimestamp = null;
        
        for (const candle of sessionCandles) {
            if (candle.timestamp >= beginTime.getTime() && candle.timestamp <= endTime.getTime()) {
                if (candle.high > londonHigh) {
                    londonHigh = candle.high;
                    highTimestamp = candle.timestamp;
                }
                if (candle.low < londonLow) {
                    londonLow = candle.low;
                    lowTimestamp = candle.timestamp;
                }
            }
        }
        
        return {
            high: londonHigh === -Infinity ? null : londonHigh,
            low: londonLow === Infinity ? null : londonLow,
            highTimestamp,
            lowTimestamp
        };
    }

    /**
     * Create a price line annotation with label
     */
    createPriceLine(price, startTime, endTime, settings, label) {
        const annotations = [];
        
        // Create the line
        const lineAnnotation = new LineAnnotation({
            x1: startTime,
            y1: price,
            x2: endTime,
            y2: price,
            stroke: this.getColorWithOpacity(settings.color, settings.opacity),
            strokeThickness: 2,
            strokeDashArray: this.getLineDashPattern(settings.lineType),
            xAxisId: 'xAxis',
            yAxisId: 'yAxis'
        });
        
        annotations.push(lineAnnotation);
        
        // Create the label
        const textAnnotation = new TextAnnotation({
            x1: startTime,
            y1: price,
            text: label,
            fontSize: 10,
            textColor: this.settings.textColor,
            horizontalAnchorPoint: 'Right',
            verticalAnchorPoint: 'Top',
            xAxisId: 'xAxis',
            yAxisId: 'yAxis'
        });
        
        annotations.push(textAnnotation);
        
        return annotations;
    }

    /**
     * Convert line type to SciChart stroke dash array
     */
    getLineDashPattern(lineType) {
        const patterns = {
            'solid': [],
            'dashed': [8, 4],
            'dotted': [2, 3]
        };
        return patterns[lineType] || [];
    }

    /**
     * Convert hex color with opacity to rgba
     */
    getColorWithOpacity(hexColor, opacity) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    /**
     * Update candle data and refresh annotations
     */
    updateCandleData(newCandleData) {
        this.candleData = newCandleData;
        this.refreshAnnotations();
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.removeAllAnnotations();
        this.isInitialized = false;
    }
}

export default new IctPriceLinesAnnotations(); 