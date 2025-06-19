import { BoxAnnotation } from 'scichart';

class KillzonesAnnotations {
    constructor() {
        this.settings = {
            daysBack: 2,
            killzone1: {
                enabled: false,
                startTime: '08:30',
                endTime: '09:31',
                color: '#0000CC',
                opacity: 0.10
            },
            killzone2: {
                enabled: false,
                startTime: '09:30',
                endTime: '11:31',
                color: '#DDDDDD',
                opacity: 0.15
            },
            killzone3: {
                enabled: false,
                startTime: '13:30',
                endTime: '15:01',
                color: '#DDDD00',
                opacity: 0.15
            },
            killzone4: {
                enabled: false,
                startTime: '15:00',
                endTime: '16:01',
                color: '#00DDDD',
                opacity: 0.10
            }
        };
        
        this.annotationsByChart = new Map(); // Track annotations by chart
        this.isInitialized = false;
        this.currentSessionStart = null; // Track current session start time
        this.sessionStartHour = 18; // CME futures session starts at 18:00 (6 PM)
    }

    getSettings() {
        return { ...this.settings };
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.refreshAnnotations();
    }

    initialize(chartSurfaces, candleData) {
        this.chartSurfaces = chartSurfaces;
        this.candleData = candleData;
        this.isInitialized = true;
        
        // Set current session start
        this.currentSessionStart = this.getCurrentSessionStart();
        console.log(`Killzones: Initialized with session start: ${this.currentSessionStart.toISOString()}`);
        
        this.refreshAnnotations();
    }

    refreshAnnotations() {
        if (!this.isInitialized) return;
        
        this.removeAllAnnotations();
        this.createKillzoneAnnotations();
    }

    removeAllAnnotations() {
        for (const [chartKey, annotations] of this.annotationsByChart) {
            const chartSurface = this.chartSurfaces[chartKey];
            if (chartSurface) {
                annotations.forEach(annotation => {
                    // Proper WebGL memory management - call delete() before removing
                    if (typeof annotation.delete === 'function') {
                        try {
                            annotation.delete();
                        } catch (error) {
                            console.warn(`Error calling delete() on killzone annotation: ${error.message}`);
                        }
                    }
                    chartSurface.annotations.remove(annotation);
                });
            }
        }
        this.annotationsByChart.clear();
    }

    createKillzoneAnnotations() {
        if (!this.chartSurfaces || !this.candleData) return;

        Object.keys(this.chartSurfaces).forEach(chartKey => {
            // Only show killzones on timeframes 30 minutes or less (following PineScript logic)
            const timeframeMinutes = this.parseTimeframeToMinutes(chartKey);
            if (timeframeMinutes > 30) {
                return; // Skip this timeframe
            }
            const chartSurface = this.chartSurfaces[chartKey];
            const candles = this.candleData[chartKey];
            
            if (!chartSurface) {
                console.log(`Killzones: No chart surface for ${chartKey}`);
                return;
            }
            
            // Get current time from candle data for replay compatibility
            let currentTime = null;
            if (candles && candles.length > 0) {
                const lastCandle = candles[candles.length - 1];
                if (lastCandle && lastCandle.timestamp) {
                    currentTime = new Date(lastCandle.timestamp);
                    // Validate the date
                    if (isNaN(currentTime.getTime())) {
                        console.warn(`Killzones: Invalid timestamp in candle data: ${lastCandle.timestamp}`);
                        currentTime = null;
                    }
                }
            }
            
            console.log(`Killzones: Creating annotations for ${chartKey}, current time: ${currentTime?.toISOString()}`);

            const annotations = [];
            
            // Create killzones for current session and the specified number of sessions back
            const sessionsToCreate = this.settings.daysBack + 1; // Current + N previous sessions
            console.log(`Killzones: Creating killzones for ${sessionsToCreate} sessions (current + ${this.settings.daysBack} back)`);

            // Process each killzone
            ['killzone1', 'killzone2', 'killzone3', 'killzone4'].forEach(killzoneKey => {
                const killzone = this.settings[killzoneKey];
                if (!killzone.enabled) return;

                // Create killzones for each session
                for (let sessionOffset = 0; sessionOffset < sessionsToCreate; sessionOffset++) {
                    const sessionStart = this.getSessionStart(sessionOffset, currentTime);
                    const tradingDay = this.getSessionTradingDay(sessionStart);
                    
                    console.log(`Killzones: Creating ${killzoneKey} for session ${sessionOffset} (trading day: ${tradingDay.toISOString().split('T')[0]})`);
                    
                    const killzoneAnnotations = this.createKillzoneBoxesForSession(
                        killzone, 
                        tradingDay
                    );
                    annotations.push(...killzoneAnnotations);
                }
            });

            console.log(`Killzones: Created ${annotations.length} annotations for ${chartKey}`);
            
            // Add all annotations to the chart
            annotations.forEach(annotation => {
                chartSurface.annotations.add(annotation);
            });

            // Store annotations for cleanup
            this.annotationsByChart.set(chartKey, annotations);
        });
    }

