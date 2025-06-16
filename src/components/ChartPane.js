import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SciChartSurface } from 'scichart';
import { NumericAxis } from 'scichart/Charting/Visuals/Axis/NumericAxis';
import { OhlcDataSeries } from 'scichart/Charting/Model/OhlcDataSeries';
import { FastCandlestickRenderableSeries } from 'scichart/Charting/Visuals/RenderableSeries/FastCandlestickRenderableSeries';
import { FastLineRenderableSeries } from 'scichart/Charting/Visuals/RenderableSeries/FastLineRenderableSeries';
import { XyDataSeries } from 'scichart/Charting/Model/XyDataSeries';
import { MouseWheelZoomModifier } from 'scichart/Charting/ChartModifiers/MouseWheelZoomModifier';
import { ZoomPanModifier } from 'scichart/Charting/ChartModifiers/ZoomPanModifier';
import { YAxisDragModifier } from 'scichart/Charting/ChartModifiers/YAxisDragModifier';
import { XAxisDragModifier } from 'scichart/Charting/ChartModifiers/XAxisDragModifier';
import { ZoomExtentsModifier } from 'scichart/Charting/ChartModifiers/ZoomExtentsModifier';
import {
    HorizontalLineAnnotation,
    VerticalLineAnnotation,
    BoxAnnotation,
    LineAnnotation,
    CustomAnnotation,
    NativeTextAnnotation,
    DefaultPaletteProvider,
    EStrokePaletteMode,
    parseColorToUIntArgb
} from 'scichart';
import { EasternTimeLabelProvider, CustomTickProvider } from '../utils/CustomProviders';
import { resetToDefaultRange, getReadableTextColor, getArrowAnchorPoints, createArrowSvg, timeframeToMilliseconds } from '../utils/chartUtils';

// Import the reset button image
import resetButtonIcon from '../images/button-reset-range.png';

// Candle Countdown Timer Component
const CandleCountdown = ({ isLiveMode, isReplayMode, timeframe, candleData }) => {
    const [timeRemaining, setTimeRemaining] = useState('--:--');
    const [activeTargetTimestamp, setActiveTargetTimestamp] = useState(null);
    const [isWarningTime, setIsWarningTime] = useState(false); // State for background color
    const intervalIdRef = useRef(null);
    const nextCandleTimestampRef = useRef(null); 
    const hasInitializedTargetRef = useRef(false);
    const lastDataUpdateTimeRef = useRef(null); // Tracks when candleData was last updated

    // Effect 1: Calculate/reset target timestamp state and track data updates
    useEffect(() => {
        console.log(`[${timeframe}] Target Effect Check. Live: ${isLiveMode}, Replay: ${isReplayMode}, Initialized: ${hasInitializedTargetRef.current}, DataLen: ${candleData?.length}`);
        
        if (isLiveMode && !isReplayMode) {
            // Always update the last data update time if we are in a mode where the timer *could* run
             lastDataUpdateTimeRef.current = Date.now();
             console.log(`[${timeframe}] Updated lastDataUpdateTimeRef: ${new Date(lastDataUpdateTimeRef.current).toISOString()}`);

            // Initialize or re-initialize target if needed
            if (!hasInitializedTargetRef.current && candleData && candleData.length >= 1) { // Now need only 1 candle
                const liveCandle = candleData[candleData.length - 1]; // Use the current live candle
                const liveTimestamp = liveCandle.timestamp;
                const intervalMs = timeframeToMilliseconds(timeframe);
                // Target is the END time of the current live candle's interval
                const newTarget = Math.floor(liveTimestamp / intervalMs) * intervalMs + intervalMs;
                
                setActiveTargetTimestamp(newTarget); // Set state to trigger timer effect
                hasInitializedTargetRef.current = true;
                console.log(`[${timeframe}] Initial target calculated based on live candle ${new Date(liveTimestamp).toISOString()}. State target set to: ${new Date(newTarget).toISOString()}`);
            }
        } else {
            // Exiting live mode or entering replay: Reset everything
            if (activeTargetTimestamp !== null) { 
                 console.log(`[${timeframe}] Exiting live mode or entering replay. Resetting target state.`);
                 setActiveTargetTimestamp(null);
            }
            hasInitializedTargetRef.current = false;
            lastDataUpdateTimeRef.current = null; // Clear last update time
            setTimeRemaining('--:--');
            setIsWarningTime(false); // Reset warning state
        }
    }, [isLiveMode, isReplayMode, timeframe, candleData]); // Rerun when mode, tf, or data changes


    // Effect 2: Manage the timer interval based on activeTargetTimestamp state and idle check
    useEffect(() => {
         // Define updateTimer inside this effect so it closes over the correct refs and state
         const updateTimer = () => {
            // --- Idle Check --- 
            if (lastDataUpdateTimeRef.current && (Date.now() - lastDataUpdateTimeRef.current > 60000)) {
                console.log(`[${timeframe}] Idle timeout detected (>${(Date.now() - lastDataUpdateTimeRef.current)/1000}s). Stopping timer.`);
                setActiveTargetTimestamp(null); // Trigger timer stop
                hasInitializedTargetRef.current = false; // Allow re-initialization on next data
                setTimeRemaining('--:--');
                setIsWarningTime(false); // Reset warning state
                // No need to clear interval here, effect cleanup handles it when activeTargetTimestamp becomes null
                return;
            }

            // --- Target Check --- 
             if (nextCandleTimestampRef.current === null) {
                 console.warn(`[${timeframe}] updateTimer called but nextCandleTimestampRef is null.`);
                 setTimeRemaining('--:--');
                 setIsWarningTime(false); // Reset warning state
                 // Potentially stop interval if it's somehow still running? Should be stopped by effect logic.
                 if (intervalIdRef.current) {
                      console.warn(`[${timeframe}] Clearing unexpected running interval.`);
                      clearInterval(intervalIdRef.current);
                      intervalIdRef.current = null;
                 }
                 return;
             }
 
             // --- Countdown Logic --- 
             const now = Date.now();
             let targetTime = nextCandleTimestampRef.current;
             const intervalMs = timeframeToMilliseconds(timeframe);
 
             // Handle rollover
             while (now >= targetTime) {
                 targetTime += intervalMs;
             }
             if (targetTime !== nextCandleTimestampRef.current) {
                 console.log(`[${timeframe}] Rollover detected inside interval. New target: ${new Date(targetTime).toISOString()}`);
                 nextCandleTimestampRef.current = targetTime; // Update ref for next tick
             }
 
             // Calculate remaining time
             let remaining = targetTime - now;
             if (remaining < 0) remaining = 0;
             
             const minutes = Math.floor(remaining / 60000);
             remaining %= 60000;
             const seconds = Math.floor(remaining / 1000);
 
             setTimeRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

             // Update warning state
             const totalSecondsRemaining = minutes * 60 + seconds;
             setIsWarningTime(totalSecondsRemaining <= 10 && totalSecondsRemaining > 0);
         };

        console.log(`[${timeframe}] Timer Effect Check. Active Target: ${activeTargetTimestamp ? new Date(activeTargetTimestamp).toISOString() : 'null'}, Live: ${isLiveMode}, Replay: ${isReplayMode}`);

        // --- Start/Stop Logic --- 
        if (activeTargetTimestamp !== null && isLiveMode && !isReplayMode) {
            // Start the timer: we have an active target and are in the right mode
            nextCandleTimestampRef.current = activeTargetTimestamp; // Sync ref with state target
            lastDataUpdateTimeRef.current = Date.now(); // Ensure update time is current when timer starts/restarts
            
            console.log(`[${timeframe}] Starting timer interval.`);
            updateTimer(); // Run immediately to display initial time
            // Clear any existing interval *before* starting a new one (important)
            if (intervalIdRef.current) clearInterval(intervalIdRef.current);
            intervalIdRef.current = setInterval(updateTimer, 1000);
            
        } else {
             // Stop the timer: No active target or wrong mode
             if (intervalIdRef.current) {
                 console.log(`[${timeframe}] Clearing timer interval because target is null or mode changed.`);
                 clearInterval(intervalIdRef.current);
                 intervalIdRef.current = null;
             }
             // Ensure warning is off if timer is not running
              if (timeRemaining !== '--:--') setTimeRemaining('--:--');
              if (isWarningTime) setIsWarningTime(false);
        }

        // --- Cleanup --- 
        // Cleanup for *this effect*: always clear the interval
        return () => {
            if (intervalIdRef.current) {
                console.log(`[${timeframe}] Cleaning up timer interval.`);
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
        };
    // Only trigger this effect when the target state or modes change
    }, [activeTargetTimestamp, isLiveMode, isReplayMode, timeframe, timeRemaining, isWarningTime]); 

    // --- Render Logic --- 
    if (!isLiveMode || isReplayMode) {
        return null;
    }
    
    return (
        <div style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            backgroundColor: isWarningTime ? 'rgba(80, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.7)', // Conditional background
            color: '#FFFFFF',
            padding: '2px 8px', // Reduced vertical padding
            borderRadius: '4px',
            fontSize: '12px', // Smaller font size
            // fontWeight: 'bold', // Removed bold weight
            // boxShadow: '0 0 5px rgba(0, 0, 0, 0.5)', // Removed box shadow
            border: '1px solid rgba(255, 255, 255, 0.3)',
            zIndex: 50,
            pointerEvents: 'none'
        }}>
            {timeRemaining}
        </div>
    );
};

