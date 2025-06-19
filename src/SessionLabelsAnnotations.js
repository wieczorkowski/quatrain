import { BoxAnnotation, TextAnnotation } from 'scichart';

/**
 * Session Labels Annotations Manager
 * Manages session box annotations for Asian, London, and NY trading sessions
 * Based on TradingView PineScript "Futures Exchange Sessions" functionality
 * 
 * PERFORMANCE OPTIMIZED VERSION:
 * - Caches processed data to avoid redundant calculations
 * - Batches chart updates to reduce invalidation calls
 * - Minimizes timezone conversions
 * - Only recalculates when necessary
 */
class SessionLabelsAnnotations {
    constructor() {
        this.annotations = new Map(); // Map of annotation ID to annotation data
        this.sciChartSurfaceRefs = null;
        this.timeframes = [];
        this.chartData = {};
        this.sessions = [];
        
        // Performance optimization: Cache processed data
        this.dataCache = {
            lastDataHash: null,
            lastSettingsHash: null,
            processedCandles: null,
            sessionData: new Map() // Cache session calculations
        };
        
        // Session tracking state
        this.sessionBoxes = {
            asian: new Map(), // Map of session date to box data
            london: new Map(),
            ny: new Map()
        };
        
        this.settings = {
            asianSession: {
                enabled: false,
                boxColor: '#FF0000',
                boxOpacity: 0.1,
                borderColor: '#000000',
                borderOpacity: 0.1,
                borderThickness: 2,
                borderStyle: 'solid'
            },
            londonSession: {
                enabled: false,
                boxColor: '#0000FF',
                boxOpacity: 0.1,
                borderColor: '#000000',
                borderOpacity: 0.1,
                borderThickness: 2,
                borderStyle: 'solid'
            },
            nySession: {
                enabled: false,
                boxColor: '#00FF00',
                boxOpacity: 0.1,
                borderColor: '#000000',
                borderOpacity: 0.1,
                borderThickness: 2,
                borderStyle: 'solid'
            },
            daysBack: 2,
            showLabels: true
        };
        
        // Session time definitions (Eastern Time) - FIXED Asian session times
        this.sessionTimes = {
            asian: {
                start: '19:00',
                end: '03:00' // Next day - crosses midnight
            },
            london: {
                start: '03:00', 
                end: '11:30'
            },
            ny: {
                start: '09:30',
                end: '16:00'
            }
        };
        
        // UTC session times cache - converted once for performance
        this.sessionTimesUTC = null;
        this.initializeUTCSessionTimes();
    }