    createKillzoneBoxesForSession(killzone, tradingDay) {
        const annotations = [];
        
        console.log(`Killzones: Creating box for ${killzone.startTime}-${killzone.endTime} on trading day ${tradingDay.toISOString().split('T')[0]}`);

        // Skip weekends (Saturday = 6, Sunday = 0)
        if (tradingDay.getDay() === 0 || tradingDay.getDay() === 6) {
            console.log(`Killzones: Skipping weekend trading day`);
            return annotations;
        }

        // Parse start and end times
        const [startHour, startMinute] = killzone.startTime.split(':').map(Number);
        const [endHour, endMinute] = killzone.endTime.split(':').map(Number);

        // Create start and end timestamps for this killzone on this trading day
        const startTime = new Date(tradingDay);
        startTime.setHours(startHour, startMinute, 0, 0);
        
        const endTime = new Date(tradingDay);
        endTime.setHours(endHour, endMinute, 0, 0);

        // Handle cases where end time is next day (like 09:31 next day)
        if (endTime <= startTime) {
            endTime.setDate(endTime.getDate() + 1);
        }

        console.log(`Killzones: Creating box for ${startTime.toISOString()} to ${endTime.toISOString()}`);

        // Create the box annotation
        const boxAnnotation = new BoxAnnotation({
            x1: startTime.getTime(),
            x2: endTime.getTime(),
            y1: 0, // Use relative coordinates
            y2: 1, // Use relative coordinates
            yCoordinateMode: 'Relative', // Make box span entire chart height
            fill: this.hexToRgba(killzone.color, killzone.opacity),
            stroke: 'transparent', // Remove border
            strokeThickness: 0, // No border thickness
            annotationLayer: 'BelowChart', // Don't obstruct candles
            isEditable: false,
            isSelected: false,
            xAxisId: 'xAxis',
            yAxisId: 'yAxis'
        });

        annotations.push(boxAnnotation);
        return annotations;
    }

    // Helper function to convert hex color to rgba with opacity
    hexToRgba(hex, opacity) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // Helper function to parse timeframe to minutes (following PineScript logic)
    parseTimeframeToMinutes(timeframe) {
        if (timeframe.endsWith('m')) {
            return parseInt(timeframe.slice(0, -1));
        } else if (timeframe.endsWith('h')) {
            return parseInt(timeframe.slice(0, -1)) * 60;
        } else if (timeframe.endsWith('d')) {
            return parseInt(timeframe.slice(0, -1)) * 1440;
        }
        return 0;
    }