// Custom PaletteProvider for line series
class ComparisonLinePaletteProvider extends DefaultPaletteProvider {
    constructor(upColor, downColor, dataSeries) {
        super();
        this.strokePaletteMode = EStrokePaletteMode.SOLID;
        this.upColor = parseColorToUIntArgb(upColor);
        this.downColor = parseColorToUIntArgb(downColor);
        this.dataSeries = dataSeries; // Store the XyDataSeries reference
    }

    overrideStrokeArgb(xValue, yValue, index, opacity, metadata) {
        if (index === 0 || !this.dataSeries || this.dataSeries.count() <= 1) {
            // For the first point, or if dataSeries is not yet populated, use a default or undefined
            return undefined; 
        }

        const yValues = this.dataSeries.getNativeYValues();
        const previousYValue = yValues.get(index - 1);

        if (yValue > previousYValue) {
            return this.upColor;
        } else {
            return this.downColor;
        }
    }
}

// ChartPane component with crosshair functionality
function ChartPane({ 
    instrument, 
    timeframe, 
    candleData, 
    chartBehavior, 
    colors, 
    gridOptions, 
    candleWidth, 
    isCrosshairMode, 
    isLineMode, 
    isBoxMode, 
    isTrendMode, 
    isArrowMode, 
    isTextMode,
    isDrawingLockMode,
    lineColor, 
    lineType, 
    showLabel, 
    lineOrientation, 
    setIsLineMode, 
    setIsBoxMode, 
    setIsTrendMode, 
    setIsArrowMode, 
    setIsTextMode,
    setDataSeriesRef, 
    setLastPriceLineRef, 
    setSciChartSurfaceRef, 
    livePrice, 
    boxOpacity, 
    arrowDirection, 
    arrowSize, 
    arrowStyle, 
    annotationText,
    fontSize,
    textAnchor,
    onAnnotationCreated, 
    onAnnotationUpdated, 
    onAnnotationDeleted, 
    generateAnnotationId,
    onCrosshairMove,
    isLiveMode,
    isReplayMode,
    chartType = 'Candle' // New prop to control chart type (default: 'Candle')
}) {
    const chartRef = useRef(null);
    const sciChartSurfaceRef = useRef(null);
    const lastPriceLineRef = useRef(null);
    const dataSeriesRef = useRef(null);
    const lineDataSeriesRef = useRef(null); // New ref for line data series
    const candlestickSeriesRef = useRef(null); // New ref for candlestick series
    const lineSeriesRef = useRef(null); // New ref for line series
    const [isInitialized, setIsInitialized] = useState(false);
    const settingsRef = useRef(chartBehavior);
    const verticalLineRef = useRef(null);
    const cursorHorizontalLineRef = useRef(null);
    const isCrosshairModeRef = useRef(isCrosshairMode);
    const lineAnnotationsRef = useRef([]);
    const initialDataLoadedRef = useRef(false);
    
    const lineTypeOptions = {
        horizontal: [5, 5],
        vertical: [1, 0],
        solid: [],
        dash: [4, 4],
        dot: [1, 3]
    };
    const boxAnnotationRef = useRef(null);
    const isDrawingBoxRef = useRef(false);
    const boxStartCoordinatesRef = useRef({ x: 0, y: 0 });
    const trendLineRef = useRef(null);
    const isDrawingTrendLineRef = useRef(false);
    const trendLineStartCoordinatesRef = useRef({ x: 0, y: 0 });

    const handleLineColorChange = (event) => lineColor(event.target.value);
    const handleLineTypeChange = (event) => lineType(event.target.value);
    const handleShowLabelChange = (event) => showLabel(event.target.checked);
    
    // Define updateCrosshair first, before any useEffects reference it
    const updateCrosshair = useCallback((timestamp, yValue) => {
        if (!sciChartSurfaceRef.current || !verticalLineRef.current || !cursorHorizontalLineRef.current || !isCrosshairModeRef.current) return;
        
        verticalLineRef.current.isHidden = false;
        verticalLineRef.current.x1 = timestamp;
        
        // Format the timestamp for the vertical line label
        const timestampDate = new Date(timestamp);
        const month = (timestampDate.getMonth() + 1).toString(); // getMonth is 0-indexed
        const day = timestampDate.getDate().toString().padStart(2, '0');
        const hours = timestampDate.getHours().toString().padStart(2, '0');
        const minutes = timestampDate.getMinutes().toString().padStart(2, '0');
        verticalLineRef.current.labelValue = `${month}/${day} ${hours}:${minutes}`;
        
        cursorHorizontalLineRef.current.isHidden = false;
        cursorHorizontalLineRef.current.y1 = yValue;
        
        // Add null/undefined check before calling toFixed
        if (yValue === null || yValue === undefined) {
            cursorHorizontalLineRef.current.labelValue = '';
        } else {
            cursorHorizontalLineRef.current.labelValue = yValue.toFixed(2);
        }
        
        sciChartSurfaceRef.current.invalidateElement();
    }, []);

    useEffect(() => {
        settingsRef.current = chartBehavior;
    }, [chartBehavior]);

    // Update isCrosshairModeRef whenever isCrosshairMode changes
    useEffect(() => {
        isCrosshairModeRef.current = isCrosshairMode;
    }, [isCrosshairMode]);

    // Pass refs to parent - Revised
    useEffect(() => {
        // Only pass refs once the chart is initialized AND the refs are set
        if (isInitialized && dataSeriesRef.current && lastPriceLineRef.current && sciChartSurfaceRef.current) {
            console.log(`ChartPane[${timeframe}] Passing refs up:`, {
                dataSeries: !!dataSeriesRef.current,
                lastPriceLine: !!lastPriceLineRef.current,
                sciChartSurface: !!sciChartSurfaceRef.current
            });
            
            // Attach the updateCrosshair method to the sciChartSurface object
            sciChartSurfaceRef.current.updateCrosshair = updateCrosshair;
            
            setDataSeriesRef(timeframe, dataSeriesRef.current);
            setLastPriceLineRef(timeframe, lastPriceLineRef.current);
            // Pass the actual surface object, not the ref object
            setSciChartSurfaceRef(timeframe, sciChartSurfaceRef.current);
        }
    // Add isInitialized as a dependency
    }, [isInitialized, timeframe, setDataSeriesRef, setLastPriceLineRef, setSciChartSurfaceRef, updateCrosshair]);

    // Debug log for instrument and timeframe values
    useEffect(() => {
        console.log(`ChartPane title values - instrument: "${instrument}", timeframe: "${timeframe}"`);
    }, [instrument, timeframe]);

    // Hide crosshair annotations when isCrosshairMode is false
    useEffect(() => {
        if (!isCrosshairMode && sciChartSurfaceRef.current && verticalLineRef.current && cursorHorizontalLineRef.current) {
            verticalLineRef.current.isHidden = true;
            cursorHorizontalLineRef.current.isHidden = true;
            sciChartSurfaceRef.current.invalidateElement();
        }
    }, [isCrosshairMode]);

    useEffect(() => {
        const initChart = async () => {
            if (!chartRef.current) {
                console.error(`Chart container for ${timeframe} not mounted yet.`);
                return;
            }

            // Add a unique ID to the chart container to ensure SciChart can reference it
            chartRef.current.id = `chart-${timeframe}-container`;
            
            console.log(`Initializing chart for ${timeframe}`);
            try {
                const { sciChartSurface, wasmContext } = await SciChartSurface.create(chartRef.current);
                sciChartSurfaceRef.current = sciChartSurface;
                console.log(`Chart surface created successfully for ${timeframe}`);
                
                // Ensure the SciChart canvas has a lower z-index than our UI overlays
                // Find the canvas element created by SciChart and set its z-index
                if (chartRef.current) {
                    const canvasElements = chartRef.current.querySelectorAll('canvas');
                    canvasElements.forEach(canvas => {
                        canvas.style.zIndex = '5'; // Lower than our overlay z-index of 1000
                    });
                }

                // Calculate candle interval based on timeframe
                let candleInterval;
                if (timeframe.endsWith('m')) {
                    const minutes = parseInt(timeframe.slice(0, -1));
                    candleInterval = minutes * 60 * 1000; // Convert to milliseconds
                } else if (timeframe.endsWith('h')) {
                    const hours = parseInt(timeframe.slice(0, -1));
                    candleInterval = hours * 60 * 60 * 1000; // Convert to milliseconds
                } else {
                    console.warn(`Unknown timeframe: ${timeframe}. Defaulting to 1m.`);
                    candleInterval = 60 * 1000; // Default to 1 minute
                }

                const xAxis = new NumericAxis(wasmContext, {
                    id: 'xAxis',
                    labelProvider: new EasternTimeLabelProvider(),
                    labelStyle: { color: colors.axisText },
                    drawMajorBands: gridOptions.xAxisShading,
                    drawMajorGridLines: gridOptions.gridlines,
                    drawMinorGridLines: gridOptions.gridlines,
                });
                console.log(`X axis just init'd - visible range: ${xAxis.visibleRange}`);
                console.log(`X Grid Mm- ${xAxis.drawMajorGridLines} / ${xAxis.drawMinorGridLines}`);
                console.log(`X Tick Mm- ${xAxis.drawMajorTickLines} / ${xAxis.drawMinorTickLines}`);
                xAxis.tickProvider = new CustomTickProvider(wasmContext, candleInterval);
                sciChartSurface.xAxes.add(xAxis);

                const yAxis = new NumericAxis(wasmContext, {
                    id: 'yAxis',
                    labelStyle: { color: colors.axisText },
                    drawMajorBands: gridOptions.yAxisShading,
                    drawMajorGridLines: gridOptions.gridlines,
                    drawMinorGridLines: gridOptions.gridlines,
                });
                sciChartSurface.yAxes.add(yAxis);

                // Create the OHLC data series for candlesticks
                const dataSeries = new OhlcDataSeries(wasmContext);
                dataSeriesRef.current = dataSeries;

                // Create candlestick series
                const candlestickSeries = new FastCandlestickRenderableSeries(wasmContext, {
                    dataSeries,
                    strokeUp: colors.upCandleStroke,
                    brushUp: colors.upCandleFill,
                    strokeDown: colors.downCandleStroke,
                    brushDown: colors.downCandleFill,
                    dataPointWidth: candleWidth / 100,
                    xAxisId: 'xAxis',
                    yAxisId: 'yAxis',
                });
                candlestickSeriesRef.current = candlestickSeries;
                sciChartSurface.renderableSeries.add(candlestickSeries);
                console.log("Default dataPointWidth:", candlestickSeries.dataPointWidth);

                // Create line data series for close prices
                const lineDataSeries = new XyDataSeries(wasmContext, { dataSeriesName: "Close Price" });
                lineDataSeriesRef.current = lineDataSeries;

                // Create line series - initially hidden
                const lineSeries = new FastLineRenderableSeries(wasmContext, {
                    dataSeries: lineDataSeries,
                    stroke: colors.upCandleStroke, 
                    strokeThickness: 2,
                    xAxisId: 'xAxis',
                    yAxisId: 'yAxis',
                    isVisible: chartType === 'Line' || chartType === 'Both',
                    paletteProvider: new ComparisonLinePaletteProvider(
                        colors.lineChartUptickColor || "#008800", 
                        colors.lineChartDowntickColor || "#AA0000", 
                        lineDataSeries
                    )
                });
                lineSeriesRef.current = lineSeries;
                sciChartSurface.renderableSeries.add(lineSeries);

                // Set the initial visibility based on chartType prop
                if (chartType === 'Both') {
                    // Show both candle and line charts
                    candlestickSeries.isVisible = true;
                    lineSeries.isVisible = true;
                } else {
                    // Show only the selected chart type
                    candlestickSeries.isVisible = chartType === 'Candle';
                    lineSeries.isVisible = chartType === 'Line';
                }

                sciChartSurface.background = colors.chartBackground;

                const lastPriceLine = new HorizontalLineAnnotation({
                    stroke: '#000000',
                    strokeDashArray: [1, 2],
                    strokeThickness: 1,
                    y1: 0,
                    isEditable: false,
                    isHidden: true,
                    showLabel: true,
                    labelPlacement: "Axis",
                    labelValue: "0.00",
                    axisLabelFill: colors.upCandleFill,
                    axisLabelStroke: getReadableTextColor(colors.upCandleFill),
                    fontSize: 14,
                    fontFamily: "Arial",
                    yAxisId: 'yAxis'
                });
                lastPriceLineRef.current = lastPriceLine;
                sciChartSurface.annotations.add(lastPriceLine);

                const verticalLine = new VerticalLineAnnotation({
                    stroke: getReadableTextColor(colors.chartBackground),
                    strokeDashArray: [2, 2],
                    isHidden: true,
                    xAxisId: 'xAxis',
                    showLabel: true,
                    labelPlacement: "Axis",
                    labelValue: "",
                    axisLabelFill: '#000000',
                    axisLabelStroke: '#FFFFFF',
                    fontSize: 12
                });
                verticalLineRef.current = verticalLine;
                sciChartSurface.annotations.add(verticalLine);

                const cursorHorizontalLine = new HorizontalLineAnnotation({
                    stroke: getReadableTextColor(colors.chartBackground),
                    strokeDashArray: [2, 2],
                    isHidden: true,
                    showLabel: true,
                    labelPlacement: "Axis",
                    labelValue: "",
                    axisLabelFill: '#000000',
                    axisLabelStroke: '#FFFFFF',
                    fontSize: 12,
                    yAxisId: 'yAxis'
                });
                cursorHorizontalLineRef.current = cursorHorizontalLine;
                sciChartSurface.annotations.add(cursorHorizontalLine);

                const zoomExtentsModifier = new ZoomExtentsModifier();
                // Disable the double-click reset behavior
                // zoomExtentsModifier.modifierDoubleClick = () => {
                //     resetToDefaultRange(sciChartSurface, dataSeries, settingsRef.current);
                // };

                sciChartSurface.chartModifiers.add(
                    new MouseWheelZoomModifier(),
                    new ZoomPanModifier(),
                    new YAxisDragModifier({ dragMode: 'Scaling', yAxisId: 'yAxis' }),
                    new XAxisDragModifier({ dragMode: 'Scaling', xAxisId: 'xAxis' })
                    // zoomExtentsModifier // Commented out to completely disable double-click zoom-to-extents
                );

                console.log(`Chart for ${timeframe} initialized successfully`);
                setIsInitialized(true);
                
                // Reset this flag when initializing the chart
                initialDataLoadedRef.current = false;
            } catch (error) {
                console.error(`Error initializing SciChart for ${timeframe}:`, error);
            }
        };

        initChart();

        return () => {
            if (sciChartSurfaceRef.current) {
                sciChartSurfaceRef.current.delete();
                sciChartSurfaceRef.current = null;
            }
            // Reset the flag when component unmounts
            initialDataLoadedRef.current = false;
        };
    }, [timeframe]);

    // New separate useEffect for handling settings changes without full reinitialization
    useEffect(() => {
        // Only run this if the chart is already initialized
        if (isInitialized && sciChartSurfaceRef.current) {
            console.log(`ChartPane[${timeframe}] Updating chart settings without reinitialization`);
            const sciChartSurface = sciChartSurfaceRef.current;
            
            // Update axes appearance
            const xAxis = sciChartSurface.xAxes.getById('xAxis');
            const yAxis = sciChartSurface.yAxes.getById('yAxis');
            
            if (xAxis) {
                xAxis.labelStyle.color = colors.axisText;
                xAxis.drawMajorBands = gridOptions.xAxisShading;
                xAxis.drawMajorGridLines = gridOptions.gridlines;
                xAxis.drawMinorGridLines = gridOptions.gridlines;
            }
            
            if (yAxis) {
                yAxis.labelStyle.color = colors.axisText;
                yAxis.drawMajorBands = gridOptions.yAxisShading;
                yAxis.drawMajorGridLines = gridOptions.gridlines;
                yAxis.drawMinorGridLines = gridOptions.gridlines;
            }
            
            // Update candle appearance
            const candlestickSeries = candlestickSeriesRef.current;
            if (candlestickSeries) {
                candlestickSeries.strokeUp = colors.upCandleStroke;
                candlestickSeries.brushUp = colors.upCandleFill;
                candlestickSeries.strokeDown = colors.downCandleStroke;
                candlestickSeries.brushDown = colors.downCandleFill;
                candlestickSeries.dataPointWidth = candleWidth / 100;
            }
            
            // Update line series appearance
            const lineSeries = lineSeriesRef.current;
            if (lineSeries) {
                lineSeries.stroke = colors.upCandleStroke; 
                if (lineDataSeriesRef.current) {
                    lineSeries.paletteProvider = new ComparisonLinePaletteProvider(
                        colors.lineChartUptickColor || "#008800", 
                        colors.lineChartDowntickColor || "#AA0000", 
                        lineDataSeriesRef.current
                    );
                }
            }
            
            // Update background color
            sciChartSurface.background = colors.chartBackground;
            
            // Update last price line appearance
            const lastPriceLine = lastPriceLineRef.current;
            const dataSeries = dataSeriesRef.current;
            
            if (lastPriceLine && dataSeries && dataSeries.count() > 0) {
                const count = dataSeries.count();
                const lastOpen = dataSeries.getNativeOpenValues().get(count - 1);
                const lastClose = dataSeries.getNativeCloseValues().get(count - 1);
                const isBullish = lastClose > lastOpen;
                
                lastPriceLine.stroke = isBullish ? colors.upCandleStroke : colors.downCandleStroke;
                lastPriceLine.axisLabelFill = isBullish ? colors.upCandleFill : colors.downCandleFill;
                lastPriceLine.axisLabelStroke = getReadableTextColor(isBullish ? colors.upCandleFill : colors.downCandleFill);
            }
            
            // Update crosshair colors based on the new background
            if (verticalLineRef.current) {
                verticalLineRef.current.stroke = getReadableTextColor(colors.chartBackground);
            }
            if (cursorHorizontalLineRef.current) {
                cursorHorizontalLineRef.current.stroke = getReadableTextColor(colors.chartBackground);
            }
            
            sciChartSurface.invalidateElement();
        }
    }, [isInitialized, colors, gridOptions, candleWidth, timeframe]);

    // Attach event listeners for crosshair functionality
    useEffect(() => {
        if (!chartRef.current || !sciChartSurfaceRef.current || !isInitialized) return;

        const handleMouseMove = (event) => {
            if (!isCrosshairModeRef.current || !sciChartSurfaceRef.current) return;
            const sciChartSurface = sciChartSurfaceRef.current;
            const xAxis = sciChartSurface.xAxes.getById('xAxis');
            const yAxis = sciChartSurface.yAxes.getById('yAxis');

            const rect = chartRef.current.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const cursorOffsetX = 10;
            const cursorOffsetY = 10;
            const adjustedMouseX = mouseX - cursorOffsetX;
            const adjustedMouseY = mouseY - cursorOffsetY;
            const xCoord = xAxis.getCurrentCoordinateCalculator();
            const yCoord = yAxis.getCurrentCoordinateCalculator();
            const mouseXValue = xCoord.getDataValue(adjustedMouseX);
            const mouseYValue = yCoord.getDataValue(adjustedMouseY);

            const timeXValues = dataSeriesRef.current.getNativeXValues();

            const timestamps = [];
            for (let j = 1; j < dataSeriesRef.current.count(); j++) {
                timestamps.push(timeXValues.get(j));
            }

            if (timestamps.length === 0) return;
            let closestIndex = 0;
            let minDiff = Math.abs(timestamps[0] - mouseXValue);
            for (let i = 1; i < timestamps.length; i++) {
                const diff = Math.abs(timestamps[i] - mouseXValue);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIndex = i;
                }
            }
            const nearestTimestamp = timestamps[closestIndex];
            
            console.log(`DIAGNOSTIC: In ${timeframe} chart, mousemove found nearestTimestamp=${nearestTimestamp}, mouseYValue=${mouseYValue}`);

            verticalLineRef.current.isHidden = false;
            verticalLineRef.current.x1 = nearestTimestamp;
            // Format the timestamp for the vertical line label
            const timestampDate = new Date(nearestTimestamp);
            const month = (timestampDate.getMonth() + 1).toString(); // getMonth is 0-indexed
            const day = timestampDate.getDate().toString().padStart(2, '0');
            const hours = timestampDate.getHours().toString().padStart(2, '0');
            const minutes = timestampDate.getMinutes().toString().padStart(2, '0');
            verticalLineRef.current.labelValue = `${month}/${day} ${hours}:${minutes}`;
            
            cursorHorizontalLineRef.current.isHidden = false;
            cursorHorizontalLineRef.current.y1 = mouseYValue;
            cursorHorizontalLineRef.current.labelValue = mouseYValue.toFixed(2);

            // Call the onCrosshairMove callback with the current timestamp and price
            if (onCrosshairMove) {
                console.log(`DIAGNOSTIC: ${timeframe} chart calling onCrosshairMove with nearestTimestamp=${nearestTimestamp}, mouseYValue=${mouseYValue}`);
                onCrosshairMove(timeframe, nearestTimestamp, mouseYValue);
            }

            sciChartSurface.invalidateElement();
        };

        const handleMouseLeave = () => {
            if (!sciChartSurfaceRef.current) return;
            verticalLineRef.current.isHidden = true;
            cursorHorizontalLineRef.current.isHidden = true;
            sciChartSurfaceRef.current.invalidateElement();
        };

        const chartDiv = chartRef.current;
        chartDiv.addEventListener('mousemove', handleMouseMove);
        chartDiv.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            chartDiv.removeEventListener('mousemove', handleMouseMove);
            chartDiv.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [isInitialized, onCrosshairMove]);

    // Add a separate useEffect to set canvas z-index after initialization
    useEffect(() => {
        if (isInitialized && chartRef.current) {
            // Wait a short time for any canvas elements to be fully rendered
            const timer = setTimeout(() => {
                // Set z-index for canvas elements
                const canvasElements = chartRef.current.querySelectorAll('canvas');
                canvasElements.forEach(canvas => {
                    canvas.style.zIndex = '5'; // Lower than our overlay z-index of 1000
                });
                console.log(`Set z-index for ${canvasElements.length} canvas elements in ${timeframe} chart`);
                
                // NEW: Set z-index for SVG elements to ensure annotations appear above candles
                const svgElements = chartRef.current.querySelectorAll('svg');
                svgElements.forEach(svg => {
                    svg.style.zIndex = '10'; // Higher than canvas but lower than overlay z-index of 1000
                });
                console.log(`Set z-index for ${svgElements.length} SVG elements in ${timeframe} chart`);
            }, 100);
            
            return () => clearTimeout(timer);
        }
    }, [isInitialized, timeframe]);

    // Existing useEffect for candleWidth updates
    useEffect(() => {
        if (isInitialized && sciChartSurfaceRef.current) {
            const candlestickSeries = sciChartSurfaceRef.current.renderableSeries.get(0);
            candlestickSeries.dataPointWidth = candleWidth / 100;
            sciChartSurfaceRef.current.invalidateElement();
        }
    }, [candleWidth, isInitialized]);

    // Update effect for handling data updates
    useEffect(() => {
        if (isInitialized && sciChartSurfaceRef.current && dataSeriesRef.current && lineDataSeriesRef.current && candleData && candleData.length > 0) {
            console.log(`ChartPane[${timeframe}] updating with ${candleData.length} candles`);
            
            // DEBUG: Log first and last candle
            if (candleData.length > 0) {
                console.log(`First candle:`, candleData[0]);
                console.log(`Last candle:`, candleData[candleData.length - 1]);
            }
            
            // CRITICAL BUG FIX FOR REPLAY MODE: Handle replay mode differently
            if (isReplayMode) {
                // Special case for replay mode
                if (dataSeriesRef.current.count() === 0) {
                    // If empty, just load all data
                    dataSeriesRef.current.appendRange(
                        candleData.map((c) => Number(c.timestamp)),
                        candleData.map((c) => Number(c.open)),
                        candleData.map((c) => Number(c.high)),
                        candleData.map((c) => Number(c.low)),
                        candleData.map((c) => Number(c.close))
                    );
                    
                    // Also update line series with close prices
                    lineDataSeriesRef.current.clear();
                    lineDataSeriesRef.current.appendRange(
                        candleData.map((c) => Number(c.timestamp)),
                        candleData.map((c) => Number(c.close))
                    );
                    // Update palette provider with the new data series instance if it exists
                    if (lineSeriesRef.current && lineSeriesRef.current.paletteProvider instanceof ComparisonLinePaletteProvider) {
                        lineSeriesRef.current.paletteProvider.dataSeries = lineDataSeriesRef.current;
                    }
                } else {
                    // For replay mode, clear and reload all data every time
                    // This ensures no duplicates while preventing candle loss
                    
                    // Extract all timestamps currently in the series
                    const existingTimestamps = new Set();
                    const existingCount = dataSeriesRef.current.count();
                    for (let i = 0; i < existingCount; i++) {
                        existingTimestamps.add(dataSeriesRef.current.getNativeXValues().get(i));
                    }
                    
                    // Merge existing data with new data, prioritizing new data
                    const mergedData = [...candleData];
                    
                    // Keep track of timestamps we've seen in the new data
                    const newTimestamps = new Set(candleData.map(c => Number(c.timestamp)));
                    
                    // Add existing candles that aren't in the new data
                    for (let i = 0; i < existingCount; i++) {
                        const timestamp = dataSeriesRef.current.getNativeXValues().get(i);
                        if (!newTimestamps.has(timestamp)) {
                            mergedData.push({
                                timestamp: timestamp,
                                open: dataSeriesRef.current.getNativeOpenValues().get(i),
                                high: dataSeriesRef.current.getNativeHighValues().get(i),
                                low: dataSeriesRef.current.getNativeLowValues().get(i),
                                close: dataSeriesRef.current.getNativeCloseValues().get(i)
                            });
                        }
                    }
                    
                    // Sort by timestamp to ensure proper order
                    mergedData.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
                    
                    // Clear and reload with the merged data
                    dataSeriesRef.current.clear();
                    dataSeriesRef.current.appendRange(
                        mergedData.map((c) => Number(c.timestamp)),
                        mergedData.map((c) => Number(c.open)),
                        mergedData.map((c) => Number(c.high)),
                        mergedData.map((c) => Number(c.low)),
                        mergedData.map((c) => Number(c.close))
                    );
                    
                    // Also update line series with close prices
                    lineDataSeriesRef.current.clear();
                    lineDataSeriesRef.current.appendRange(
                        mergedData.map((c) => Number(c.timestamp)),
                        mergedData.map((c) => Number(c.close))
                    );
                    // Update palette provider with the new data series instance if it exists
                    if (lineSeriesRef.current && lineSeriesRef.current.paletteProvider instanceof ComparisonLinePaletteProvider) {
                        lineSeriesRef.current.paletteProvider.dataSeries = lineDataSeriesRef.current;
                    }
                }
            } else {
                // Original behavior for non-replay mode: clear and repopulate
                dataSeriesRef.current.clear();
                dataSeriesRef.current.appendRange(
                    candleData.map((c) => Number(c.timestamp)),
                    candleData.map((c) => Number(c.open)),
                    candleData.map((c) => Number(c.high)),
                    candleData.map((c) => Number(c.low)),
                    candleData.map((c) => Number(c.close))
                );
                
                // Also update line series with close prices
                lineDataSeriesRef.current.clear();
                lineDataSeriesRef.current.appendRange(
                    candleData.map((c) => Number(c.timestamp)),
                    candleData.map((c) => Number(c.close))
                );
                // Update palette provider with the new data series instance if it exists
                if (lineSeriesRef.current && lineSeriesRef.current.paletteProvider instanceof ComparisonLinePaletteProvider) {
                    lineSeriesRef.current.paletteProvider.dataSeries = lineDataSeriesRef.current;
                }
            }
            
            console.log(`ChartPane[${timeframe}] data series count after update:`, dataSeriesRef.current.count());
            
            // Reset chart range only on the first load after initialization
            if (!initialDataLoadedRef.current) {
                resetToDefaultRange(sciChartSurfaceRef.current, dataSeriesRef.current, chartBehavior, timeframe);
                initialDataLoadedRef.current = true;
            }

            const lastCandle = candleData[candleData.length - 1];
            const lastClose = lastCandle.close;
            const isBullish = lastClose > lastCandle.open;

            //console.log(`DEBUG: Line 1740, upCandleStroke is set to ${colors.upCandleStroke}`);
            lastPriceLineRef.current.stroke = isBullish ? colors.upCandleStroke : colors.downCandleStroke;
            lastPriceLineRef.current.y1 = lastClose;
            lastPriceLineRef.current.labelValue = lastClose.toFixed(2);
            lastPriceLineRef.current.axisLabelFill = isBullish ? colors.upCandleFill : colors.downCandleFill;
            lastPriceLineRef.current.axisLabelStroke = getReadableTextColor(isBullish ? colors.upCandleFill : colors.downCandleFill);
            lastPriceLineRef.current.isHidden = false;

            sciChartSurfaceRef.current.invalidateElement();
        } else {
            console.log(`Chart not ready for ${timeframe}:`, {
                isInitialized,
                sciChartSurface: !!sciChartSurfaceRef.current,
                dataSeries: !!dataSeriesRef.current,
                candleData: candleData?.length || 0,
            });
        }
    }, [candleData, chartBehavior, isInitialized, timeframe, colors, isReplayMode]);

    useEffect(() => {
        if (chartRef.current) {
            if (isCrosshairMode) {
                chartRef.current.style.cursor = 'crosshair';
            } else if (isBoxMode) {
                chartRef.current.style.cursor = 'crosshair'; // or 'cell' which looks like a box
            } else {
                chartRef.current.style.cursor = 'default';
            }
        }
    }, [isCrosshairMode, isBoxMode]);

    // Chart click handler for line annotations
    useEffect(() => {
        if (!chartRef.current || !sciChartSurfaceRef.current || !isInitialized) return;

        const handleChartClick = (event) => {
            if (!isLineMode) return;

            const sciChartSurface = sciChartSurfaceRef.current;
            const xAxis = sciChartSurface.xAxes.getById('xAxis');
            const yAxis = sciChartSurface.yAxes.getById('yAxis');
            const rect = chartRef.current.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const cursorOffsetX = 10;
            const cursorOffsetY = 10;
            const adjustedMouseX = mouseX - cursorOffsetX;
            const adjustedMouseY = mouseY - cursorOffsetY;
            const xCoord = xAxis.getCurrentCoordinateCalculator();
            const yCoord = yAxis.getCurrentCoordinateCalculator();
            const mouseXValue = xCoord.getDataValue(adjustedMouseX);
            const mouseYValue = yCoord.getDataValue(adjustedMouseY);

            const newLine = new HorizontalLineAnnotation({
                id: generateAnnotationId('hline', timeframe),
                stroke: lineColor,
                strokeDashArray: lineTypeOptions[lineType],
                strokeThickness: 2,
                y1: mouseYValue,
                isEditable: true,
                showLabel: showLabel,
                labelPlacement: "Axis",
                labelValue: mouseYValue.toFixed(2),
                axisLabelFill: lineColor,
                axisLabelStroke: '#FFFFFF',
                fontSize: 12,
                yAxisId: 'yAxis',
                onDrag: () => {
                    const newYValue = newLine.y1;
                    console.log('Annotation dragged to new Y value:', newYValue);
                    // Always update the label when dragging
                    newLine.labelValue = newYValue.toFixed(2);
                    sciChartSurface.invalidateElement();
                },
                onDragEnded: () => {
                    // Make sure the label is updated before calling the update handler
                    newLine.labelValue = newLine.y1.toFixed(2);
                    // Call the update handler only when dragging is complete
                    onAnnotationUpdated(newLine, timeframe);
                }
            });

            if (lineOrientation === 'Right') {
                newLine.x1 = mouseXValue;
                console.log('Setting x1 for rightward line:', newLine.x1);
            }

            sciChartSurface.annotations.add(newLine);
            lineAnnotationsRef.current.push(newLine);
            sciChartSurface.invalidateElement();
            setIsLineMode(false); // Ensure isLineMode is turned off after creating a line
            console.log('isLineMode set to false after creating a line');
            
            // Call the creation handler
            onAnnotationCreated(newLine, timeframe);
        };

        const handleDeleteKey = (event) => {
            if (event.key === 'Delete' && sciChartSurfaceRef.current) {
                const sciChartSurface = sciChartSurfaceRef.current;
                const selectedAnnotation = sciChartSurface.annotations.asArray().find(ann => ann.isSelected);
                if (selectedAnnotation) {
                    console.log(`Deleting selected annotation on ${timeframe} chart:`, selectedAnnotation.id);
                    
                    // Call delete handler before removing the annotation
                    onAnnotationDeleted(selectedAnnotation, timeframe);
                    
                    // CRITICAL FIX: Call delete() method on annotation to free WebGL resources
                    if (typeof selectedAnnotation.delete === 'function') {
                        try {
                            selectedAnnotation.delete();
                        } catch (error) {
                            console.warn(`Error calling delete() on annotation: ${error.message}`);
                        }
                    }
                    
                    sciChartSurface.annotations.remove(selectedAnnotation);
                    // Update the lineAnnotationsRef if it's tracked there
                    if (lineAnnotationsRef.current.includes(selectedAnnotation)) {
                        lineAnnotationsRef.current = lineAnnotationsRef.current.filter(ann => ann !== selectedAnnotation);
                    }
                    sciChartSurface.invalidateElement();
                }
            }
        };

        const chartDiv = chartRef.current;
        chartDiv.addEventListener('click', handleChartClick);
        document.addEventListener('keydown', handleDeleteKey);

        return () => {
            chartDiv.removeEventListener('click', handleChartClick);
            document.removeEventListener('keydown', handleDeleteKey);
        };
    }, [isInitialized, isLineMode, lineColor, lineType, showLabel, lineOrientation, timeframe, onAnnotationCreated, onAnnotationUpdated, onAnnotationDeleted, generateAnnotationId, setIsLineMode]);

    // Box drawing functionality
    useEffect(() => {
        if (!chartRef.current || !sciChartSurfaceRef.current || !isInitialized) return;

        const sciChartSurface = sciChartSurfaceRef.current;
        const chartDiv = chartRef.current;

        const handleMouseDown = (event) => {
            if (!isBoxMode) return;
            
            console.log(`Box mode mousedown triggered on ${timeframe} chart`);

            const rect = chartDiv.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            const cursorOffsetX = 10;
            const cursorOffsetY = 10;
            const adjustedMouseX = mouseX - cursorOffsetX;
            const adjustedMouseY = mouseY - cursorOffsetY;
            
            const xAxis = sciChartSurface.xAxes.getById('xAxis');
            const yAxis = sciChartSurface.yAxes.getById('yAxis');
            
            const xCoord = xAxis.getCurrentCoordinateCalculator();
            const yCoord = yAxis.getCurrentCoordinateCalculator();
            
            const mouseXValue = xCoord.getDataValue(adjustedMouseX);
            const mouseYValue = yCoord.getDataValue(adjustedMouseY);
            
            // Store the starting coordinates
            boxStartCoordinatesRef.current = { x: mouseXValue, y: mouseYValue };
            
            // Create a new box annotation with initial coordinates
            boxAnnotationRef.current = new BoxAnnotation({
                id: generateAnnotationId('box', timeframe),
                x1: mouseXValue,
                y1: mouseYValue,
                x2: mouseXValue,
                y2: mouseYValue,
                stroke: lineColor,
                strokeThickness: 2,
                fill: `${lineColor}${Math.round(boxOpacity * 255).toString(16).padStart(2, '0')}`, // Append opacity as hex
                isEditable: true,
                annotationLayer: "Background", // Set annotation layer to Background
                onDrag: () => {
                    // Just invalidate the element during drag
                    sciChartSurface.invalidateElement();
                },
                onDragEnded: () => {
                    // Call the update handler when box drag is finished
                    onAnnotationUpdated(boxAnnotationRef.current, timeframe);
                }
            });
            
            sciChartSurface.annotations.add(boxAnnotationRef.current);
            isDrawingBoxRef.current = true;
            
            // Call the creation handler
            onAnnotationCreated(boxAnnotationRef.current, timeframe);
            
            // Prevent event propagation to stop other handlers
            event.stopPropagation();
            event.preventDefault();
        };

        const handleMouseMove = (event) => {
            if (!isBoxMode || !isDrawingBoxRef.current || !boxAnnotationRef.current) return;
            
            console.log(`Box mode mousemove updating box on ${timeframe} chart`);
            
            const rect = chartDiv.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            const cursorOffsetX = 10;
            const cursorOffsetY = 10;
            const adjustedMouseX = mouseX - cursorOffsetX;
            const adjustedMouseY = mouseY - cursorOffsetY;
            
            const xAxis = sciChartSurface.xAxes.getById('xAxis');
            const yAxis = sciChartSurface.yAxes.getById('yAxis');
            
            const xCoord = xAxis.getCurrentCoordinateCalculator();
            const yCoord = yAxis.getCurrentCoordinateCalculator();
            
            const mouseXValue = xCoord.getDataValue(adjustedMouseX);
            const mouseYValue = yCoord.getDataValue(adjustedMouseY);
            
            // Update the box coordinates
            boxAnnotationRef.current.x2 = mouseXValue;
            boxAnnotationRef.current.y2 = mouseYValue;
            
            sciChartSurface.invalidateElement();
            
            // Prevent event propagation
            event.stopPropagation();
            event.preventDefault();
        };

        const handleMouseUp = (event) => {
            if (!isBoxMode || !isDrawingBoxRef.current) return;
            
            console.log(`Box mode mouseup finishing box on ${timeframe} chart`);
            
            // Call the update handler when box drawing is finished
            if (boxAnnotationRef.current) {
                onAnnotationUpdated(boxAnnotationRef.current, timeframe);
            }
            
            isDrawingBoxRef.current = false;
            
            // Turn off box mode after drawing is complete
            setIsLineMode(false); // This ensures line mode stays off
            setIsBoxMode(false);
            setIsTrendMode(false);
            
            // Prevent event propagation
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
        };

        // Use mousedown instead of click for box drawing
        chartDiv.addEventListener('mousedown', handleMouseDown, { capture: true });
        document.addEventListener('mousemove', handleMouseMove, { capture: true });
        document.addEventListener('mouseup', handleMouseUp, { capture: true });

        return () => {
            chartDiv.removeEventListener('mousedown', handleMouseDown, { capture: true });
            document.removeEventListener('mousemove', handleMouseMove, { capture: true });
            document.removeEventListener('mouseup', handleMouseUp, { capture: true });
        };
    }, [isInitialized, isBoxMode, lineColor, timeframe, setIsBoxMode, setIsLineMode, boxOpacity, generateAnnotationId, onAnnotationCreated, onAnnotationUpdated, setIsTrendMode]);

    // Trend line drawing functionality
    useEffect(() => {
        if (!chartRef.current || !sciChartSurfaceRef.current || !isInitialized) return;

        const sciChartSurface = sciChartSurfaceRef.current;
        const chartDiv = chartRef.current;

        const handleMouseDown = (event) => {
            console.log(`Mouse down in ${timeframe}, isTrendMode=${isTrendMode}`);
            
            if (!isTrendMode) {
                console.log('Trendline mode is OFF, ignoring event');
                return;
            }
            
            console.log(`Trend mode mousedown triggered on ${timeframe} chart`);

            const rect = chartDiv.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            const cursorOffsetX = 10;
            const cursorOffsetY = 10;
            const adjustedMouseX = mouseX - cursorOffsetX;
            const adjustedMouseY = mouseY - cursorOffsetY;
            
            const xAxis = sciChartSurface.xAxes.getById('xAxis');
            const yAxis = sciChartSurface.yAxes.getById('yAxis');
            
            const xCoord = xAxis.getCurrentCoordinateCalculator();
            const yCoord = yAxis.getCurrentCoordinateCalculator();
            
            const mouseXValue = xCoord.getDataValue(adjustedMouseX);
            const mouseYValue = yCoord.getDataValue(adjustedMouseY);
            
            // Store the starting coordinates
            trendLineStartCoordinatesRef.current = { x: mouseXValue, y: mouseYValue };
            
            // Create a new trendline annotation
            trendLineRef.current = new LineAnnotation({
                id: generateAnnotationId('tline', timeframe),
                x1: mouseXValue,
                y1: mouseYValue,
                x2: mouseXValue,
                y2: mouseYValue,
                stroke: lineColor,
                strokeThickness: 2,
                strokeDashArray: lineTypeOptions[lineType],
                isEditable: true,
                xAxisId: 'xAxis', // Specify the xAxis ID to match the chart's xAxis
                yAxisId: 'yAxis', // Specify the yAxis ID to match the chart's yAxis
                onDrag: () => {
                    // Just invalidate the element during drag
                    sciChartSurface.invalidateElement();
                },
                onDragEnded: () => {
                    // Call the update handler when trend line drag is finished
                    onAnnotationUpdated(trendLineRef.current, timeframe);
                }
            });
            
            sciChartSurface.annotations.add(trendLineRef.current);
            isDrawingTrendLineRef.current = true;
            
            // Prevent event propagation to stop other handlers
            event.stopPropagation();
            event.preventDefault();
        };

        // Remove any existing event listeners for trendline drawing to prevent duplicates
        chartDiv.removeEventListener('mousedown', handleMouseDown, { capture: true });
        
        // Add the event listener
        chartDiv.addEventListener('mousedown', handleMouseDown, { capture: true });

        const handleMouseMove = (event) => {
            if (!isTrendMode || !isDrawingTrendLineRef.current || !trendLineRef.current) return;
            
            console.log(`Trend mode mousemove updating trendline on ${timeframe} chart`);
            
            const rect = chartDiv.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            const cursorOffsetX = 10;
            const cursorOffsetY = 10;
            const adjustedMouseX = mouseX - cursorOffsetX;
            const adjustedMouseY = mouseY - cursorOffsetY;
            
            const xAxis = sciChartSurface.xAxes.getById('xAxis');
            const yAxis = sciChartSurface.yAxes.getById('yAxis');
            
            const xCoord = xAxis.getCurrentCoordinateCalculator();
            const yCoord = yAxis.getCurrentCoordinateCalculator();
            
            const mouseXValue = xCoord.getDataValue(adjustedMouseX);
            const mouseYValue = yCoord.getDataValue(adjustedMouseY);
            
            // Update the trendline coordinates
            trendLineRef.current.x2 = mouseXValue;
            trendLineRef.current.y2 = mouseYValue;
            
            sciChartSurface.invalidateElement();
            
            // Prevent event propagation
            event.stopPropagation();
            event.preventDefault();
        };

        const handleMouseUp = (event) => {
            if (!isTrendMode || !isDrawingTrendLineRef.current) return;
            
            console.log(`Trend mode mouseup finishing trendline on ${timeframe} chart`);
            
            // If the trendline is very small (essentially a point), just remove it
            if (trendLineRef.current) {
                const dx = Math.abs(trendLineRef.current.x2 - trendLineRef.current.x1);
                const dy = Math.abs(trendLineRef.current.y2 - trendLineRef.current.y1);
                const isTooSmall = dx < 0.00001 && dy < 0.00001;
                
                if (isTooSmall) {
                    // CRITICAL FIX: Call delete() method on annotation to free WebGL resources
                    if (typeof trendLineRef.current.delete === 'function') {
                        try {
                            trendLineRef.current.delete();
                        } catch (error) {
                            console.warn(`Error calling delete() on small trend line: ${error.message}`);
                        }
                    }
                    sciChartSurface.annotations.remove(trendLineRef.current);
                } else {
                    // Call creation handler first since we're now completing the trendline
                    onAnnotationCreated(trendLineRef.current, timeframe);
                    
                    // Call the update handler when trendline drawing is finished
                    onAnnotationUpdated(trendLineRef.current, timeframe);
                }
            }
            
            isDrawingTrendLineRef.current = false;
            
            // Turn off trend mode after drawing is complete
            setIsLineMode(false); // This ensures line mode stays off
            setIsBoxMode(false); // This ensures box mode stays off
            setIsTrendMode(false);
            
            // Prevent event propagation
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
        };

        // Use mousedown instead of click for trendline drawing
        chartDiv.addEventListener('mousedown', handleMouseDown, { capture: true });
        document.addEventListener('mousemove', handleMouseMove, { capture: true });
        document.addEventListener('mouseup', handleMouseUp, { capture: true });

        return () => {
            chartDiv.removeEventListener('mousedown', handleMouseDown, { capture: true });
            document.removeEventListener('mousemove', handleMouseMove, { capture: true });
            document.removeEventListener('mouseup', handleMouseUp, { capture: true });
        };
    }, [isInitialized, isTrendMode, lineColor, lineType, timeframe, generateAnnotationId, onAnnotationCreated, onAnnotationUpdated, setIsLineMode, setIsBoxMode, setIsTrendMode]);

    // Arrow drawing functionality
    useEffect(() => {
        if (!chartRef.current || !sciChartSurfaceRef.current || !isInitialized) return;

        const sciChartSurface = sciChartSurfaceRef.current;
        const chartDiv = chartRef.current;

        const handleClick = (event) => {
            if (!isArrowMode) return;
            
            console.log(`Arrow mode click triggered on ${timeframe} chart for direction: ${arrowDirection}, size: ${arrowSize}, style: ${arrowStyle}`);

            const rect = chartDiv.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            const cursorOffsetX = 10;
            const cursorOffsetY = 10;
            const adjustedMouseX = mouseX - cursorOffsetX;
            const adjustedMouseY = mouseY - cursorOffsetY;
            
            const xAxis = sciChartSurface.xAxes.getById('xAxis');
            const yAxis = sciChartSurface.yAxes.getById('yAxis');
            
            const xCoord = xAxis.getCurrentCoordinateCalculator();
            const yCoord = yAxis.getCurrentCoordinateCalculator();
            
            const mouseXValue = xCoord.getDataValue(adjustedMouseX);
            const mouseYValue = yCoord.getDataValue(adjustedMouseY);
            
            // Get the SVG string for this arrow configuration
            const svgString = createArrowSvg(arrowDirection, lineColor, arrowSize, arrowStyle);
            
            // Get anchor points based on direction
            const anchorPoints = getArrowAnchorPoints(arrowDirection);
            
            // Create a new arrow annotation
            const arrowAnnotation = new CustomAnnotation({
                id: generateAnnotationId('arrow', timeframe),
                x1: mouseXValue,
                y1: mouseYValue,
                svgString: svgString,
                horizontalAnchorPoint: anchorPoints.horizontalAnchorPoint,
                verticalAnchorPoint: anchorPoints.verticalAnchorPoint,
                xAxisId: 'xAxis',
                yAxisId: 'yAxis',
                isEditable: true,
                onDrag: () => {
                    // Just invalidate the element during drag
                    sciChartSurface.invalidateElement();
                },
                onDragEnded: () => {
                    // Call the update handler when arrow drag is finished
                    onAnnotationUpdated(arrowAnnotation, timeframe);
                }
            });
            
            sciChartSurface.annotations.add(arrowAnnotation);
            
            // Call the creation handler
            onAnnotationCreated(arrowAnnotation, timeframe);
            
            // Turn off arrow mode after placing an arrow
            setIsArrowMode(false);
            
            // Prevent event propagation to stop other handlers
            event.stopPropagation();
            event.preventDefault();
        };

        // Add the event listener for arrow placement
        chartDiv.addEventListener('click', handleClick, { capture: true });

        return () => {
            chartDiv.removeEventListener('click', handleClick, { capture: true });
        };
    }, [isInitialized, isArrowMode, arrowDirection, arrowSize, arrowStyle, lineColor, timeframe, generateAnnotationId, onAnnotationCreated, onAnnotationUpdated, setIsArrowMode]);

    // Text annotation functionality
    useEffect(() => {
        if (!chartRef.current || !sciChartSurfaceRef.current || !isInitialized) return;

        const sciChartSurface = sciChartSurfaceRef.current;
        const chartDiv = chartRef.current;

        const handleClick = (event) => {
            if (!isTextMode) return;
            
            console.log(`Text mode click triggered on ${timeframe} chart`);

            const rect = chartDiv.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            const cursorOffsetX = 10;
            const cursorOffsetY = 10;
            const adjustedMouseX = mouseX - cursorOffsetX;
            const adjustedMouseY = mouseY - cursorOffsetY;
            
            const xAxis = sciChartSurface.xAxes.getById('xAxis');
            const yAxis = sciChartSurface.yAxes.getById('yAxis');
            
            const xCoord = xAxis.getCurrentCoordinateCalculator();
            const yCoord = yAxis.getCurrentCoordinateCalculator();
            
            const mouseXValue = xCoord.getDataValue(adjustedMouseX);
            const mouseYValue = yCoord.getDataValue(adjustedMouseY);
            
            // Create a new text annotation
            const textAnnotation = new NativeTextAnnotation({
                id: generateAnnotationId('text', timeframe),
                x1: mouseXValue,
                y1: mouseYValue,
                text: (annotationText || 'Text').replace(/\\n/g, '\n'), // Replace \n with actual newlines
                textColor: lineColor,
                backgroundColor: 'transparent',
                fontSize: fontSize,
                fontWeight: 'bold',
                xAxisId: 'xAxis',
                yAxisId: 'yAxis',
                horizontalAnchorPoint: textAnchor,
                verticalAnchorPoint: "Center",
                isEditable: true,
                onDrag: () => {
                    // Just invalidate the element during drag
                    sciChartSurface.invalidateElement();
                },
                onDragEnded: () => {
                    // Call the update handler when text drag is finished
                    onAnnotationUpdated(textAnnotation, timeframe);
                }
            });
            
            sciChartSurface.annotations.add(textAnnotation);
            
            // Call the creation handler
            onAnnotationCreated(textAnnotation, timeframe);
            
            // Turn off text mode after placing text
            setIsTextMode(false);
            
            // Prevent event propagation to stop other handlers
            event.stopPropagation();
            event.preventDefault();
        };

        // Add the event listener for text placement
        chartDiv.addEventListener('click', handleClick, { capture: true });

        return () => {
            chartDiv.removeEventListener('click', handleClick, { capture: true });
        };
    }, [isInitialized, isTextMode, lineColor, annotationText, timeframe, generateAnnotationId, onAnnotationCreated, onAnnotationUpdated, setIsTextMode, fontSize, textAnchor]);

    // Define the reset click handler
    const handleResetClick = useCallback(() => {
        if (sciChartSurfaceRef.current && dataSeriesRef.current && chartBehavior) {
            console.log(`Reset button clicked for ${timeframe}`);
            resetToDefaultRange(sciChartSurfaceRef.current, dataSeriesRef.current, chartBehavior, timeframe);
        } else {
            console.warn(`Could not reset range for ${timeframe}: surface, data series, or behavior not ready.`);
        }
    }, [timeframe, chartBehavior]);

    // Update effect for setting chart type visibility
    useEffect(() => {
        if (isInitialized && candlestickSeriesRef.current && lineSeriesRef.current) {
            // Toggle visibility based on chartType prop
            if (chartType === 'Both') {
                // Show both candle and line charts
                candlestickSeriesRef.current.isVisible = true;
                lineSeriesRef.current.isVisible = true;
            } else {
                // Show only the selected chart type
                candlestickSeriesRef.current.isVisible = chartType === 'Candle';
                lineSeriesRef.current.isVisible = chartType === 'Line';
            }
            
            if (sciChartSurfaceRef.current) {
                sciChartSurfaceRef.current.invalidateElement();
            }
            
            console.log(`Chart type for ${timeframe} set to: ${chartType}`);
        }
    }, [chartType, isInitialized, timeframe]);

    return (
        <>
            <div 
                ref={chartRef} 
                style={{ 
                    height: '100%', 
                    width: '100%', 
                    position: 'relative', 
                    backgroundColor: colors.chartBackground,
                    cursor: isCrosshairMode ? 'crosshair' : isBoxMode || isTrendMode || isArrowMode || isTextMode ? 'crosshair' : 'default'
                }} 
            >
                {/* Title overlay with extra-high z-index to ensure visibility */}
                <div style={{ 
                    position: 'absolute', 
                    top: 10, 
                    left: 10, 
                    color: '#FFFFFF', 
                    zIndex: 50,
                    fontSize: '16px',
                    fontWeight: 'bold',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    borderRadius: '4px',
                    boxShadow: '0 0 5px rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    textShadow: '1px 1px 1px black',
                    pointerEvents: 'none'
                }}>
                    {instrument} {timeframe}
                </div>
                {/* Reset Button Overlay */}
                {isInitialized && ( // Only show button when chart is ready
                    <img 
                        src={resetButtonIcon} 
                        alt="Reset Range" 
                        onClick={handleResetClick}
                        style={{
                            position: 'absolute',
                            top: 32, // Position below the title overlay (10 + 26 height + 5 gap)
                            left: 6, // Align with title overlay
                            height: '18px',
                            zIndex: 50, // Same level as title overlay
                            cursor: 'pointer',
                            pointerEvents: 'auto' // Ensure button is clickable
                            // Removed background, border, and padding for transparency
                        }}
                        title="Reset Zoom/Pan" // Tooltip for accessibility
                    />
                )}
            </div>
            {/* Render CandleCountdown as a sibling to the chart container */}
            <CandleCountdown 
                isLiveMode={isLiveMode} 
                isReplayMode={isReplayMode}
                timeframe={timeframe} 
                candleData={candleData} 
            />
        </>
    );
}

export default ChartPane; 