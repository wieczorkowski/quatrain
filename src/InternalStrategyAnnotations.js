import { HorizontalLineAnnotation } from 'scichart';

/**
 * Internal Strategy Annotations Manager
 * Manages annotations that are calculated and maintained internally by Quatrain
 * These are separate from user annotations and external strategy annotations
 */
class InternalStrategyAnnotations {
    constructor() {
        this.annotations = new Map(); // Map of annotation ID to annotation data
        this.sciChartSurfaceRefs = null;
        this.timeframes = [];
        this.chartData = {};
        this.sessions = [];
        
        // Separate storage for price levels optimized for trading decisions
        this.priceLevels = {
            previousDayHigh: null,
            previousDayLow: null,
            preMarketHigh: null,
            preMarketLow: null,
            orb30High: null,
            orb30Low: null,
            londonHigh: null,
            londonLow: null,
            lastUpdated: null,
            sessionNumber: null
        };
        
        this.settings = {
            previousDayHighLow: {
                enabled: false,
                color: '#B22222'
            },
            preMarketHighLow: {
                enabled: false,
                color: '#228B22',
                beginTime: '18:00',
                endTime: '09:30'
            },
            orb30: {
                enabled: false,
                color: '#000000',
                beginTime: '09:30'
            },
            londonHighLow: {
                enabled: false,
                color: '#00CCCC',
                beginTime: '03:00',
                endTime: '08:30'
            }
        };
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
     * Update chart data and sessions
     */
    updateData(chartData, sessions) {
        // Check if session has changed (new session started)
        const currentSession = sessions.find(session => session.relativeNumber === 0);
        const previousSessionNumber = this.priceLevels.sessionNumber;
        
        if (currentSession && previousSessionNumber !== null && 
            currentSession.relativeNumber !== previousSessionNumber) {
            console.log('Session change detected, clearing price levels');
            this.clearPriceLevels();
        }
        
        // Update session number
        if (currentSession) {
            this.priceLevels.sessionNumber = currentSession.relativeNumber;
        }
        
        this.chartData = chartData;
        this.sessions = sessions;
        
        // Recalculate all enabled indicators
        this.recalculateIndicators();
    }

    /**
     * Update settings for internal indicators
     */
    updateSettings(newSettings) {
        const oldSettings = { ...this.settings };
        this.settings = { ...this.settings, ...newSettings };
        
        // Check if Previous Day High/Low settings changed
        if (oldSettings.previousDayHighLow.enabled !== this.settings.previousDayHighLow.enabled ||
            oldSettings.previousDayHighLow.color !== this.settings.previousDayHighLow.color) {
            this.updatePreviousDayHighLow();
        }
        
        // Check if Pre-Market High/Low settings changed
        if (oldSettings.preMarketHighLow.enabled !== this.settings.preMarketHighLow.enabled ||
            oldSettings.preMarketHighLow.color !== this.settings.preMarketHighLow.color ||
            oldSettings.preMarketHighLow.beginTime !== this.settings.preMarketHighLow.beginTime ||
            oldSettings.preMarketHighLow.endTime !== this.settings.preMarketHighLow.endTime) {
            this.updatePreMarketHighLow();
        }
        
        // Check if 30-minute ORB settings changed
        if (oldSettings.orb30.enabled !== this.settings.orb30.enabled ||
            oldSettings.orb30.color !== this.settings.orb30.color ||
            oldSettings.orb30.beginTime !== this.settings.orb30.beginTime) {
            this.updateOrb30();
        }
        
        // Check if London High/Low settings changed
        if (oldSettings.londonHighLow.enabled !== this.settings.londonHighLow.enabled ||
            oldSettings.londonHighLow.color !== this.settings.londonHighLow.color ||
            oldSettings.londonHighLow.beginTime !== this.settings.londonHighLow.beginTime ||
            oldSettings.londonHighLow.endTime !== this.settings.londonHighLow.endTime) {
            this.updateLondonHighLow();
        }
    }

    /**
     * Recalculate all enabled indicators
     */
    recalculateIndicators() {
        if (this.settings.previousDayHighLow.enabled) {
            this.updatePreviousDayHighLow();
        }
        if (this.settings.preMarketHighLow.enabled) {
            this.updatePreMarketHighLow();
        }
        if (this.settings.orb30.enabled) {
            this.updateOrb30();
        }
        if (this.settings.londonHighLow.enabled) {
            this.updateLondonHighLow();
        }
    }

    /**
     * Calculate and update Previous Day High/Low annotations
     */
    updatePreviousDayHighLow() {
        // Remove existing PDH/PDL annotations
        this.removeAnnotationsByType('PDH');
        this.removeAnnotationsByType('PDL');

        if (!this.settings.previousDayHighLow.enabled) {
            return;
        }

        // Find the previous session (-1)
        const previousSession = this.sessions.find(session => session.relativeNumber === -1);
        if (!previousSession || !previousSession.endTime) {
            console.log('No completed previous session found for PDH/PDL calculation');
            return;
        }

        // Get 1-minute data for the previous session
        const oneMinuteData = this.chartData['1m'] || [];
        if (oneMinuteData.length === 0) {
            console.log('No 1-minute data available for PDH/PDL calculation');
            return;
        }

        // Filter candles within the previous session timeframe
        const sessionCandles = oneMinuteData.filter(candle => 
            candle.timestamp >= previousSession.startTime && 
            candle.timestamp <= previousSession.endTime
        );

        if (sessionCandles.length === 0) {
            console.log('No candles found in previous session timeframe');
            return;
        }

        // Find highest and lowest prices in the session
        let highestCandle = sessionCandles[0];
        let lowestCandle = sessionCandles[0];

        sessionCandles.forEach(candle => {
            if (candle.high > highestCandle.high) {
                highestCandle = candle;
            }
            if (candle.low < lowestCandle.low) {
                lowestCandle = candle;
            }
        });

        const pdh = highestCandle.high;
        const pdl = lowestCandle.low;
        const pdhTimestamp = highestCandle.timestamp;
        const pdlTimestamp = lowestCandle.timestamp;

        console.log(`PDH/PDL calculated: PDH=${pdh} at ${new Date(pdhTimestamp).toLocaleTimeString()}, PDL=${pdl} at ${new Date(pdlTimestamp).toLocaleTimeString()}`);

        // Store price levels for trading decisions
        this.priceLevels.previousDayHigh = {
            price: pdh,
            timestamp: pdhTimestamp,
            sessionNumber: previousSession.relativeNumber
        };
        this.priceLevels.previousDayLow = {
            price: pdl,
            timestamp: pdlTimestamp,
            sessionNumber: previousSession.relativeNumber
        };
        this.priceLevels.lastUpdated = Date.now();

        // Create PDH and PDL annotations on all timeframes
        this.createPreviousDayAnnotations(pdh, pdl, pdhTimestamp, pdlTimestamp);
    }

    /**
     * Calculate and update Pre-Market High/Low annotations
     */
    updatePreMarketHighLow() {
        // Remove existing PMH/PML annotations
        this.removeAnnotationsByType('PMH');
        this.removeAnnotationsByType('PML');

        if (!this.settings.preMarketHighLow.enabled) {
            return;
        }

        // Debug: Log available sessions
        console.log('PMH/PML Debug - Available sessions:', this.sessions.map(s => ({
            relativeNumber: s.relativeNumber,
            startTime: new Date(s.startTime).toLocaleString(),
            endTime: s.endTime ? new Date(s.endTime).toLocaleString() : 'Active'
        })));

        // Find the current session (0)
        const currentSession = this.sessions.find(session => session.relativeNumber === 0);
        if (!currentSession) {
            console.log('No current session found for PMH/PML calculation. Available sessions:', this.sessions.length);
            return;
        }

        console.log('PMH/PML Debug - Current session found:', {
            relativeNumber: currentSession.relativeNumber,
            startTime: new Date(currentSession.startTime).toLocaleString(),
            endTime: currentSession.endTime ? new Date(currentSession.endTime).toLocaleString() : 'Active'
        });

        // Get 1-minute data for the current session
        const oneMinuteData = this.chartData['1m'] || [];
        if (oneMinuteData.length === 0) {
            console.log('No 1-minute data available for PMH/PML calculation');
            return;
        }

        // Parse begin and end times
        const beginTime = this.settings.preMarketHighLow.beginTime;
        const endTime = this.settings.preMarketHighLow.endTime;
        
        console.log('PMH/PML Debug - Time range:', { beginTime, endTime });
        
        // Get current time for comparison
        const now = Date.now();
        const nowDate = new Date(now);
        const nowTimeStr = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`;
        console.log('PMH/PML Debug - Current time:', nowTimeStr);
        
        // Filter candles within the current session and pre-market time range
        const sessionCandles = oneMinuteData.filter(candle => {
            if (candle.timestamp < currentSession.startTime) return false;
            if (currentSession.endTime && candle.timestamp > currentSession.endTime) return false;
            
            // Check if candle is within pre-market time range
            const candleDate = new Date(candle.timestamp);
            const candleTimeStr = `${String(candleDate.getHours()).padStart(2, '0')}:${String(candleDate.getMinutes()).padStart(2, '0')}`;
            
            // Handle time range that crosses midnight (e.g., 18:00 to 09:30)
            if (beginTime > endTime) {
                // Range crosses midnight
                return candleTimeStr >= beginTime || candleTimeStr < endTime;
            } else {
                // Range within same day
                return candleTimeStr >= beginTime && candleTimeStr < endTime;
            }
        });

        console.log('PMH/PML Debug - Session candles found:', sessionCandles.length);
        if (sessionCandles.length > 0) {
            console.log('PMH/PML Debug - First candle time:', new Date(sessionCandles[0].timestamp).toLocaleString());
            console.log('PMH/PML Debug - Last candle time:', new Date(sessionCandles[sessionCandles.length - 1].timestamp).toLocaleString());
        }

        if (sessionCandles.length === 0) {
            console.log('No candles found in pre-market time range for current session');
            return;
        }

        // Check if we're currently in the pre-market time range        
        let inPreMarketRange = false;
        if (beginTime > endTime) {
            // Range crosses midnight
            inPreMarketRange = nowTimeStr >= beginTime || nowTimeStr < endTime;
        } else {
            // Range within same day
            inPreMarketRange = nowTimeStr >= beginTime && nowTimeStr < endTime;
        }

        // Check if we have any candles in the pre-market time range
        // We should display PMH/PML if we have historical pre-market data, regardless of current time
        console.log('PMH/PML Debug - Time checks:', { 
            inPreMarketRange, 
            nowTimeStr, 
            beginTime, 
            endTime,
            sessionCandlesCount: sessionCandles.length
        });

        // If we have session candles in the pre-market range, proceed with calculation
        // This allows us to show historical PMH/PML levels even when not currently in pre-market

        // Find highest and lowest prices in the pre-market session
        let highestCandle = sessionCandles[0];
        let lowestCandle = sessionCandles[0];

        sessionCandles.forEach(candle => {
            if (candle.high > highestCandle.high) {
                highestCandle = candle;
            }
            if (candle.low < lowestCandle.low) {
                lowestCandle = candle;
            }
        });

        const pmh = highestCandle.high;
        const pml = lowestCandle.low;
        const pmhTimestamp = highestCandle.timestamp;
        const pmlTimestamp = lowestCandle.timestamp;

        console.log(`PMH/PML calculated: PMH=${pmh} at ${new Date(pmhTimestamp).toLocaleTimeString()}, PML=${pml} at ${new Date(pmlTimestamp).toLocaleTimeString()}`);

        // Store price levels for trading decisions
        this.priceLevels.preMarketHigh = {
            price: pmh,
            timestamp: pmhTimestamp,
            sessionNumber: currentSession.relativeNumber
        };
        this.priceLevels.preMarketLow = {
            price: pml,
            timestamp: pmlTimestamp,
            sessionNumber: currentSession.relativeNumber
        };
        this.priceLevels.lastUpdated = Date.now();

        // Create PMH and PML annotations on all timeframes
        this.createPreMarketAnnotations(pmh, pml, pmhTimestamp, pmlTimestamp);
    }

    /**
     * Calculate and update 30-minute ORB annotations
     */
    updateOrb30() {
        // Remove existing ORB30 annotations
        this.removeAnnotationsByType('ORB30H');
        this.removeAnnotationsByType('ORB30L');

        if (!this.settings.orb30.enabled) {
            return;
        }

        // Find the current session (0)
        const currentSession = this.sessions.find(session => session.relativeNumber === 0);
        if (!currentSession) {
            console.log('No current session found for ORB30 calculation');
            return;
        }

        // Get 1-minute data for the current session
        const oneMinuteData = this.chartData['1m'] || [];
        if (oneMinuteData.length === 0) {
            console.log('No 1-minute data available for ORB30 calculation');
            return;
        }

        // Parse begin time
        const beginTime = this.settings.orb30.beginTime;
        
        // Calculate end time (begin time + 30 minutes)
        const [beginHours, beginMinutes] = beginTime.split(':').map(Number);
        const beginDate = new Date();
        beginDate.setHours(beginHours, beginMinutes, 0, 0);
        
        const endDate = new Date(beginDate.getTime() + 30 * 60 * 1000); // Add 30 minutes
        const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        
        console.log('ORB30 Debug - Time range:', { beginTime, endTime });
        
        // Get current time for comparison
        const now = Date.now();
        const nowDate = new Date(now);
        const nowTimeStr = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`;
        console.log('ORB30 Debug - Current time:', nowTimeStr);
        
        // Check if we've reached the begin time yet
        if (nowTimeStr < beginTime) {
            console.log('ORB30 Debug - Begin time not yet reached');
            return;
        }
        
        // Filter candles within the current session and ORB time range
        const sessionCandles = oneMinuteData.filter(candle => {
            if (candle.timestamp < currentSession.startTime) return false;
            if (currentSession.endTime && candle.timestamp > currentSession.endTime) return false;
            
            // Check if candle is within ORB time range
            const candleDate = new Date(candle.timestamp);
            const candleTimeStr = `${String(candleDate.getHours()).padStart(2, '0')}:${String(candleDate.getMinutes()).padStart(2, '0')}`;
            
            return candleTimeStr >= beginTime && candleTimeStr < endTime;
        });

        console.log('ORB30 Debug - Session candles found:', sessionCandles.length);
        if (sessionCandles.length > 0) {
            console.log('ORB30 Debug - First candle time:', new Date(sessionCandles[0].timestamp).toLocaleString());
            console.log('ORB30 Debug - Last candle time:', new Date(sessionCandles[sessionCandles.length - 1].timestamp).toLocaleString());
        }

        if (sessionCandles.length === 0) {
            console.log('No candles found in ORB30 time range for current session');
            return;
        }

        // Find highest and lowest prices in the ORB30 range
        let highestCandle = sessionCandles[0];
        let lowestCandle = sessionCandles[0];

        sessionCandles.forEach(candle => {
            if (candle.high > highestCandle.high) {
                highestCandle = candle;
            }
            if (candle.low < lowestCandle.low) {
                lowestCandle = candle;
            }
        });

        const orb30H = highestCandle.high;
        const orb30L = lowestCandle.low;
        const orb30HTimestamp = highestCandle.timestamp;
        const orb30LTimestamp = lowestCandle.timestamp;

        console.log(`ORB30 calculated: ORB30H=${orb30H} at ${new Date(orb30HTimestamp).toLocaleTimeString()}, ORB30L=${orb30L} at ${new Date(orb30LTimestamp).toLocaleTimeString()}`);

        // Store price levels for trading decisions
        this.priceLevels.orb30High = {
            price: orb30H,
            timestamp: orb30HTimestamp,
            sessionNumber: currentSession.relativeNumber
        };
        this.priceLevels.orb30Low = {
            price: orb30L,
            timestamp: orb30LTimestamp,
            sessionNumber: currentSession.relativeNumber
        };
        this.priceLevels.lastUpdated = Date.now();

        // Create ORB30 annotations on all timeframes
        this.createOrb30Annotations(orb30H, orb30L, orb30HTimestamp, orb30LTimestamp);
    }

    /**
     * Calculate and update London High/Low annotations
     */
    updateLondonHighLow() {
        // Remove existing London annotations
        this.removeAnnotationsByType('LONH');
        this.removeAnnotationsByType('LONL');

        if (!this.settings.londonHighLow.enabled) {
            return;
        }

        // Find the current session (0)
        const currentSession = this.sessions.find(session => session.relativeNumber === 0);
        if (!currentSession) {
            console.log('No current session found for London High/Low calculation');
            return;
        }

        // Get 1-minute data for the current session
        const oneMinuteData = this.chartData['1m'] || [];
        if (oneMinuteData.length === 0) {
            console.log('No 1-minute data available for London High/Low calculation');
            return;
        }

        // Parse begin and end times
        const beginTime = this.settings.londonHighLow.beginTime;
        const endTime = this.settings.londonHighLow.endTime;
        
        console.log('London High/Low Debug - Time range:', { beginTime, endTime });
        
        // Get current time for comparison
        const now = Date.now();
        const nowDate = new Date(now);
        const nowTimeStr = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`;
        console.log('London High/Low Debug - Current time:', nowTimeStr);
        
        // Check if we've reached the begin time yet
        if (nowTimeStr < beginTime) {
            console.log('London High/Low Debug - Begin time not yet reached');
            return;
        }
        
        // Filter candles within the current session and London time range
        const sessionCandles = oneMinuteData.filter(candle => {
            if (candle.timestamp < currentSession.startTime) return false;
            if (currentSession.endTime && candle.timestamp > currentSession.endTime) return false;
            
            // Check if candle is within London time range
            const candleDate = new Date(candle.timestamp);
            const candleTimeStr = `${String(candleDate.getHours()).padStart(2, '0')}:${String(candleDate.getMinutes()).padStart(2, '0')}`;
            
            // Handle time range that may cross midnight (though 03:00 to 11:00 doesn't)
            if (beginTime > endTime) {
                // Range crosses midnight
                return candleTimeStr >= beginTime || candleTimeStr < endTime;
            } else {
                // Range within same day
                return candleTimeStr >= beginTime && candleTimeStr < endTime;
            }
        });

        console.log('London High/Low Debug - Session candles found:', sessionCandles.length);
        if (sessionCandles.length > 0) {
            console.log('London High/Low Debug - First candle time:', new Date(sessionCandles[0].timestamp).toLocaleString());
            console.log('London High/Low Debug - Last candle time:', new Date(sessionCandles[sessionCandles.length - 1].timestamp).toLocaleString());
        }

        if (sessionCandles.length === 0) {
            console.log('No candles found in London time range for current session');
            return;
        }

        // Find highest and lowest prices in the London session
        let highestCandle = sessionCandles[0];
        let lowestCandle = sessionCandles[0];

        sessionCandles.forEach(candle => {
            if (candle.high > highestCandle.high) {
                highestCandle = candle;
            }
            if (candle.low < lowestCandle.low) {
                lowestCandle = candle;
            }
        });

        const lonH = highestCandle.high;
        const lonL = lowestCandle.low;
        const lonHTimestamp = highestCandle.timestamp;
        const lonLTimestamp = lowestCandle.timestamp;

        console.log(`London High/Low calculated: LONH=${lonH} at ${new Date(lonHTimestamp).toLocaleTimeString()}, LONL=${lonL} at ${new Date(lonLTimestamp).toLocaleTimeString()}`);

        // Store price levels for trading decisions
        this.priceLevels.londonHigh = {
            price: lonH,
            timestamp: lonHTimestamp,
            sessionNumber: currentSession.relativeNumber
        };
        this.priceLevels.londonLow = {
            price: lonL,
            timestamp: lonLTimestamp,
            sessionNumber: currentSession.relativeNumber
        };
        this.priceLevels.lastUpdated = Date.now();

        // Create London High/Low annotations on all timeframes
        this.createLondonAnnotations(lonH, lonL, lonHTimestamp, lonLTimestamp);
    }

    /**
     * Create Previous Day High/Low annotations on all charts
     */
    createPreviousDayAnnotations(pdh, pdl, pdhTimestamp, pdlTimestamp) {
        if (!this.sciChartSurfaceRefs || !this.sciChartSurfaceRefs.current) {
            console.log('SciChart surface refs not available');
            return;
        }

        const color = this.settings.previousDayHighLow.color;

        this.timeframes.forEach(timeframe => {
            const chartSurface = this.sciChartSurfaceRefs.current[timeframe];
            if (!chartSurface) {
                console.log(`Chart surface not available for timeframe: ${timeframe}`);
                return;
            }

            // Create PDH annotation
            const pdhAnnotation = new HorizontalLineAnnotation({
                id: `internal-pdh-${timeframe}`,
                stroke: color,
                strokeThickness: 3,
                //strokeDashArray: [8, 4],
                strokeDashArray: [],
                y1: pdh,
                x1: pdhTimestamp,
                isEditable: false,
                showLabel: true,
                labelPlacement: "BottomRight",
                labelValue: `PDH ${pdh}`,
                axisLabelFill: color,
                axisLabelStroke: '#FFFFFF',
                axisFontSize: 12,
                yAxisId: 'yAxis'
            });

            // Create PDL annotation
            const pdlAnnotation = new HorizontalLineAnnotation({
                id: `internal-pdl-${timeframe}`,
                stroke: color,
                strokeThickness: 3,
                //strokeDashArray: [8, 4],
                strokeDashArray: [],
                y1: pdl,
                x1: pdlTimestamp,
                isEditable: false,
                showLabel: true,
                labelPlacement: "BottomRight",
                labelValue: `PDL ${pdl}`,
                axisLabelFill: color,
                axisLabelStroke: '#FFFFFF',
                axisFontSize: 12,
                yAxisId: 'yAxis'
            });

            // Add annotations to chart
            chartSurface.annotations.add(pdhAnnotation);
            chartSurface.annotations.add(pdlAnnotation);
            chartSurface.invalidateElement();

            // Store in our internal map
            this.annotations.set(`internal-pdh-${timeframe}`, {
                annotation: pdhAnnotation,
                type: 'PDH',
                timeframe: timeframe,
                value: pdh,
                timestamp: pdhTimestamp
            });

            this.annotations.set(`internal-pdl-${timeframe}`, {
                annotation: pdlAnnotation,
                type: 'PDL',
                timeframe: timeframe,
                value: pdl,
                timestamp: pdlTimestamp
            });

            console.log(`Created PDH/PDL annotations for ${timeframe}: PDH=${pdh}, PDL=${pdl}`);
        });
    }

    /**
     * Create Pre-Market High/Low annotations on all charts
     */
    createPreMarketAnnotations(pmh, pml, pmhTimestamp, pmlTimestamp) {
        if (!this.sciChartSurfaceRefs || !this.sciChartSurfaceRefs.current) {
            console.log('SciChart surface refs not available');
            return;
        }

        const color = this.settings.preMarketHighLow.color;

        this.timeframes.forEach(timeframe => {
            const chartSurface = this.sciChartSurfaceRefs.current[timeframe];
            if (!chartSurface) {
                console.log(`Chart surface not available for timeframe: ${timeframe}`);
                return;
            }

            // Create PMH annotation
            const pmhAnnotation = new HorizontalLineAnnotation({
                id: `internal-pmh-${timeframe}`,
                stroke: color,
                strokeThickness: 3,
                //strokeDashArray: [6, 6],
                strokeDashArray: [],
                y1: pmh,
                x1: pmhTimestamp,
                isEditable: false,
                showLabel: true,
                labelPlacement: "TopRight",
                labelValue: `PMH ${pmh}`,
                axisLabelFill: color,
                axisLabelStroke: '#FFFFFF',
                axisFontSize: 12,
                yAxisId: 'yAxis'
            });

            // Create PML annotation
            const pmlAnnotation = new HorizontalLineAnnotation({
                id: `internal-pml-${timeframe}`,
                stroke: color,
                strokeThickness: 3,
                //strokeDashArray: [6, 6],
                strokeDashArray: [],
                y1: pml,
                x1: pmlTimestamp,
                isEditable: false,
                showLabel: true,
                labelPlacement: "TopRight",
                labelValue: `PML ${pml}`,
                axisLabelFill: color,
                axisLabelStroke: '#FFFFFF',
                axisFontSize: 12,
                yAxisId: 'yAxis'
            });

            // Add annotations to chart
            chartSurface.annotations.add(pmhAnnotation);
            chartSurface.annotations.add(pmlAnnotation);
            chartSurface.invalidateElement();

            // Store in our internal map
            this.annotations.set(`internal-pmh-${timeframe}`, {
                annotation: pmhAnnotation,
                type: 'PMH',
                timeframe: timeframe,
                value: pmh,
                timestamp: pmhTimestamp
            });

            this.annotations.set(`internal-pml-${timeframe}`, {
                annotation: pmlAnnotation,
                type: 'PML',
                timeframe: timeframe,
                value: pml,
                timestamp: pmlTimestamp
            });

            console.log(`Created PMH/PML annotations for ${timeframe}: PMH=${pmh}, PML=${pml}`);
        });
    }

    /**
     * Create 30-minute ORB annotations on all charts
     */
    createOrb30Annotations(orb30H, orb30L, orb30HTimestamp, orb30LTimestamp) {
        if (!this.sciChartSurfaceRefs || !this.sciChartSurfaceRefs.current) {
            console.log('SciChart surface refs not available');
            return;
        }

        const color = this.settings.orb30.color;

        this.timeframes.forEach(timeframe => {
            const chartSurface = this.sciChartSurfaceRefs.current[timeframe];
            if (!chartSurface) {
                console.log(`Chart surface not available for timeframe: ${timeframe}`);
                return;
            }

            // Create ORB30H annotation
            const orb30HAnnotation = new HorizontalLineAnnotation({
                id: `internal-orb30h-${timeframe}`,
                stroke: color,
                strokeThickness: 1,
                strokeDashArray: [5, 5],
                y1: orb30H,
                x1: orb30HTimestamp,
                isEditable: false,
                showLabel: true,
                labelPlacement: "Bottom",
                labelValue: `o30H ${orb30H}`,
                axisLabelFill: color,
                axisLabelStroke: '#FFFFFF',
                axisFontSize: 12,
                yAxisId: 'yAxis'
            });

            // Create ORB30L annotation
            const orb30LAnnotation = new HorizontalLineAnnotation({
                id: `internal-orb30l-${timeframe}`,
                stroke: color,
                strokeThickness: 1,
                strokeDashArray: [5, 5],
                y1: orb30L,
                x1: orb30LTimestamp,
                isEditable: false,
                showLabel: true,
                labelPlacement: "Bottom",
                labelValue: `o30L ${orb30L}`,
                axisLabelFill: color,
                axisLabelStroke: '#FFFFFF',
                axisFontSize: 12,
                yAxisId: 'yAxis'
            });

            // Add annotations to chart
            chartSurface.annotations.add(orb30HAnnotation);
            chartSurface.annotations.add(orb30LAnnotation);
            chartSurface.invalidateElement();

            // Store in our internal map
            this.annotations.set(`internal-orb30h-${timeframe}`, {
                annotation: orb30HAnnotation,
                type: 'ORB30H',
                timeframe: timeframe,
                value: orb30H,
                timestamp: orb30HTimestamp
            });

            this.annotations.set(`internal-orb30l-${timeframe}`, {
                annotation: orb30LAnnotation,
                type: 'ORB30L',
                timeframe: timeframe,
                value: orb30L,
                timestamp: orb30LTimestamp
            });

            console.log(`Created ORB30 annotations for ${timeframe}: ORB30H=${orb30H}, ORB30L=${orb30L}`);
        });
    }

    /**
     * Create London High/Low annotations on all charts
     */
    createLondonAnnotations(lonH, lonL, lonHTimestamp, lonLTimestamp) {
        if (!this.sciChartSurfaceRefs || !this.sciChartSurfaceRefs.current) {
            console.log('SciChart surface refs not available');
            return;
        }

        const color = this.settings.londonHighLow.color;

        this.timeframes.forEach(timeframe => {
            const chartSurface = this.sciChartSurfaceRefs.current[timeframe];
            if (!chartSurface) {
                console.log(`Chart surface not available for timeframe: ${timeframe}`);
                return;
            }

            // Create London High annotation
            const lonHAnnotation = new HorizontalLineAnnotation({
                id: `internal-lonh-${timeframe}`,
                stroke: color,
                strokeThickness: 1,
                strokeDashArray: [4,3,1,3],
                y1: lonH,
                x1: lonHTimestamp,
                isEditable: false,
                showLabel: true,
                labelPlacement: "Top",
                labelValue: `LnH ${lonH}`,
                axisLabelFill: color,
                axisLabelStroke: '#000000',
                axisFontSize: 12,
                yAxisId: 'yAxis'
            });

            // Create London Low annotation
            const lonLAnnotation = new HorizontalLineAnnotation({
                id: `internal-lonl-${timeframe}`,
                stroke: color,
                strokeThickness: 1,
                strokeDashArray: [4,3,1,3],
                y1: lonL,
                x1: lonLTimestamp,
                isEditable: false,
                showLabel: true,
                labelPlacement: "Top",
                labelValue: `LnL ${lonL}`,
                axisLabelFill: color,
                axisLabelStroke: '#000000',
                axisFontSize: 12,
                yAxisId: 'yAxis'
            });

            // Add annotations to chart
            chartSurface.annotations.add(lonHAnnotation);
            chartSurface.annotations.add(lonLAnnotation);
            chartSurface.invalidateElement();

            // Store in our internal map
            this.annotations.set(`internal-lonh-${timeframe}`, {
                annotation: lonHAnnotation,
                type: 'LONH',
                timeframe: timeframe,
                value: lonH,
                timestamp: lonHTimestamp
            });

            this.annotations.set(`internal-lonl-${timeframe}`, {
                annotation: lonLAnnotation,
                type: 'LONL',
                timeframe: timeframe,
                value: lonL,
                timestamp: lonLTimestamp
            });

            console.log(`Created London High/Low annotations for ${timeframe}: LONH=${lonH}, LONL=${lonL}`);
        });
    }

    /**
     * Remove annotations by type
     */
    removeAnnotationsByType(type) {
        if (!this.sciChartSurfaceRefs || !this.sciChartSurfaceRefs.current) {
            return;
        }

        // Find annotations of the specified type
        const annotationsToRemove = [];
        this.annotations.forEach((data, id) => {
            if (data.type === type) {
                annotationsToRemove.push(id);
            }
        });

        // Remove from charts and internal map
        annotationsToRemove.forEach(id => {
            const data = this.annotations.get(id);
            if (data) {
                const chartSurface = this.sciChartSurfaceRefs.current[data.timeframe];
                if (chartSurface) {
                    // CRITICAL FIX: Call delete() method on annotation to free WebGL resources
                    if (typeof data.annotation.delete === 'function') {
                        try {
                            data.annotation.delete();
                        } catch (error) {
                            console.warn(`Error calling delete() on ${type} annotation: ${error.message}`);
                        }
                    }
                    chartSurface.annotations.remove(data.annotation);
                    chartSurface.invalidateElement();
                }
                this.annotations.delete(id);
            }
        });
    }

    /**
     * Remove all internal annotations
     */
    removeAllAnnotations() {
        if (!this.sciChartSurfaceRefs || !this.sciChartSurfaceRefs.current) {
            return;
        }

        this.annotations.forEach((data, id) => {
            const chartSurface = this.sciChartSurfaceRefs.current[data.timeframe];
            if (chartSurface) {
                // CRITICAL FIX: Call delete() method on annotation to free WebGL resources
                if (typeof data.annotation.delete === 'function') {
                    try {
                        data.annotation.delete();
                    } catch (error) {
                        console.warn(`Error calling delete() on internal annotation: ${error.message}`);
                    }
                }
                chartSurface.annotations.remove(data.annotation);
                chartSurface.invalidateElement();
            }
        });

        this.annotations.clear();
    }

    /**
     * Get current settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Get all current price levels for trading decisions
     * @returns {Object} Price levels with metadata
     */
    getPriceLevels() {
        return { ...this.priceLevels };
    }

    /**
     * Get a specific price level by name
     * @param {string} levelName Name of the price level
     * @returns {Object|null} Price level data or null if not available
     */
    getPriceLevel(levelName) {
        return this.priceLevels[levelName] || null;
    }

    /**
     * Check if price is near a significant level (within tolerance)
     * @param {number} price Current price to check
     * @param {number} tolerance Tolerance in price units (default: 0.25)
     * @returns {Array} Array of nearby levels with distance
     */
    getNearbyLevels(price, tolerance = 0.25) {
        const nearbyLevels = [];
        
        Object.entries(this.priceLevels).forEach(([levelName, levelData]) => {
            if (levelData && typeof levelData === 'object' && levelData.price) {
                const distance = Math.abs(price - levelData.price);
                if (distance <= tolerance) {
                    nearbyLevels.push({
                        name: levelName,
                        price: levelData.price,
                        distance: distance,
                        timestamp: levelData.timestamp,
                        sessionNumber: levelData.sessionNumber
                    });
                }
            }
        });
        
        // Sort by distance (closest first)
        return nearbyLevels.sort((a, b) => a.distance - b.distance);
    }

    /**
     * Get price levels formatted for Shared Client integration
     * @returns {Object} Price levels in Shared Client format
     */
    getPriceLevelsForSharedClient() {
        const currentSession = this.sessions.find(session => session.relativeNumber === 0);
        
        return {
            levels: this.priceLevels,
            metadata: {
                lastUpdated: this.priceLevels.lastUpdated,
                currentSessionNumber: currentSession ? currentSession.relativeNumber : null,
                enabledIndicators: Object.entries(this.settings)
                    .filter(([key, setting]) => setting.enabled)
                    .map(([key]) => key)
            }
        };
    }

    /**
     * Clear price levels (called when session changes)
     */
    clearPriceLevels() {
        Object.keys(this.priceLevels).forEach(key => {
            if (key !== 'lastUpdated' && key !== 'sessionNumber') {
                this.priceLevels[key] = null;
            }
        });
        this.priceLevels.lastUpdated = Date.now();
    }
}

// Create a singleton instance
const internalStrategyAnnotations = new InternalStrategyAnnotations();

export default internalStrategyAnnotations; 