    // Get the current session start time (18:00 based) using candle data time
    getCurrentSessionStart(currentTime = null) {
        // Use provided time or get latest candle time from data
        let referenceTime = currentTime;
        if (!referenceTime && this.candleData) {
            // PERFORMANCE OPTIMIZATION: Check 1m first (most common case), then fallback
            // This avoids looping through all timeframes when 1m data is available
            const oneMinuteCandles = this.candleData['1m'];
            if (oneMinuteCandles && oneMinuteCandles.length > 0) {
                const lastCandle = oneMinuteCandles[oneMinuteCandles.length - 1];
                if (lastCandle && lastCandle.timestamp) {
                    referenceTime = new Date(lastCandle.timestamp);
                    // Validate the date
                    if (isNaN(referenceTime.getTime())) {
                        console.warn(`Killzones: Invalid timestamp in 1m candle data: ${lastCandle.timestamp}`);
                        referenceTime = null;
                    }
                }
            }
            
            if (!referenceTime) {
                // Fallback: Find the latest candle time across all timeframes
                let latestTime = 0;
                Object.keys(this.candleData).forEach(timeframe => {
                    const candles = this.candleData[timeframe];
                    if (candles && candles.length > 0) {
                        const lastCandle = candles[candles.length - 1];
                        // PERFORMANCE: Work with timestamp directly, avoid creating Date object in loop
                        if (lastCandle && lastCandle.timestamp && !isNaN(lastCandle.timestamp)) {
                            const candleTime = lastCandle.timestamp;
                            if (candleTime > latestTime) {
                                latestTime = candleTime;
                            }
                        }
                    }
                });
                referenceTime = latestTime > 0 ? new Date(latestTime) : new Date();
                
                // Final validation of the fallback reference time
                if (isNaN(referenceTime.getTime())) {
                    console.warn(`Killzones: Fallback reference time is invalid, using current time`);
                    referenceTime = new Date();
                }
            }
        }
        
        if (!referenceTime) {
            referenceTime = new Date(); // Fallback only if no candle data available
        }
        
        const sessionStart = new Date(referenceTime);
        sessionStart.setHours(this.sessionStartHour, 0, 0, 0);
        
        // If current time is before 18:00, we're in the previous day's session
        if (referenceTime.getHours() < this.sessionStartHour) {
            sessionStart.setDate(sessionStart.getDate() - 1);
        }
        
        return sessionStart;
    }

    // Get session start for a specific number of sessions back
    getSessionStart(sessionsBack, currentTime = null) {
        const currentSession = this.getCurrentSessionStart(currentTime);
        const sessionStart = new Date(currentSession);
        sessionStart.setDate(sessionStart.getDate() - sessionsBack);
        return sessionStart;
    }

    // Get the trading day date for a session (the day the session represents)
    getSessionTradingDay(sessionStart) {
        const tradingDay = new Date(sessionStart);
        // Trading day is the next day after session start (since session starts at 18:00)
        tradingDay.setDate(tradingDay.getDate() + 1);
        return tradingDay;
    }

    // Update candle data when new data arrives
    updateCandleData(newCandleData) {
        this.candleData = newCandleData;
        if (this.isInitialized) {
            // Always refresh if we don't have any annotations yet
            const hasAnnotations = this.annotationsByChart.size > 0;
            
            if (!hasAnnotations) {
                console.log('Killzones: Creating initial annotations');
                this.refreshAnnotations();
                return;
            }
            
            // Check if we've crossed into a new session (18:00) using candle time
            const currentSessionStart = this.getCurrentSessionStart();
            
            // Validate the current session start before using it
            if (!currentSessionStart || isNaN(currentSessionStart.getTime())) {
                console.warn('Killzones: Invalid session start time calculated, skipping update');
                return;
            }
            
            if (!this.currentSessionStart || currentSessionStart.getTime() !== this.currentSessionStart.getTime()) {
                // Safe logging with error handling
                const prevSession = this.currentSessionStart && !isNaN(this.currentSessionStart.getTime()) 
                    ? this.currentSessionStart.toISOString() 
                    : 'undefined';
                const currSession = currentSessionStart.toISOString();
                
                console.log(`Killzones: New session detected. Previous: ${prevSession}, Current: ${currSession}`);
                this.currentSessionStart = currentSessionStart;
                this.refreshAnnotations();
            }
        }
    }

    // Clean up all annotations and resources
    destroy() {
        this.removeAllAnnotations();
        this.chartSurfaces = null;
        this.candleData = null;
        this.isInitialized = false;
        this.currentSessionStart = null;
    }
}

// Create singleton instance
const killzonesAnnotations = new KillzonesAnnotations();

export default killzonesAnnotations; 