    /**
     * Initialize UTC session times for performance - convert once instead of per candle
     */
    initializeUTCSessionTimes() {
        // Get current ET to UTC offset (handles DST automatically) - FIXED VERSION
        const now = new Date();
        
        // CORRECT way to calculate ET to UTC offset:
        // Create a Date object in ET timezone and compare to UTC
        const formatter = new Intl.DateTimeFormat('en', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',  
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        const parts = formatter.formatToParts(now);
        const etYear = parseInt(parts.find(p => p.type === 'year').value);
        const etMonth = parseInt(parts.find(p => p.type === 'month').value) - 1; // 0-indexed
        const etDay = parseInt(parts.find(p => p.type === 'day').value);
        const etHour = parseInt(parts.find(p => p.type === 'hour').value);
        const etMinute = parseInt(parts.find(p => p.type === 'minute').value);
        const etSecond = parseInt(parts.find(p => p.type === 'second').value);
        
        // Create Date objects properly - ET date represents the ET time as if it were UTC
        const etDateUTC = new Date(Date.UTC(etYear, etMonth, etDay, etHour, etMinute, etSecond));
        const actualUTC = new Date(now.getTime());
        
        // Calculate offset: positive when UTC is ahead of ET (EDT = +4 hours, EST = +5 hours)
        const etOffsetMs = actualUTC.getTime() - etDateUTC.getTime();
        
        const utcSessionTimes = {};
        
        Object.keys(this.sessionTimes).forEach(sessionType => {
            const sessionTime = this.sessionTimes[sessionType];
            
            // Parse ET times
            const [startHour, startMin] = sessionTime.start.split(':').map(Number);
            const [endHour, endMin] = sessionTime.end.split(':').map(Number);
            
            // Convert ET times to UTC minutes-of-day
            // To convert ET to UTC: add the offset (if EDT, add 4 hours)
            let startMinutesUTC = (startHour * 60 + startMin) + (etOffsetMs / (1000 * 60));
            let endMinutesUTC = (endHour * 60 + endMin) + (etOffsetMs / (1000 * 60));
            
            // Handle wrap-around for UTC conversion
            if (startMinutesUTC < 0) startMinutesUTC += 1440; // Add 24 hours
            if (startMinutesUTC >= 1440) startMinutesUTC -= 1440; // Subtract 24 hours
            if (endMinutesUTC < 0) endMinutesUTC += 1440;
            if (endMinutesUTC >= 1440) endMinutesUTC -= 1440;
            
            utcSessionTimes[sessionType] = {
                startMinutesUTC: startMinutesUTC,
                endMinutesUTC: endMinutesUTC,
                crossesMidnight: sessionTime.start > sessionTime.end || startMinutesUTC > endMinutesUTC
            };
        });
        
        this.sessionTimesUTC = utcSessionTimes;
        // console.log('Initialized UTC session times with CORRECT offset calculation:', this.sessionTimesUTC);
        // console.log('ET to UTC offset (minutes):', etOffsetMs / (1000 * 60));
    }

    /**
     * Initialize the manager with chart references
     */
    initialize(sciChartSurfaceRefs, timeframes, chartData, sessions) {
        this.sciChartSurfaceRefs = sciChartSurfaceRefs;
        this.timeframes = timeframes;
        this.chartData = chartData;
        this.sessions = sessions;
    }

    /**
     * Update chart data and sessions - PERFORMANCE OPTIMIZED
     */
    updateData(chartData, sessions) {
        this.chartData = chartData;
        this.sessions = sessions;
        
        // Performance optimization: Only recalculate if data actually changed
        const dataHash = this.generateDataHash(chartData);
        const settingsHash = this.generateSettingsHash();
        
        if (this.dataCache.lastDataHash === dataHash && 
            this.dataCache.lastSettingsHash === settingsHash) {
            // No changes, skip recalculation
            return;
        }
        
        // Update cache hashes
        this.dataCache.lastDataHash = dataHash;
        this.dataCache.lastSettingsHash = settingsHash;
        
        // Recalculate session boxes efficiently
        this.recalculateSessionBoxes();
    }

    /**
     * Generate hash for data to detect changes
     */
    generateDataHash(chartData) {
        const oneMinData = chartData['1m'] || [];
        if (oneMinData.length === 0) return 'empty';
        
        // Use first, last, and length as a simple hash
        const first = oneMinData[0];
        const last = oneMinData[oneMinData.length - 1];
        return `${first?.timestamp}-${last?.timestamp}-${oneMinData.length}`;
    }

    /**
     * Generate hash for settings to detect changes
     */
    generateSettingsHash() {
        return JSON.stringify(this.settings);
    }

    /**
     * Update settings for session labels
     */
    updateSettings(newSettings) {
        const oldSettings = { ...this.settings };
        this.settings = { ...this.settings, ...newSettings };
        
        // Reinitialize UTC session times if session times changed
        this.initializeUTCSessionTimes();
        
        // Force recalculation by clearing cache
        this.dataCache.lastSettingsHash = null;
        
        // Recalculate session boxes
        this.recalculateSessionBoxes();
    }

    /**
     * Recalculate all enabled session boxes - PERFORMANCE OPTIMIZED
     */
    recalculateSessionBoxes() {
        // Remove all existing session boxes first
        this.removeAllSessionBoxes();
        
        // Only process if we have chart data
        if (!this.chartData['1m'] || this.chartData['1m'].length === 0) {
            console.log('No 1-minute data available for session box calculation');
            return;
        }
        
        // Pre-process candles once for all sessions (MAJOR PERFORMANCE IMPROVEMENT)
        const processedCandles = this.preprocessCandles();
        if (!processedCandles || processedCandles.length === 0) {
            return;
        }
        
        // Batch all session calculations
        const sessionUpdates = [];
        
        if (this.settings.asianSession.enabled) {
            const asianBoxes = this.calculateSessionBoxesOptimized('asian', processedCandles);
            sessionUpdates.push(...asianBoxes);
        }
        if (this.settings.londonSession.enabled) {
            const londonBoxes = this.calculateSessionBoxesOptimized('london', processedCandles);
            sessionUpdates.push(...londonBoxes);
        }
        if (this.settings.nySession.enabled) {
            const nyBoxes = this.calculateSessionBoxesOptimized('ny', processedCandles);
            sessionUpdates.push(...nyBoxes);
        }
        
        // Batch create all annotations (MAJOR PERFORMANCE IMPROVEMENT)
        this.batchCreateAnnotations(sessionUpdates);
    }

    /**
     * Pre-process candles without timezone conversion - MAJOR PERFORMANCE OPTIMIZATION
     */
    preprocessCandles() {
        const oneMinuteData = this.chartData['1m'] || [];
        if (oneMinuteData.length === 0) return [];
        
        // Get the cutoff date for daysBack - use latest candle time for replay compatibility
        // In replay mode, we want to filter based on the replay time context, not system time
        const latestCandleTime = oneMinuteData[oneMinuteData.length - 1].timestamp;
        const cutoffDate = new Date(latestCandleTime - (this.settings.daysBack * 24 * 60 * 60 * 1000));
        
        // Pre-process candles WITHOUT timezone conversion per candle
        const processedCandles = oneMinuteData
            .filter(candle => candle.timestamp >= cutoffDate.getTime())
            .map(candle => {
                // Convert UTC timestamp to ET ONCE per candle for day grouping only
                const candleDate = new Date(candle.timestamp);
                const easternDate = new Date(candleDate.toLocaleString("en-US", {timeZone: "America/New_York"}));
                const hour = easternDate.getHours();
                
                // For CME futures, trading day begins at 18:00 ET (6:00 PM)
                // All candles from 18:00 today through 17:59 tomorrow belong to the same trading day
                let tradingDayKey;
                
                // If it's before 18:00 (6:00 PM), it belongs to the previous trading day
                if (hour < 18) {
                    const prevTradingDay = new Date(easternDate);
                    prevTradingDay.setDate(prevTradingDay.getDate() - 1);
                    tradingDayKey = `${prevTradingDay.getFullYear()}-${String(prevTradingDay.getMonth() + 1).padStart(2, '0')}-${String(prevTradingDay.getDate()).padStart(2, '0')}`;
                } else {
                    // 18:00 and later belongs to current trading day
                    tradingDayKey = `${easternDate.getFullYear()}-${String(easternDate.getMonth() + 1).padStart(2, '0')}-${String(easternDate.getDate()).padStart(2, '0')}`;
                }
                
                return {
                    ...candle,
                    dayKey: tradingDayKey, // This now properly groups midnight-crossing sessions
                    easternDate: easternDate // Keep for day grouping only
                };
            });
        
        console.log(`Preprocessed ${processedCandles.length} candles for session analysis (cutoff: ${new Date(cutoffDate).toISOString()})`);
        return processedCandles;
    }

    /**
     * Calculate session boxes optimized - uses preprocessed candles with ZERO timezone conversions
     */
    calculateSessionBoxesOptimized(sessionType, processedCandles) {
        const sessionSettings = this.settings[`${sessionType}Session`];
        const sessionLabel = this.getSessionLabel(sessionType);
        
        // Group candles by day efficiently
        const candlesByDay = {};
        processedCandles.forEach(candle => {
            if (!candlesByDay[candle.dayKey]) {
                candlesByDay[candle.dayKey] = [];
            }
            candlesByDay[candle.dayKey].push(candle);
        });
        
        const sessionBoxes = [];
        
        // Process each day to find session periods
        Object.keys(candlesByDay).forEach(dayKey => {
            const dayCandles = candlesByDay[dayKey];
            
            // Filter candles for this session using direct UTC timestamp comparison
            const sessionCandles = dayCandles.filter(candle => 
                this.isTimestampInSession(candle.timestamp, sessionType)
            );
            
            if (sessionCandles.length > 0) {
                // Calculate session high/low/times
                let sessionHigh = sessionCandles[0].high;
                let sessionLow = sessionCandles[0].low;
                let startTime = sessionCandles[0].timestamp;
                let endTime = sessionCandles[sessionCandles.length - 1].timestamp;

                sessionCandles.forEach(candle => {
                    if (candle.high > sessionHigh) sessionHigh = candle.high;
                    if (candle.low < sessionLow) sessionLow = candle.low;
                    if (candle.timestamp < startTime) startTime = candle.timestamp;
                    if (candle.timestamp > endTime) endTime = candle.timestamp;
                });

                sessionBoxes.push({
                    sessionType,
                    dayKey,
                    startTime,
                    endTime,
                    sessionHigh,
                    sessionLow,
                    sessionSettings,
                    sessionLabel
                });
                
                console.log(`${sessionType} session found for ${dayKey}: ${sessionCandles.length} candles, High=${sessionHigh}, Low=${sessionLow}`);
            }
        });
        
        return sessionBoxes;
    }

    /**
     * Get session label for display
     */
    getSessionLabel(sessionType) {
        const labels = {
            asian: 'Asia',
            london: 'London', 
            ny: 'New York'
        };
        return labels[sessionType] || sessionType;
    }

    /**
     * Check if a UTC timestamp is within a session range - ZERO TIMEZONE CONVERSIONS
     */
    isTimestampInSession(utcTimestamp, sessionType) {
        // Extract UTC minutes-of-day directly from timestamp (no timezone conversion!)
        const utcDate = new Date(utcTimestamp);
        const utcMinutes = utcDate.getUTCHours() * 60 + utcDate.getUTCMinutes();
        
        const sessionTimes = this.sessionTimesUTC[sessionType];
        const { startMinutesUTC, endMinutesUTC, crossesMidnight } = sessionTimes;
        
        // Handle sessions that cross midnight (like Asian session 19:00-03:00)
        if (crossesMidnight) {
            return utcMinutes >= startMinutesUTC || utcMinutes < endMinutesUTC;
        } else {
            return utcMinutes >= startMinutesUTC && utcMinutes < endMinutesUTC;
        }
    }

    /**
     * Batch create all annotations - MAJOR PERFORMANCE IMPROVEMENT
     */
    batchCreateAnnotations(sessionBoxes) {
        if (!this.sciChartSurfaceRefs || !this.sciChartSurfaceRefs.current) {
            console.log('SciChart surface refs not available');
            return;
        }
        
        // Get eligible timeframes (30m and smaller)
        const eligibleTimeframes = this.timeframes.filter(tf => {
            const tfMinutes = this.getTimeframeMinutes(tf);
            return tfMinutes <= 30;
        });
        
        // Group annotations by timeframe for batch processing
        const annotationsByTimeframe = {};
        eligibleTimeframes.forEach(tf => {
            annotationsByTimeframe[tf] = [];
        });
        
        // Prepare all annotations (both boxes and text labels)
        sessionBoxes.forEach(sessionBox => {
            eligibleTimeframes.forEach(timeframe => {
                const annotations = this.createSessionBoxAnnotation(sessionBox, timeframe);
                if (annotations) {
                    // annotations is now an array that may contain both box and text annotations
                    annotationsByTimeframe[timeframe].push(...annotations);
                }
            });
        });
        
        // Batch add annotations to each timeframe (CRITICAL PERFORMANCE IMPROVEMENT)
        eligibleTimeframes.forEach(timeframe => {
            const chartSurface = this.sciChartSurfaceRefs.current[timeframe];
            if (chartSurface && annotationsByTimeframe[timeframe].length > 0) {
                // Add all annotations at once
                annotationsByTimeframe[timeframe].forEach(annotationData => {
                    chartSurface.annotations.add(annotationData.annotation);
                    // Store in our internal map
                    this.annotations.set(annotationData.id, annotationData.data);
                });
                
                // Single invalidation per timeframe instead of per annotation
                chartSurface.invalidateElement();
                
                console.log(`Batch created ${annotationsByTimeframe[timeframe].length} session annotations for ${timeframe}`);
            }
        });
    }

    /**
     * Create session box annotation and optional text label - OPTIMIZED
     */
    createSessionBoxAnnotation(sessionBox, timeframe) {
        const { sessionType, dayKey, startTime, endTime, sessionHigh, sessionLow, sessionSettings, sessionLabel } = sessionBox;
        
        // Convert colors with opacity
        const boxColor = this.hexToRgba(sessionSettings.boxColor, sessionSettings.boxOpacity);
        const borderColor = this.hexToRgba(sessionSettings.borderColor, sessionSettings.borderOpacity);
        const borderStyle = this.getBorderStyle(sessionSettings.borderStyle);

        const boxId = `session-${sessionType}-${timeframe}-${dayKey}`;
        const textId = `session-text-${sessionType}-${timeframe}-${dayKey}`;

        const annotations = [];

        // Create the box annotation (always created)
        const boxAnnotation = new BoxAnnotation({
            id: boxId,
            x1: startTime,
            y1: sessionHigh,
            x2: endTime,
            y2: sessionLow,
            fill: boxColor,
            stroke: borderColor,
            strokeThickness: sessionSettings.borderThickness,
            strokeDashArray: borderStyle,
            annotationLayer: 'BelowChart', // Don't obstruct candles
            isEditable: false,
            xAxisId: 'xAxis',
            yAxisId: 'yAxis'
        });

        annotations.push({
            id: boxId,
            annotation: boxAnnotation,
            data: {
                annotation: boxAnnotation,
                type: sessionType.toUpperCase(),
                subtype: 'BOX',
                timeframe: timeframe,
                dayKey: dayKey,
                startTime: startTime,
                endTime: endTime,
                high: sessionHigh,
                low: sessionLow
            }
        });

        // Create text annotation only if showLabels is enabled
        if (this.settings.showLabels) {
            const textAnnotation = new TextAnnotation({
                id: textId,
                x1: endTime, // Position at right edge of box (x2)
                y1: sessionHigh, // Position at top of box (y1)
                xAxisId: 'xAxis',
                yAxisId: 'yAxis',
                text: sessionLabel,
                fontSize: 10,
                //fontWeight: 'bold',
                textColor: '#000000',
                horizontalAnchorPoint: 'Right', // Anchor to right
                verticalAnchorPoint: 'Bottom', // Anchor to bottom
                isEditable: false
            });

            annotations.push({
                id: textId,
                annotation: textAnnotation,
                data: {
                    annotation: textAnnotation,
                    type: sessionType.toUpperCase(),
                    subtype: 'TEXT',
                    timeframe: timeframe,
                    dayKey: dayKey,
                    startTime: startTime,
                    endTime: endTime,
                    high: sessionHigh,
                    low: sessionLow
                }
            });
        }

        return annotations;
    }

    /**
     * Get timeframe in minutes for comparison
     */
    getTimeframeMinutes(timeframe) {
        const tfMap = {
            '1m': 1,
            '5m': 5,
            '10m': 10,
            '15m': 15,
            '30m': 30,
            '1h': 60,
            '4h': 240,
            '1d': 1440
        };
        return tfMap[timeframe] || 999;
    }

    /**
     * Convert hex color to rgba with opacity
     */
    hexToRgba(hex, opacity) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    /**
     * Get border style array for SciChart
     */
    getBorderStyle(style) {
        switch (style) {
            case 'dashed':
                return [5, 5];
            case 'dotted':
                return [2, 2];
            case 'solid':
            default:
                return [];
        }
    }

    /**
     * Remove all session boxes - OPTIMIZED with proper WebGL cleanup
     */
    removeAllSessionBoxes() {
        if (!this.sciChartSurfaceRefs || !this.sciChartSurfaceRefs.current) {
            return;
        }

        // Group annotations by timeframe for batch removal
        const annotationsByTimeframe = {};
        
        this.annotations.forEach((data, id) => {
            if (!annotationsByTimeframe[data.timeframe]) {
                annotationsByTimeframe[data.timeframe] = [];
            }
            annotationsByTimeframe[data.timeframe].push(data);
        });

        // Batch remove annotations from each timeframe
        Object.keys(annotationsByTimeframe).forEach(timeframe => {
            const chartSurface = this.sciChartSurfaceRefs.current[timeframe];
            if (chartSurface) {
                annotationsByTimeframe[timeframe].forEach(data => {
                    // CRITICAL: Call delete() method on annotation to free WebGL resources
                    if (typeof data.annotation.delete === 'function') {
                        try {
                            data.annotation.delete();
                        } catch (error) {
                            console.warn(`Error calling delete() on session box annotation: ${error.message}`);
                        }
                    }
                    chartSurface.annotations.remove(data.annotation);
                });
                
                // Single invalidation per timeframe
                chartSurface.invalidateElement();
            }
        });

        // Clear all tracking data
        this.annotations.clear();
        this.sessionBoxes.asian.clear();
        this.sessionBoxes.london.clear();
        this.sessionBoxes.ny.clear();
        
        // Clear cache
        this.dataCache.lastDataHash = null;
        this.dataCache.lastSettingsHash = null;
        this.dataCache.processedCandles = null;
        this.dataCache.sessionData.clear();
    }

    /**
     * Remove session boxes by type - OPTIMIZED
     */
    removeSessionBoxesByType(sessionType) {
        if (!this.sciChartSurfaceRefs || !this.sciChartSurfaceRefs.current) {
            return;
        }

        const annotationsToRemove = [];
        this.annotations.forEach((data, id) => {
            if (data.type === sessionType.toUpperCase()) {
                annotationsToRemove.push({ id, data });
            }
        });

        // Group by timeframe for batch removal
        const byTimeframe = {};
        annotationsToRemove.forEach(({ id, data }) => {
            if (!byTimeframe[data.timeframe]) {
                byTimeframe[data.timeframe] = [];
            }
            byTimeframe[data.timeframe].push({ id, data });
        });

        // Batch remove from each timeframe
        Object.keys(byTimeframe).forEach(timeframe => {
            const chartSurface = this.sciChartSurfaceRefs.current[timeframe];
            if (chartSurface) {
                byTimeframe[timeframe].forEach(({ id, data }) => {
                    // CRITICAL: Call delete() method on annotation to free WebGL resources
                    if (typeof data.annotation.delete === 'function') {
                        try {
                            data.annotation.delete();
                        } catch (error) {
                            console.warn(`Error calling delete() on ${sessionType} session box annotation: ${error.message}`);
                        }
                    }
                    chartSurface.annotations.remove(data.annotation);
                    this.annotations.delete(id);
                });
                
                // Single invalidation per timeframe
                chartSurface.invalidateElement();
            }
        });

        // Clear the specific session boxes
        if (this.sessionBoxes[sessionType.toLowerCase()]) {
            this.sessionBoxes[sessionType.toLowerCase()].clear();
        }
    }

    /**
     * Get current settings
     */
    getSettings() {
        return { ...this.settings };
    }
}

// Create a singleton instance
const sessionLabelsAnnotations = new SessionLabelsAnnotations();

export default sessionLabelsAnnotations; 