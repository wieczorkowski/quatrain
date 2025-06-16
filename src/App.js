// USER STUDIES KILLSWITCH - Set to false to completely disable User Studies integration
const ENABLE_USER_STUDIES = true;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SciChartSurface } from 'scichart';
import { DateTime } from 'luxon';
import { renderToStaticMarkup } from 'react-dom/server';
import Settings from './Settings';
import ServerLog from './ServerLog';
import FlyoutPanel from './components/FlyoutPanel';
import ChartPane from './components/ChartPane';
import ChartLayout from './components/ChartLayout';
import ReplayControls from './components/ReplayControls';
import ConnectionScreen from './components/ConnectionScreen';
import StrategyManager from './StrategyManager';
import IndicatorsStudies from './IndicatorsStudies';
import TradeAnnotationManager from './components/TradeAnnotationManager';
import ChartClickOrderOverlay from './components/ChartClickOrderOverlay';
import ChartModifyOrderOverlay from './components/ChartModifyOrderOverlay'; // Import the new overlay
import { rebuildSavedAnnotations, deleteAnnotationByIds, auditAnnotations, cleanupAnnotations } from './utils/annotationUtils';
import { handleLiveCandleUpdate } from './utils/LiveDataHandler';
import { toggleLineMode, toggleBoxMode, toggleTrendMode, toggleArrowMode, toggleTextMode, updateZoomPanModifierState } from './utils/DrawingModes';
import { generateAnnotationId, handleAnnotationCreated, handleAnnotationUpdated, handleAnnotationDeleted } from './utils/AnnotationHandlers';
import './App.css';
import AnnotationManager from './AnnotationManager';
import backgroundImage from './images/xenocharts.jpg';
import loadingBackground from './images/cashcow.png';
import DrawingOptionsOverlay from './components/DrawingOptionsOverlay';
// Import Redux hooks and actions
// import { useDispatch } from 'react-redux';
// import { setMarketData } from './features/marketData/marketDataSlice';
// Add import for DataClient at the top of the file with other imports
import DataClient from './services/data-client';
import candleEventService from './services/candle-event-service';
import internalStrategyAnnotations from './InternalStrategyAnnotations';
import sessionLabelsAnnotations from './SessionLabelsAnnotations';
import killzonesAnnotations from './KillzonesAnnotations';
import ictPriceLinesAnnotations from './IctPriceLinesAnnotations';
// import openingGapsAnnotations from './OpeningGapsAnnotations'; // DISABLED - Converted to User Study
// User Studies imports (controlled by ENABLE_USER_STUDIES killswitch)
let UserStudyManager = null;
let UserStudiesPanel = null;
if (ENABLE_USER_STUDIES) {
    UserStudyManager = require('./userstudies/UserStudyManager').default;
    UserStudiesPanel = require('./userstudies/components/UserStudiesPanel').default;
}


// Constants for application behavior
const SESSION_GAP_MINUTES = 15; // Number of minutes gap required to create a new session

// Static timeframes for the charts
const fourWayTimeframes = ['1h', '5m', '15m', '1m'];
const sixWayTimeframes = ['1h', '30m', '15m', '10m', '5m', '1m'];
const sixWayLongTimeframes = ['1d', '4h', '1h', '15m', '5m', '1m'];

function App() {
    const [isConnected, setIsConnected] = useState(false);
    const [clientId, setClientId] = useState('dev');
    const [instrument, setInstrument] = useState('ESM5');
    const [historicalDays, setHistoricalDays] = useState('21');
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [ws, setWs] = useState(null);
    const [dataMode, setDataMode] = useState('Live'); // Default to Live mode
    const [chartData, setChartData] = useState({
        '1d': [],
        '4h': [],
        '1h': [],
        '30m': [],
        '15m': [],
        '10m': [],
        '5m': [],
        '1m': [],
    });
    const accumulatedDataRef = useRef({
        '1d': [],
        '4h': [],
        '1h': [],
        '30m': [],
        '15m': [],
        '10m': [],
        '5m': [],
        '1m': [],
    });
    const timeoutRef = useRef(null);
    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
    });
    const [rowSplitRatio, setRowSplitRatio] = useState(50);
    const [columnSplitRatio, setColumnSplitRatio] = useState(50);
    // For 6-way layout, we need two column split ratios
    const [columnSplitRatios, setColumnSplitRatios] = useState([33, 67]); // Default to 33/67 split for the first and second divider
    const [settings, setSettings] = useState({
        chartBehavior: {
            '1d': { numCandles: 50, numSpace: 10, yPercentSpace: 10 },
            '4h': { numCandles: 50, numSpace: 10, yPercentSpace: 10 },
            '1h': { numCandles: 50, numSpace: 10, yPercentSpace: 10 },
            '30m': { numCandles: 50, numSpace: 10, yPercentSpace: 10 },
            '15m': { numCandles: 50, numSpace: 10, yPercentSpace: 10 },
            '10m': { numCandles: 50, numSpace: 10, yPercentSpace: 10 },
            '5m': { numCandles: 50, numSpace: 10, yPercentSpace: 10 },
            '1m': { numCandles: 50, numSpace: 10, yPercentSpace: 10 },
        },
        colors: {
            upCandleStroke: '#00FF00',
            upCandleFill: '#00FF00',
            downCandleStroke: '#FF0000',
            downCandleFill: '#FF0000',
            chartBackground: '#000000',
            axisText: '#FFFFFF',
            lineChartUptickColor: '#008800',
            lineChartDowntickColor: '#AA0000'
        },
        gridOptions: {
            xAxisShading: true,
            yAxisShading: true,
            gridlines: true,
        },
        candleWidth: 50,
        chartTypes: {
            '1d': 'Candle',
            '4h': 'Candle',
            '1h': 'Candle',
            '30m': 'Candle',
            '15m': 'Candle',
            '10m': 'Candle',
            '5m': 'Candle',
            '1m': 'Candle',
        },
    });
    const [serverLogs, setServerLogs] = useState([]);
    const [showServerLog, setShowServerLog] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
    const [isCrosshairMode, setIsCrosshairMode] = useState(false);
    const [isLiveMode, setIsLiveMode] = useState(false);
    const isLiveModeRef = useRef(false);
    const dataSeriesRefs = useRef({ '1d': null, '4h': null, '1h': null, '30m': null, '15m': null, '10m': null, '5m': null, '1m': null });
    const lastPriceLineRefs = useRef({ '1d': null, '4h': null, '1h': null, '30m': null, '15m': null, '10m': null, '5m': null, '1m': null });
    const sciChartSurfaceRefs = useRef({ '1d': null, '4h': null, '1h': null, '30m': null, '15m': null, '10m': null, '5m': null, '1m': null });
    const candleQueueRef = useRef({ '1d': [], '4h': [], '1h': [], '30m': [], '15m': [], '10m': [], '5m': [], '1m': [] }); // Queue for early candles
    const annotationsRef = useRef([]); // Reference to annotations for easy access across component
    const [isLineMode, setIsLineMode] = useState(false);
    const lineAnnotationsRef = useRef([]);
    const [lineColor, setLineColor] = useState('#FFFF00');
    const [lineType, setLineType] = useState('solid');
    const [showLabel, setShowLabel] = useState(false);
    const [lineOrientation, setLineOrientation] = useState('Both');
    const [isBoxMode, setIsBoxMode] = useState(false);
    const [boxOpacity, setBoxOpacity] = useState(0.2); // 20% default
    const [isAllTimeframes, setIsAllTimeframes] = useState(true); // Whether annotation applies to all timeframes - now true by default
    const [isTrendMode, setIsTrendMode] = useState(false); // New state for trend line mode
    const [isArrowMode, setIsArrowMode] = useState(false); // State for arrow mode
    const [isTextMode, setIsTextMode] = useState(false); // State for text mode
    const [isDrawingLockMode, setIsDrawingLockMode] = useState(false); // New state for drawing lock mode
    const [arrowDirection, setArrowDirection] = useState('up'); // Arrow direction: up, down, left, right
    const [arrowSize, setArrowSize] = useState('M'); // Arrow size: XS, S, M, L, XL
    const [arrowStyle, setArrowStyle] = useState('triangle'); // Arrow style: triangle or arrow
    const [initialized, setInitialized] = useState(false); // State to track when all charts are initialized
    const [annotations, setAnnotations] = useState([]); // Store retrieved annotations
    const [stratAnnotations, setStratAnnotations] = useState([]); // Store strategy annotations
    const [pendingStrategyAnnotations, setPendingStrategyAnnotations] = useState([]); // Store strategy annotations waiting for chart initialization
    const [showAnnotationManager, setShowAnnotationManager] = useState(false);
    const [strategies, setStrategies] = useState([]);
    const [showStrategyManager, setShowStrategyManager] = useState(false);
    const [showIndicatorsStudies, setShowIndicatorsStudies] = useState(false);
    const [showUserStudies, setShowUserStudies] = useState(false);
    const currentColorsRef = useRef(settings.colors); // Add a ref to track current colors
    const initialLoadCompleteRef = useRef(false); // Flag to track initial load of strategy annotations
    const [loadingProgress, setLoadingProgress] = useState('Initializing...'); // New state for loading progress
    const [annotationText, setAnnotationText] = useState('Text');
    const [fontSize, setFontSize] = useState('14'); // Add state for fontSize
    const [textAnchor, setTextAnchor] = useState('Center'); // Add state for text anchor
    const [historyStart, setHistoryStart] = useState('');
    const [liveStart, setLiveStart] = useState('');
    const [liveEnd, setLiveEnd] = useState('');
    const [replayInterval, setReplayInterval] = useState(1000);
    const [isReplayMode, setIsReplayMode] = useState(false);
    const [sessions, setSessions] = useState([]); // For tracking trading sessions
    const [latestTimestamp, setLatestTimestamp] = useState(null);
    const [latestPrice, setLatestPrice] = useState(null); // Add missing state for latestPrice
    const [replayPaused, setReplayPaused] = useState(false);
    const [replayEnded, setReplayEnded] = useState(false);
    const [currentReplayInterval, setCurrentReplayInterval] = useState(replayInterval);
    const [intervalInputValue, setIntervalInputValue] = useState('');
    const [chartLayout, setChartLayout] = useState('4-way'); // New state for chart layout
    const [timeframes, setTimeframes] = useState(fourWayTimeframes); // Default to 4-way timeframes
    // Add state to track strategy annotation counts
    const [strategyAnnotationCounts, setStrategyAnnotationCounts] = useState({});
    // Create DataClient instance
    const dataClientRef = useRef(null);
    
    // Chart click order state
    const [chartClickOrderData, setChartClickOrderData] = useState(null);
    const [isChartClickOrderMode, setIsChartClickOrderMode] = useState(false);
    
    // State for the new Chart Modify Order Overlay
    const [showChartModifyOrderOverlay, setShowChartModifyOrderOverlay] = useState(false);
    
    // State for external client sync notification
    const [showExternalClientSyncNotification, setShowExternalClientSyncNotification] = useState(false);
    
    // Add this new ref at the top with other refs
    const initialAnnotationsProcessedRef = useRef(false);
    
    // Track if we've signaled data flow started to the candle forwarding server
    const dataFlowStartedRef = useRef(false);
    
    useEffect(() => {
        isLiveModeRef.current = isLiveMode;
    }, [isLiveMode]);

    // Function to create annotation IDs while encapsulating the dependencies
    const createAnnotationId = useCallback((annotationType, timeframe) => {
        return generateAnnotationId(clientId, instrument, isAllTimeframes, annotationType, timeframe);
    }, [clientId, instrument, isAllTimeframes]);

    // Function to process annotations
    const processAnnotations = useCallback(() => {
        if (annotations.length > 0) {
            // console.log(`Processing ${annotations.length} user annotations`);
            
            // Use current timeframes based on layout
            const currentTimeframes = chartLayout === '4-way' ? fourWayTimeframes : 
                                    chartLayout === '6-way-long' ? sixWayLongTimeframes : sixWayTimeframes;
            
            // Call rebuildSavedAnnotations with the user annotations
            rebuildSavedAnnotations(
                annotations,
                currentTimeframes,
                sciChartSurfaceRefs,
                (annotation, timeframe) => handleAnnotationUpdated(
                    annotation, 
                    timeframe, 
                    ws, 
                    clientId, 
                    instrument, 
                    isAllTimeframes, 
                    arrowDirection, 
                    currentTimeframes, 
                    sciChartSurfaceRefs
                ),
                isDrawingLockMode // Pass the drawing lock mode state
            );
        }
    }, [annotations, chartLayout, ws, clientId, instrument, isAllTimeframes, arrowDirection, isDrawingLockMode]);

    // Function to process strategy annotations
    const processStrategyAnnotations = useCallback(() => {
        if (stratAnnotations.length > 0) {
            // console.log(`Processing ${stratAnnotations.length} strategy annotations`);
            
            // Use current timeframes based on layout
            const currentTimeframes = chartLayout === '4-way' ? fourWayTimeframes : 
                                    chartLayout === '6-way-long' ? sixWayLongTimeframes : sixWayTimeframes;
            
            // Call rebuildSavedAnnotations with the strategy annotations
            rebuildSavedAnnotations(
                stratAnnotations,
                currentTimeframes,
                sciChartSurfaceRefs,
                null, // No update handler needed for strategy annotations
                isDrawingLockMode // Pass the drawing lock mode state
            );
            
            // Clear the array after processing
            setStratAnnotations([]);
        }
    }, [stratAnnotations, chartLayout, isDrawingLockMode]);

    // Create wrapped handlers for annotations
    const onAnnotationCreated = useCallback((annotation, timeframe) => {
        const currentTimeframes = chartLayout === '4-way' ? fourWayTimeframes : 
                                chartLayout === '6-way-long' ? sixWayLongTimeframes : sixWayTimeframes;
        handleAnnotationCreated(
            annotation, 
            timeframe, 
            ws, 
            clientId, 
            instrument, 
            isAllTimeframes, 
            arrowDirection, 
            currentTimeframes, 
            sciChartSurfaceRefs,
            isDrawingLockMode // Pass the drawing lock mode state
        );
    }, [ws, clientId, instrument, isAllTimeframes, arrowDirection, chartLayout, isDrawingLockMode]);

    const onAnnotationUpdated = useCallback((annotation, timeframe) => {
        const currentTimeframes = chartLayout === '4-way' ? fourWayTimeframes : 
                                chartLayout === '6-way-long' ? sixWayLongTimeframes : sixWayTimeframes;
        handleAnnotationUpdated(
            annotation, 
            timeframe, 
            ws, 
            clientId, 
            instrument, 
            isAllTimeframes, 
            arrowDirection, 
            currentTimeframes, 
            sciChartSurfaceRefs,
            isDrawingLockMode
        );
    }, [ws, clientId, instrument, isAllTimeframes, arrowDirection, chartLayout, isDrawingLockMode]);

    const onAnnotationDeleted = useCallback((annotation, timeframe) => {
        const currentTimeframes = chartLayout === '4-way' ? fourWayTimeframes : 
                                chartLayout === '6-way-long' ? sixWayLongTimeframes : sixWayTimeframes;
        handleAnnotationDeleted(
            annotation, 
            timeframe, 
            ws, 
            currentTimeframes, 
            sciChartSurfaceRefs
        );
    }, [ws, chartLayout]);

    // Set initial timeframes based on chart layout when component mounts
    useEffect(() => {
        if (chartLayout === '4-way') {
            setTimeframes(fourWayTimeframes);
        } else if (chartLayout === '6-way-long') {
            setTimeframes(sixWayLongTimeframes);
        } else {
            setTimeframes(sixWayTimeframes);
        }
    }, []);

    useEffect(() => {
        // Update the colors ref whenever settings.colors changes
        currentColorsRef.current = settings.colors;
        // console.log("Settings colors updated in ref:", currentColorsRef.current);
    }, [settings.colors]);

    useEffect(() => {
        annotationsRef.current = annotations;
        if (annotations.length > 0) {
            // console.log(`Loaded ${annotations.length} annotations for client ${clientId} and instrument ${instrument}`);
        }
    }, [annotations, clientId, instrument]);

    // Watch for changes to stratAnnotations and process them
    useEffect(() => {
        processStrategyAnnotations();
    }, [stratAnnotations, processStrategyAnnotations]);

    // New useEffect to process pending strategy annotations after charts are initialized
    useEffect(() => {
        if (initialized && pendingStrategyAnnotations.length > 0) {
            // console.log(`Charts initialized, processing ${pendingStrategyAnnotations.length} pending strategy annotations`);
            setStratAnnotations(prev => [...prev, ...pendingStrategyAnnotations]);
            setPendingStrategyAnnotations([]);
        }
    }, [initialized, pendingStrategyAnnotations]);

    // New useEffect to rebuild annotations when charts are initialized and annotations are loaded
    useEffect(() => {
        // Only proceed if we have both initialized charts and annotations, and we haven't processed them yet
        if (initialized && annotations.length > 0 && !initialAnnotationsProcessedRef.current) {
            // console.log('Charts initialized and annotations loaded, rebuilding annotations');
            
            // Mark that we've processed initial annotations
            initialAnnotationsProcessedRef.current = true;
            
            // Use the current timeframes based on layout
            const currentTimeframes = chartLayout === '4-way' ? fourWayTimeframes : 
                                    chartLayout === '6-way-long' ? sixWayLongTimeframes : sixWayTimeframes;
            
            // Use the rebuildSavedAnnotations function to recreate annotations on charts
            rebuildSavedAnnotations(
                annotationsRef.current,
                currentTimeframes,
                sciChartSurfaceRefs,
                // Use the onAnnotationUpdated callback for handling annotation updates
                onAnnotationUpdated,
                isDrawingLockMode // Pass current drawing lock mode
            );
        }
    }, [initialized, annotations, chartLayout, onAnnotationUpdated, isDrawingLockMode]);

    const toggleFlyout = () => setIsFlyoutOpen(!isFlyoutOpen);
    const toggleCrosshairMode = () => setIsCrosshairMode(!isCrosshairMode);
    
    // Use the extracted toggle functions
    const handleToggleLineMode = () => {
        toggleLineMode(isLineMode, setIsLineMode, setIsBoxMode, setIsTrendMode, setIsArrowMode, setIsTextMode);
    };
    
    const handleToggleBoxMode = () => {
        toggleBoxMode(isBoxMode, setIsBoxMode, setIsLineMode, setIsTrendMode, setIsArrowMode, setIsTextMode);
    };
    
    const handleToggleTrendMode = () => {
        toggleTrendMode(isTrendMode, setIsTrendMode, setIsLineMode, setIsBoxMode, setIsArrowMode, setIsTextMode);
    };
    
    const handleToggleArrowMode = () => {
        toggleArrowMode(isArrowMode, setIsArrowMode, setIsLineMode, setIsBoxMode, setIsTrendMode, setIsTextMode);
    };

    const handleToggleTextMode = () => {
        toggleTextMode(isTextMode, setIsTextMode, setIsLineMode, setIsBoxMode, setIsTrendMode, setIsArrowMode);
    };

    // New toggle function for drawing lock mode
    const toggleDrawingLockMode = () => setIsDrawingLockMode(!isDrawingLockMode);

    // Effect to handle drawing lock mode changes
    useEffect(() => {
        // Only run this effect if sciChartSurfaceRefs are available
        if (!sciChartSurfaceRefs || !sciChartSurfaceRefs.current) return;
        
        // Get current timeframes based on chart layout
        const currentTimeframes = chartLayout === '4-way' ? fourWayTimeframes : 
                                chartLayout === '6-way-long' ? sixWayLongTimeframes : sixWayTimeframes;
        
        // Process all charts
        currentTimeframes.forEach(timeframe => {
            const sciChartSurface = sciChartSurfaceRefs.current[timeframe];
            if (!sciChartSurface) return;
            
            // Get all annotations from this chart
            const chartAnnotations = sciChartSurface.annotations.asArray();
            let anyChanges = false;
            
            // Update isEditable property for user-drawn annotations only
            chartAnnotations.forEach(annotation => {
                // First check if this is a user annotation by validating ID format
                // Expected format: clientid/instrument/timeframe/annotype/uniqueid
                const isValidFormat = annotation.id && 
                                    typeof annotation.id === 'string' && 
                                    annotation.id.split('/').length === 5;
                
                // Skip if not valid format
                if (!isValidFormat) return;
                
                // Skip if it's a strategy annotation
                if (annotation.id.includes('strategy')) return;
                
                // Skip if it's a trade annotation
                if (annotation.id.includes('trade')) return;
                
                // Skip if it's a TradeManager annotation
                if (annotation.id.startsWith('TradeManager')) return;
                
                // At this point, we know it's a user-drawn annotation
                
                // Check if we need to change the isEditable state
                if (annotation.isEditable !== !isDrawingLockMode) {
                    // Set isEditable based on drawing lock mode
                    annotation.isEditable = !isDrawingLockMode;
                    anyChanges = true;
                }
                
                // When drawing lock is enabled, also deselect all user annotations
                if (isDrawingLockMode && annotation.isSelected) {
                    // This step is key - deselection prevents further interaction
                    annotation.isSelected = false;
                    annotation.isEditable = false; // Set after isSelected to make sure it "takes effect"
                    anyChanges = true;
                }
            });
            
            // Only refresh the chart if we made changes
            if (anyChanges) {
                sciChartSurface.invalidateElement();
            }

        /*    

        // Debug code - commented out for now
        const chartAnnotations2 = sciChartSurface.annotations.asArray(); 
        chartAnnotations2.forEach(annotation => {
            // console.log('[DEBUG-LOCK]Annotation ID:', annotation.id, 'isEditable:', annotation.isEditable, 'isSelected:', annotation.isSelected);
        })
        */
        
        });
        
        // console.log(`Drawing lock mode ${isDrawingLockMode ? 'enabled' : 'disabled'}`);
    }, [isDrawingLockMode, chartLayout]);

    // Add useEffect for updateZoomPanModifierState
    useEffect(() => {
        const currentTimeframes = chartLayout === '4-way' ? fourWayTimeframes : 
                                chartLayout === '6-way-long' ? sixWayLongTimeframes : sixWayTimeframes;
        updateZoomPanModifierState(isBoxMode, isTrendMode, isArrowMode, isTextMode, sciChartSurfaceRefs, currentTimeframes);
    }, [chartLayout, isBoxMode, isTrendMode, isArrowMode, isTextMode]);

    // Initialize DataClient
    useEffect(() => {
        // Create DataClient instance if not already created
        if (!dataClientRef.current) {
            dataClientRef.current = new DataClient();
            // console.log('App: DataClient initialized');
        }
    }, []);

    // Update the handleLiveCandleUpdateCallback to also push candle updates to the shared data service
    const handleLiveCandleUpdateCallback = useCallback((candle, timeframe) => {
        // console.log(`Handling live candle update for ${timeframe}`, candle);
        
        // Get references from the current refs
        const dataSeries = dataSeriesRefs.current[timeframe];
        const lastPriceLine = lastPriceLineRefs.current[timeframe];
        const sciChartSurface = sciChartSurfaceRefs.current[timeframe];
        
        // Update chart via the existing SciChart handler
        handleLiveCandleUpdate(candle, timeframe, currentColorsRef.current, dataSeries, lastPriceLine, sciChartSurface);
        
        // CRITICAL FIX: Also update the chartData state for crosshair mapping
        setChartData(prevData => {
          const updatedData = { ...prevData };
          const timeframeData = [...(updatedData[timeframe] || [])];
          
          // Find if candle with this timestamp already exists
          const existingIndex = timeframeData.findIndex(c => c.timestamp === candle.timestamp);
          
          if (existingIndex >= 0) {
            // Update existing candle
            timeframeData[existingIndex] = candle;
          } else {
            // Add new candle
            timeframeData.push(candle);
          }
          
          // Keep array sorted by timestamp
          timeframeData.sort((a, b) => a.timestamp - b.timestamp);
          
          updatedData[timeframe] = timeframeData;
          return updatedData;
        });
        
        // Get current instrument state
        const currentInstrument = instrument;
        
        // Process candle using the CandleEventService to detect closures
        if (currentInstrument) {
          candleEventService.processCandle(currentInstrument, timeframe, candle);
        }
        
        // Update the latest timestamp when we receive a 1m candle
        if (timeframe === '1m' && candle.timestamp) {
          // Track sessions based on 1-minute candles, but only when a new candle is added
          setChartData(prevData => {
            const updatedData = { ...prevData };
            const timeframeData = [...(updatedData[timeframe] || [])];
            
            // Find if candle with this timestamp already exists
            const existingIndex = timeframeData.findIndex(c => c.timestamp === candle.timestamp);
            
            if (existingIndex >= 0) {
              // Update existing candle
              timeframeData[existingIndex] = candle;
            } else {
              // Add new candle - only process sessions for new candles
              timeframeData.push(candle);
              
              // Process sessions after adding the new candle
              setTimeout(() => {
                const sortedCandles = [...timeframeData].sort((a, b) => a.timestamp - b.timestamp);
                const updatedSessions = [];
                let currentSessionStart = sortedCandles[0].timestamp;
                let loggedGaps = new Set(); // Track which gaps we've already logged
                
                // Iterate through candles to find gaps (session breaks)
                for (let i = 1; i < sortedCandles.length; i++) {
                  const prevCandle = sortedCandles[i-1];
                  const currCandle = sortedCandles[i];
                  
                  // Check for a gap of SESSION_GAP_MINUTES or more
                  const timeDiff = currCandle.timestamp - prevCandle.timestamp;
                  const oneMinuteInMs = 60 * 1000; // 1 minute in milliseconds
                  const sessionGapMs = SESSION_GAP_MINUTES * oneMinuteInMs;
                  
                  // Log key information about candles with significant gaps, but only once per gap
                  const gapId = `${prevCandle.timestamp}-${currCandle.timestamp}`;
                  if (timeDiff >= 30 * oneMinuteInMs && !loggedGaps.has(gapId)) {
                    loggedGaps.add(gapId);
                    // console.log(`[DEBUG] Gap found: ${timeDiff/oneMinuteInMs} min, Previous: ${new Date(prevCandle.timestamp).toLocaleTimeString()}, Current: ${new Date(currCandle.timestamp).toLocaleTimeString()}, SessionGapThreshold: ${SESSION_GAP_MINUTES} min`);
                  }
                  
                  if (timeDiff > sessionGapMs) {
                    // We found a gap, so the previous session ends here
                    const sessionEnd = prevCandle.timestamp + oneMinuteInMs;
                    
                    // Add this completed session
                    updatedSessions.push({
                      startTime: currentSessionStart,
                      endTime: sessionEnd
                    });
                    
                    // Start a new session with the current candle
                    currentSessionStart = currCandle.timestamp;
                    if (!loggedGaps.has(`new-${gapId}`)) {
                      loggedGaps.add(`new-${gapId}`);
                      // console.log(`[SESSION] New session started at ${new Date(currentSessionStart).toLocaleTimeString()} after gap of ${timeDiff/oneMinuteInMs} min`);
                    }
                  }
                }
                
                // Add the current active session
                updatedSessions.push({
                  startTime: currentSessionStart,
                  endTime: null // Still active
                });
                
                // Return sessions in reverse chronological order (newest first)
                // with relative numbers (0, -1, -2, etc.)
                const newSessions = updatedSessions.reverse().map((session, index) => ({
                  ...session,
                  relativeNumber: -1 * index
                }));
                
                // Only update sessions if there's a change in the number of sessions or the active session
                if (newSessions.length !== sessions.length || 
                    (newSessions.length > 0 && sessions.length > 0 && 
                     (newSessions[0].startTime !== sessions[0].startTime || 
                      (newSessions[0].endTime !== sessions[0].endTime && 
                       (newSessions[0].endTime === null || sessions[0].endTime === null))))) {
                   // console.log(`[SESSION] Updating sessions: ${newSessions.length} sessions found`);
                   setSessions(newSessions);
                 }
              }, 0);
            }
            
            // Keep array sorted by timestamp
            timeframeData.sort((a, b) => a.timestamp - b.timestamp);
            
            updatedData[timeframe] = timeframeData;
            return updatedData;
          });
          
          setLatestTimestamp(candle.timestamp);
          
          // Get current instrument state
          const currentInstrument = instrument;
          const currentPrice = candle.close;
          
          // Ensure we have valid data before updating
          if (currentInstrument && (currentPrice !== null && currentPrice !== undefined)) {
            // Set latest price (for UI)
            setLatestPrice(currentPrice);
            
            // Push to shared data service only
            if (dataClientRef.current) {
              dataClientRef.current.push(`candles:${currentInstrument}:${timeframe}`, candle);
              
              // Update market data
              dataClientRef.current.updateMarketData({
                currentSymbol: currentInstrument,
                latestPrice: currentPrice
              });
            }
            
            // Remove the force-update-redux IPC call
            // Keep the following try-catch block only if needed for other purposes
            try {
              const { ipcRenderer } = window.require('electron');
              
              // Send market data update via IPC for backward compatibility with components
              // not yet using the DataClient
              ipcRenderer.send('market-data-update', { 
                symbol: currentInstrument,
                price: currentPrice
              });
            } catch (error) {
              console.error('Error sending market data update:', error);
            }
          } else {
            console.warn(`Skipped update. Invalid data: Instrument=${currentInstrument}, Price=${currentPrice}`);
          }
        } else {
          // For timeframes other than 1m, still push to shared data service
          if (dataClientRef.current && instrument) {
            dataClientRef.current.push(`candles:${instrument}:${timeframe}`, candle);
          }
        }
    }, [instrument, chartData]); // Removed processSessionsFromCandles from dependencies

    // Add useEffect to reset the CandleEventService when the component unmounts
    useEffect(() => {
      // Initialize the candleEventService when component mounts
      // console.log('App: Initializing CandleEventService');
      
      // Register a callback for when candles close
      const unsubscribe = candleEventService.onCandleClosure((event) => {
        // console.log(`App: Candle closure detected for ${event.symbol} ${event.timeframe}`, event);
        
        // We don't need to do anything here - the service automatically sends IPC messages
      });
      
      // Clean up the candleEventService when component unmounts
      return () => {
        // console.log('App: Cleaning up CandleEventService');
        unsubscribe();
        candleEventService.reset();
      };
    }, []);

    // Add a new useEffect to listen for Smart Stop settings changes
    useEffect(() => {
      try {
        const { ipcRenderer } = window.require('electron');
        
        // Listen for Smart Stop settings changes
        ipcRenderer.on('smart-stop-settings-changed', (event, settings) => {
          console.log('App: Received Smart Stop settings changes:', settings);
          
          // If candle stop was enabled, ensure candleEventService is active
          if (settings.candleStopEnabled) {
            console.log(`App: Candle stop enabled for ${settings.candleTimeframe} timeframe`);
            
            // Make sure candle-event-service knows we need candle closure events
            const timeframe = settings.candleTimeframe;
            
            // We don't need to do anything special - candleEventService automatically
            // detects candle closures and sends IPC events
            console.log(`App: Candle stop activated - will monitor ${timeframe} candles for closure events`);
          }
        });
        
        return () => {
          ipcRenderer.removeAllListeners('smart-stop-settings-changed');
        };
      } catch (error) {
        console.error('App: Error setting up Smart Stop settings listener:', error);
      }
    }, []);

    const setDataSeriesRef = useCallback((timeframe, ref) => {
        dataSeriesRefs.current[timeframe] = ref;
        // console.log(`DataSeries ref set for ${timeframe}:`, !!ref);

        // Process any queued candles for this timeframe now that the ref is set
        const queue = candleQueueRef.current[timeframe];
        if (queue.length > 0) {
            const startTime = performance.now(); // Start timer
            // console.log(`Processing ${queue.length} queued candles for ${timeframe}...`);
            
            // Sort the queue to process boundary candles last
            // This ensures that if newer versions of the same candle are in the queue,
            // they get processed first
            queue.sort((a, b) => {
                // If a is a boundary candle and b is not, a comes after b
                if (a.candle._isBoundaryCandle && !b.candle._isBoundaryCandle) return 1;
                // If b is a boundary candle and a is not, b comes after a
                if (!a.candle._isBoundaryCandle && b.candle._isBoundaryCandle) return -1;
                // Otherwise, sort by timestamp (newer first)
                return b.candle.timestamp - a.candle.timestamp;
            });
            
            // Process regular candles normally
            queue.filter(item => !item.candle._isBoundaryCandle).forEach(({ candle }) => {
                handleLiveCandleUpdateCallback(candle, timeframe);
            });
            
            // For boundary candles, do an existence check first
            queue.filter(item => item.candle._isBoundaryCandle).forEach(({ candle }) => {
                const dataSeries = dataSeriesRefs.current[timeframe];
                if (!dataSeries) return;
                
                const count = dataSeries.count();
                let candleExists = false;
                
                // Check if this candle already exists in the chart data
                for (let i = 0; i < count; i++) {
                    const existingTimestamp = dataSeries.getNativeXValues().get(i);
                    if (existingTimestamp === candle.timestamp) {
                        candleExists = true;
                        // console.log(`Boundary candle for ${timeframe} already exists in queue processing, skipping`);
                        break;
                    }
                }
                
                // Only process if candle doesn't already exist
                if (!candleExists) {
                    // console.log(`Boundary candle for ${timeframe} missing in queue processing, now adding it`);
                    handleLiveCandleUpdateCallback(candle, timeframe);
                }
            });
            
            const endTime = performance.now(); // End timer
            const duration = (endTime - startTime).toFixed(2); // Calculate duration
            candleQueueRef.current[timeframe] = []; // Clear the queue
            // console.log(`Queue for ${timeframe} processed and cleared in ${duration} ms.`); // Log duration
        }
    }, [handleLiveCandleUpdateCallback]);

    const setLastPriceLineRef = useCallback((timeframe, ref) => {
        lastPriceLineRefs.current[timeframe] = ref;
    }, []);

    const setSciChartSurfaceRef = useCallback((timeframe, surface) => {
        sciChartSurfaceRefs.current[timeframe] = surface;
        // console.log(`SciChartSurfaceRef set for ${timeframe}:`, !!surface);
        
        // Check if all charts are initialized based on the current layout and current timeframes in use
        const currentTimeframes = timeframes;
        const allInitialized = currentTimeframes.every(tf => sciChartSurfaceRefs.current[tf] !== null);
        
        if (allInitialized) {
            console.log('All chart surfaces are now initialized');
            setLoadingProgress('All charts initialized, rendering annotations...');
            setInitialized(true);
            
                    // Initialize internal strategy annotations
        internalStrategyAnnotations.initialize(sciChartSurfaceRefs, currentTimeframes, chartData, sessions);
        // console.log('Internal strategy annotations initialized');

        // Initialize User Studies system (only if enabled and not already initialized)
        if (ENABLE_USER_STUDIES && UserStudyManager && !UserStudyManager.isInitialized()) {
            UserStudyManager.initialize(sciChartSurfaceRefs.current, currentTimeframes, chartData, sessions);
        }
            
            // Initialize session labels annotations
            sessionLabelsAnnotations.initialize(sciChartSurfaceRefs, currentTimeframes, chartData, sessions);
            // console.log('Session labels annotations initialized');
            
            // Initialize killzones annotations
            killzonesAnnotations.initialize(sciChartSurfaceRefs.current, chartData);
            // console.log('Killzones annotations initialized');
            
            // Initialize ICT price lines annotations
            ictPriceLinesAnnotations.initialize(sciChartSurfaceRefs.current, currentTimeframes, chartData);
            // console.log('ICT price lines annotations initialized');
            
            // Initialize opening gaps annotations - DISABLED - Converted to User Study
            // openingGapsAnnotations.initialize(sciChartSurfaceRefs.current, currentTimeframes, chartData);
            // console.log('Opening gaps annotations initialized');
        }
    }, [timeframes]);

    // Update killzones annotations when chart data changes
    useEffect(() => {
        if (initialized && killzonesAnnotations) {
            killzonesAnnotations.updateCandleData(chartData);
        }
    }, [chartData, initialized]);

    // Update ICT price lines annotations when chart data changes
    useEffect(() => {
        if (initialized && ictPriceLinesAnnotations) {
            ictPriceLinesAnnotations.updateCandleData(chartData);
        }
    }, [chartData, initialized]);

    // Update opening gaps annotations when chart data changes - DISABLED - Converted to User Study
    // useEffect(() => {
    //     if (initialized && openingGapsAnnotations) {
    //         openingGapsAnnotations.updateData(chartData);
    //     }
    // }, [chartData, initialized]);

    // ICT Price Lines now uses simple internal session calculations - no session updates needed

    useEffect(() => {
        SciChartSurface.configure({
            dataUrl: 'scichart2d.data',
            wasmUrl: 'scichart2d.wasm',
        });
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.on('open-settings', () => {
            setShowSettings(true);
        });
        ipcRenderer.on('open-server-log', () => {
            setShowServerLog(true);
        });
        ipcRenderer.on('open-annotation-manager', () => {
            setShowAnnotationManager(true);
        });
        ipcRenderer.on('open-strategy-manager', () => {
            setShowStrategyManager(true);
        });
        
        if (ENABLE_USER_STUDIES) {
            ipcRenderer.on('open-user-studies', () => {
                setShowUserStudies(true);
            });
        }
        ipcRenderer.on('open-indicators-studies', () => {
            setShowIndicatorsStudies(true);
        });
        
        // Add listener for Trade Manager data requests
        ipcRenderer.on('request-data-for-trade-manager', () => {
            // Get the current price from the latest data point of the smallest timeframe
            let currentPrice = 0;
            if (chartData['1m'] && chartData['1m'].length > 0) {
                currentPrice = chartData['1m'][chartData['1m'].length - 1].close;
            }
            
            console.log('Sending data to Trade Manager:', { instrument, currentPrice });
            
            // Send data to the Trade Manager window
            ipcRenderer.send('main-window-data', {
                instrument: instrument,
                currentPrice: currentPrice
            });
        });
        
        // Add listener for trade executions from Trade Manager
        ipcRenderer.on('execute-trade', (event, tradeData) => {
            console.log('Trade executed:', tradeData);
            // Implement trade execution logic or annotation creation here
            
            // Example: Create an annotation for the trade
            // Had to comment this out...AI added it without asking me!
            /*
            if (sciChartSurfaceRefs.current['1m']) {
                const tradeType = tradeData.action === 'buy' ? 'BUY' : 'SELL';
                const annotationId = generateAnnotationId();
                
                // Create annotation data
                const annotationData = {
                    clientid: `quatrain-${clientId}`,
                    uniqueid: annotationId,
                    instrument: instrument,
                    timeframe: '1m', // Add to the smallest timeframe
                    x1: Date.now(), // Current time
                    y1: tradeData.price,
                    type: 'text',
                    options: {
                        text: `${tradeType} ${tradeData.quantity}`,
                        fontSize: '14',
                        textColor: tradeData.action === 'buy' ? '#00FF00' : '#FF0000',
                        backgroundColor: 'transparent'
                    }
                };
                
                // Add annotation to the chart
                handleAnnotationCreated(annotationData, sciChartSurfaceRefs.current);
                
                // If WebSocket is connected, save the annotation to the server
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        action: 'save_anno',
                        anno: annotationData
                    }));
                }
            }
            */
        });
        
        return () => {
            ipcRenderer.removeAllListeners('open-settings');
            ipcRenderer.removeAllListeners('open-server-log');
            ipcRenderer.removeAllListeners('open-annotation-manager');
            ipcRenderer.removeAllListeners('open-strategy-manager');
            if (ENABLE_USER_STUDIES) {
                ipcRenderer.removeAllListeners('open-user-studies');
            }
            ipcRenderer.removeAllListeners('open-indicators-studies');
            ipcRenderer.removeAllListeners('request-data-for-trade-manager');
            ipcRenderer.removeAllListeners('execute-trade');
        };
    }, [chartData, clientId, instrument]);

    // Add a new useEffect for direct market data sharing
    useEffect(() => {
        try {
            const { ipcRenderer } = window.require('electron');
            
            // Listen for requests for current market data
            ipcRenderer.on('request-current-market-data', () => {
                // Get current instrument and price
                const currentInstrument = instrument;
                let currentPrice = null;
                
                // Get the current price from the latest data point of the smallest timeframe
                if (chartData['1m'] && chartData['1m'].length > 0) {
                    currentPrice = chartData['1m'][chartData['1m'].length - 1].close;
                }
                
                console.log(`[Direct IPC] Responding with current market data: { symbol: ${currentInstrument}, price: ${currentPrice} }`);
                
                // Send the current data directly
                if (currentInstrument && currentPrice !== null) {
                    ipcRenderer.send('current-market-data', {
                        symbol: currentInstrument,
                        price: currentPrice
                    });
                }
            });
            
            return () => {
                ipcRenderer.removeAllListeners('request-current-market-data');
            };
        } catch (error) {
            console.error('Error setting up direct market data sharing:', error);
        }
    }, [instrument, chartData]);

    // Add a new useEffect to send price updates to Trade Manager window when prices change
    useEffect(() => {
        const { ipcRenderer } = window.require('electron');
        
        // Get the current price from the latest data point of the smallest timeframe
        if (chartData['1m'] && chartData['1m'].length > 0) {
            const currentPrice = chartData['1m'][chartData['1m'].length - 1].close;
            
            // Send price update to Trade Manager window if it exists
            ipcRenderer.send('price-update', currentPrice);
        }
    }, [chartData]);

    const connect = (instrumentOverride = null) => {
        // Use the provided instrument override or fall back to the state value
        const currentInstrument = instrumentOverride || instrument;
        console.log('App.js: Connecting with instrument:', currentInstrument, '(override:', instrumentOverride, ', state:', instrument, ')');
        
        const fullClientId = `quatrain-${clientId}`;
        
        // Set the timeframes based on the selected chart layout
        if (chartLayout === '4-way') {
            setTimeframes(fourWayTimeframes);
        } else if (chartLayout === '6-way-long') {
            setTimeframes(sixWayLongTimeframes);
        } else {
            setTimeframes(sixWayTimeframes);
        }
        
        // CRITICAL FIX: When in Live mode, we need to set the ref value directly before any data arrives
        if (dataMode === 'Live') {
            isLiveModeRef.current = true;
            console.log('Set isLiveModeRef.current = true directly before WebSocket connection');
        } else {
            isLiveModeRef.current = false;
            console.log('Set isLiveModeRef.current = false directly before WebSocket connection');
        }
        
        const websocket = new WebSocket('ws://localhost:8080');
        websocket.onopen = () => {
            setLoading(true);
            setSettingsLoaded(false);
            setDataLoaded(false);
            initialLoadCompleteRef.current = false; // Reset flag on new connection
            setLoadingProgress('Connecting to server...');
            
            // Step 1: Set client ID
            websocket.send(JSON.stringify({ action: 'set_client_id', clientid: fullClientId }));
            setLoadingProgress('Setting client ID...');
            
            // Step 2: Get client settings
            websocket.send(JSON.stringify({ action: 'get_client_settings', client_id: fullClientId }));
            setLoadingProgress('Retrieving client settings...');
            
            // Step 3: Request annotations for this client and instrument
            websocket.send(JSON.stringify({ 
                action: 'get_anno',
                clientid: fullClientId,
                instrument: currentInstrument,
                clienttype: 'client'
            }));
            setLoadingProgress('Loading annotations...');
            
            // Step 3.5: Request strategies and check for subscriptions
            websocket.send(JSON.stringify({ action: 'get_strat' }));
            setLoadingProgress('Loading strategy information...');
            
            // Set the replay mode state based on the data mode selection
            setIsReplayMode(dataMode === 'Replay');
            
            // Skip data request if in Replay mode without proper datetime values
            if (dataMode === 'Replay') {
                if (!historyStart || !liveStart || !liveEnd) {
                    console.error('Replay mode selected but missing datetime values:', {
                        historyStart,
                        liveStart,
                        liveEnd
                    });
                    alert('Please fill in all date-time fields for Replay mode');
                    setLoading(false);
                    return;
                }
            }
            
            // Step 4: Prepare data subscriptions based on selected chart layout
            const currentTimeframes = chartLayout === '4-way' ? fourWayTimeframes : 
                                    chartLayout === '6-way-long' ? sixWayLongTimeframes : sixWayTimeframes;
            
            const subscriptions = currentTimeframes.map(timeframe => ({
                instrument: currentInstrument,
                timeframe
            }));
            
            
            // Decide which data request to send based on mode
            if (dataMode === 'Replay') {
                // Convert Eastern Time inputs to UTC timestamps
                const historyStartTimestamp = convertToUTCTimestamp(historyStart);
                const liveStartTimestamp = convertToUTCTimestamp(liveStart);
                const liveEndTimestamp = convertToUTCTimestamp(liveEnd);
                
                console.log('Using replay date-time values:', {
                    historyStart, 
                    liveStart, 
                    liveEnd,
                    historyStartTimestamp,
                    liveStartTimestamp,
                    liveEndTimestamp
                });
                
                console.log('Sending replay request with:', {
                    historyStart: historyStartTimestamp,
                    liveStart: liveStartTimestamp,
                    liveEnd: liveEndTimestamp,
                    subscriptions
                });
                
                // Send the replay request for the selected timeframes
                websocket.send(JSON.stringify({
                    action: 'get_replay',
                    history_start: historyStartTimestamp,
                    live_start: liveStartTimestamp,
                    live_end: liveEndTimestamp,
                    replay_interval: replayInterval,
                    subscriptions: subscriptions,
                    sendto: 'websocket'
                }));
                
                // Start in NOT paused state for Replay mode so playback begins immediately
                setReplayPaused(false);
            } else if (dataMode === 'Live') {
                console.log('Subscribing to live data for:', subscriptions);
                
                // Send the request for live data with appropriate history
                const days = parseInt(historicalDays, 10);
                const startTime = Date.now() - days * 86400000;
                
                websocket.send(JSON.stringify({
                    action: 'get_data',
                    subscriptions: subscriptions,
                    start_time: startTime,
                    sendto: 'websocket',
                    live_data: 'all'
                }));
                
                // Set Live Mode flag for live data handling
                setIsLiveMode(true);
            } else if (dataMode === 'History Only') {
                console.log('Loading historical data only for:', subscriptions);
                
                // Send the request for historical data only
                const days = parseInt(historicalDays, 10);
                const startTime = Date.now() - days * 86400000;
                
                websocket.send(JSON.stringify({
                    action: 'get_data',
                    start_time: startTime,
                    subscriptions: subscriptions,
                    sendto: 'websocket',
                    save_cache: false
                }));
                
                // Not in live mode for history only
                setIsLiveMode(false);
            }

            setWs(websocket);
            setIsConnected(true);
            accumulatedDataRef.current = { 
                '1d': [],
                '4h': [],
                '1h': [], 
                '30m': [], 
                '15m': [], 
                '10m': [], 
                '5m': [], 
                '1m': [] 
            };
        };

        websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.mtyp === 'ctrl') {
                if (message.action === 'client_settings_response') {
                    if (message.settings) {
                        setLoadingProgress('Applying client settings...');
                        setSettings((prevSettings) => {
                            const mergedSettings = { ...prevSettings };
                            // Iterate over the keys in the received settings
                            for (const key in message.settings) {
                                if (message.settings.hasOwnProperty(key)) {
                                    // If the key is 'colors', perform a specific merge for the colors object
                                    if (key === 'colors' && typeof message.settings[key] === 'object' && prevSettings[key]) {
                                        const incomingColors = message.settings[key];
                                        const currentDefaultColors = settings.colors; // Use initial settings.colors as the base for known keys
                                        
                                        const newColors = { ...currentDefaultColors }; // Start with a copy of initial default colors
                                        
                                        for (const colorKey in incomingColors) {
                                          if (incomingColors.hasOwnProperty(colorKey)) {
                                            // Only accept keys that are present in the initial default color set 
                                            // OR are the specifically known new line chart color keys.
                                            // This prevents unknown/old keys from the backend from being added.
                                            if (currentDefaultColors.hasOwnProperty(colorKey) || 
                                                colorKey === 'lineChartUptickColor' || 
                                                colorKey === 'lineChartDowntickColor') {
                                               newColors[colorKey] = incomingColors[colorKey];
                                            }
                                          }
                                        }
                                        // Explicitly ensure the old incorrect keys are not part of the final merged colors
                                        delete newColors.lineUptickColor;
                                        delete newColors.lineDowntickColor;

                                        mergedSettings[key] = newColors;

                                    } else if (typeof message.settings[key] === 'object' && prevSettings[key] && !Array.isArray(message.settings[key]) && message.settings[key] !== null) {
                                        // For other objects (like chartBehavior, gridOptions), merge them
                                        mergedSettings[key] = { ...prevSettings[key], ...message.settings[key] };
                                    } else {
                                        // For primitive values or if not an object, just assign
                                        mergedSettings[key] = message.settings[key];
                                    }
                                }
                            }
                            // Ensure candleWidth and chartTypes are also correctly handled if they come from backend
                            if (message.settings && message.settings.candleWidth !== undefined) {
                                mergedSettings.candleWidth = message.settings.candleWidth;
                            } else if (prevSettings.candleWidth === undefined) { // Ensure default if not from backend
                                mergedSettings.candleWidth = 50; 
                            }

                            if (message.settings && message.settings.chartTypes !== undefined) {
                                mergedSettings.chartTypes = { ...prevSettings.chartTypes, ...message.settings.chartTypes };
                            } else if (Object.keys(prevSettings.chartTypes || {}).length === 0) { // Ensure default if not from backend or empty
                                mergedSettings.chartTypes = {
                                    '1d': 'Candle',
                                    '4h': 'Candle',
                                    '1h': 'Candle',
                                    '30m': 'Candle',
                                    '15m': 'Candle',
                                    '10m': 'Candle',
                                    '5m': 'Candle',
                                    '1m': 'Candle',
                                };
                            }

                            console.log('Merged settings:', mergedSettings);
                            return mergedSettings;
                        });
                    }
                    setSettingsLoaded(true);
                    setLoadingProgress('Settings loaded successfully');
                } else if (message.action === 'get_anno_response') {
                    if (message.clienttype === "strategy") {
                        // Strategy annotations handling
                    if (message.annos && Array.isArray(message.annos)) {
                            setLoadingProgress(`Loading ${message.annos.length} strategy annotations...`);
                            console.log(`Received ${message.annos.length} annotations from strategy ${message.clientid}`);
                            
                            // Add to pending or active annotations based on chart initialization
                            if (initialized) {
                                // Charts are initialized, process directly
                                setStratAnnotations(prev => [...prev, ...message.annos]);
                            } else {
                                // Charts not initialized yet, add to pending
                                console.log(`Charts not initialized, adding ${message.annos.length} annotations to pending queue`);
                                setPendingStrategyAnnotations(prev => [...prev, ...message.annos]);
                            }
                        }
                    } else if (message.clienttype !== "strategy") {
                        // Regular client annotations handling
                        if (message.annos && Array.isArray(message.annos)) {
                            setLoadingProgress(`Loading ${message.annos.length} client annotations...`);
                        console.log(`Received ${message.annos.length} annotations from server`);
                        setAnnotations(message.annos);
                    } else {
                        console.log('Received empty annotations array from server');
                        setAnnotations([]);
                        }
                    }
                } else if (message.action === 'get_strat_response') {
                    if (message.strats && Array.isArray(message.strats)) {
                        setLoadingProgress(`Loading ${message.strats.length} strategies...`);
                        console.log(`Received ${message.strats.length} available strategies from server`);
                        setStrategies(message.strats);
                        
                        // Only check for subscriptions during initial load
                        if (!initialLoadCompleteRef.current) {
                            console.log("Initial load: checking for subscribed strategies");
                            // Check if this client is subscribed to any of these strategies
                            const fullClientId = `quatrain-${clientId}`;
                            message.strats.forEach(strategy => {
                                if (strategy.subscribers && 
                                    strategy.subscribers.subscribers && 
                                    Array.isArray(strategy.subscribers.subscribers) && 
                                    strategy.subscribers.subscribers.includes(fullClientId)) {
                                    
                                    console.log(`Client ${fullClientId} is subscribed to strategy: ${strategy.clientid}, requesting annotations`);
                                    
                                    // Request annotations for this strategy
                                    if (websocket && websocket.readyState === WebSocket.OPEN) {
                                        const request = {
                                            action: "get_anno",
                                            clienttype: "strategy",
                                            clientid: strategy.clientid,
                                            instrument: instrument
                                        };
                                        
                                        websocket.send(JSON.stringify(request));
                                        console.log(`Requesting annotations for strategy: ${strategy.clientid}`);
                                    }
                                }
                            });
                            
                            // Mark initial load as complete
                            initialLoadCompleteRef.current = true;
                            console.log("Initial strategy load complete, future get_strat_response will not trigger annotation loading");
                        } else {
                            console.log("Skipping strategy annotation loading - not in initial load phase");
                        }
                    } else {
                        console.log('Received empty strategies array from server');
                        setStrategies([]);
                    }
                } else if (message.action === 'sub_strat_response') {
                    // Handle successful subscription
                    // console.log(`[DEBUG] message.success is ${message.success} and message.stratid is ${message.stratid}`);
                    if (message.message && message.message.startsWith("Success") && message.stratid) {
                        console.log(`Successfully subscribed to strategy: ${message.stratid}`);
                        
                        // Clear any existing annotations for this strategy
                        clearStrategyAnnotations(message.stratid);
                        
                        // Request annotations for the newly subscribed strategy
                        console.log(`[DEBUG] websocket is defined: ${!!websocket} and websocket.readyState is ${websocket.readyState}`);
                        if (websocket && websocket.readyState === WebSocket.OPEN) {
                            const request = {
                                action: "get_anno",
                                clienttype: "strategy",
                                clientid: message.stratid,
                                instrument: instrument
                            };
                            
                            websocket.send(JSON.stringify(request));
                            console.log(`Requesting annotations for strategy: ${message.stratid}`);
                        }
                    }
                }
                setServerLogs((prevLogs) => [
                    ...prevLogs,
                    { timestamp: Date.now(), message },
                ]);
            } else if (message.mtyp === 'error') {
                setServerLogs((prevLogs) => [
                    ...prevLogs,
                    { timestamp: Date.now(), message },
                ]);
            } else if (message.mtyp === 'strategy') {
                console.log(`Received strategy message: ${JSON.stringify(message)}`);
                
                // Handle strategy-specific messages
                if (message.action === 'anno_deleted' && message.clientid && message.uniqueid) {
                    console.log(`Processing strategy annotation deletion: ${message.clientid}/${message.uniqueid}`);
                    
                    // Call the utility function to find and delete the annotation from all charts
                    const deleted = deleteAnnotationByIds(
                        message.clientid,
                        message.uniqueid,
                        sciChartSurfaceRefs,
                        timeframes
                    );
                    
                    if (deleted) {
                        console.log(`Successfully deleted strategy annotation: ${message.clientid}/${message.uniqueid}`);
                        // Update annotation counts after deletion
                        countStrategyAnnotations();
                    } else {
                        console.log(`Could not find strategy annotation to delete: ${message.clientid}/${message.uniqueid}`);
                    }
                } else if (message.action === 'anno_saved' && message.anno) {
                    console.log(`Processing strategy annotation save: ${message.anno.clientid}/${message.anno.unique}`);
                    
                    // First, delete any existing version of this annotation
                    if (message.anno.clientid && message.anno.unique) {
                        deleteAnnotationByIds(
                            message.anno.clientid,
                            message.anno.unique,
                            sciChartSurfaceRefs,
                            timeframes
                        );
                    }
                    
                    // Then rebuild/add the annotation
                    rebuildSavedAnnotations(
                        [message.anno], // Wrap in array since rebuildSavedAnnotations expects an array
                        timeframes,
                        sciChartSurfaceRefs,
                        null // No update handler needed for strategy annotations
                    );
                    
                    // Update annotation counts after adding
                    countStrategyAnnotations();
                }
                
                setServerLogs((prevLogs) => [
                    ...prevLogs,
                    {timestamp: Date.now(), message },
                ]);
            } else if (message.mtyp === 'data') {
                // Signal data flow started on first data message
                if (!dataFlowStartedRef.current) {
                    try {
                        const { ipcRenderer } = window.require('electron');
                        ipcRenderer.send('candle-data-started');
                        dataFlowStartedRef.current = true;
                        console.log('Signaled candle data flow started');
                    } catch (error) {
                        console.error('Error signaling candle data started:', error);
                    }
                }
                
                // Forward candle data to external clients immediately
                try {
                    const { ipcRenderer } = window.require('electron');
                    ipcRenderer.send('candle-data-forward', message);
                } catch (error) {
                    console.error('Error forwarding candle data:', error);
                }
                
                const { timeframe, ...candle } = message;
                if (!accumulatedDataRef.current[timeframe]) {
                    console.warn(`Unknown timeframe received: ${timeframe}`);
                    return;
                }

                // REVISED: Clearer logic for handling data in different modes
                if (candle.source === 'T') {
                    // Live data handling
                    console.log(`Received live candle for ${timeframe}`);
                    
                    if (!isLiveModeRef.current) {
                        // First live candle in a non-live mode - render charts and switch to live mode
                        console.log('First Live candle! Transitioning to live mode');
                        console.log('Accumulated data before transition:', {
                            '1h': accumulatedDataRef.current['1h'].length,
                            '15m': accumulatedDataRef.current['15m'].length,
                            '5m': accumulatedDataRef.current['5m'].length,
                            '1m': accumulatedDataRef.current['1m'].length
                        });
                        
                        // Create updatedData with all accumulated data
                        const updatedData = {};
                        for (const tf in accumulatedDataRef.current) {
                            if (accumulatedDataRef.current[tf].length > 0) {
                                updatedData[tf] = [...accumulatedDataRef.current[tf]];
                                console.log(`Added ${updatedData[tf].length} historical candles for ${tf}`);
                            } else {
                                updatedData[tf] = [];
                            }
                        }
                        
                        // Add the new live candle to the appropriate timeframe
                        const existingIndex = updatedData[timeframe].findIndex(c => c.timestamp === candle.timestamp);
                        if (existingIndex >= 0) {
                            updatedData[timeframe][existingIndex] = candle;
                        } else {
                            updatedData[timeframe].push(candle);
                        }
                        
                        // Sort each timeframe's data by timestamp
                        for (const tf in updatedData) {
                            updatedData[tf].sort((a, b) => a.timestamp - b.timestamp);
                        }
                        
                        // Set state in a consistent order
                        isLiveModeRef.current = true;
                        setLoadingProgress('Transitioning to live data mode...');
                        setChartData(updatedData);
                        setDataLoaded(true);
                        setIsLiveMode(true);
                        
                        // Store the current candle so we can re-process it if needed
                        const firstLiveCandle = {...candle, timeframe};
                        
                        // Set a small timeout to ensure the firstLiveCandle will be processed 
                        // after the charts are initialized
                        setTimeout(() => {
                            // Re-process the first live candle to ensure it's properly rendered
                            if (dataSeriesRefs.current[timeframe]) {
                                console.log(`Re-processing first live candle for ${timeframe}`);
                                
                                // Check if this candle already exists in the chart data
                                const dataSeries = dataSeriesRefs.current[timeframe];
                                const count = dataSeries.count();
                                let candleExists = false;
                                
                                for (let i = 0; i < count; i++) {
                                    const existingTimestamp = dataSeries.getNativeXValues().get(i);
                                    if (existingTimestamp === firstLiveCandle.timestamp) {
                                        candleExists = true;
                                        break;
                                    }
                                }
                                
                                if (!candleExists) {
                                    handleLiveCandleUpdateCallback(firstLiveCandle, timeframe);
                                }
                            } else {
                                // If dataseries ref isn't ready yet, queue the candle
                                console.log(`Queueing first live candle for ${timeframe} for later processing`);
                                firstLiveCandle._isBoundaryCandle = true;
                                candleQueueRef.current[timeframe].push({ candle: firstLiveCandle });
                            }
                        }, 100);
                    } else {
                        // Already in live mode - process the candle
                        const dataSeries = dataSeriesRefs.current[timeframe];
                        if (dataSeries) {
                            // Chart is ready, process immediately
                            handleLiveCandleUpdateCallback(candle, timeframe);
                        } else {
                            // Chart not ready, queue the candle
                            console.warn(`Queueing live candle for ${timeframe} as chart is not ready yet.`);
                            candleQueueRef.current[timeframe].push({ candle });
                        }
                    }
                } else {
                    // Historical data handling
                    if (dataMode === 'Live') {
                        // In Live mode, we need to accumulate historical data and then set it all at once
                        console.log(`Accumulating historical data for ${timeframe} in Live mode`);
                        accumulatedDataRef.current[timeframe].push(candle);
                        setLoadingProgress(`Loading historical data: ${timeframe} (${accumulatedDataRef.current[timeframe].length} candles)`);
                        
                        // Use a debounced timer to set the data once we've received all candles
                        if (timeoutRef.current) {
                            clearTimeout(timeoutRef.current);
                        }
                        
                        timeoutRef.current = setTimeout(() => {
                            console.log('Timeout triggered: Processing historical data in Live mode');
                            
                            // Check if we've actually accumulated any data before proceeding
                            let totalCandles = 0;
                            for (const tf in accumulatedDataRef.current) {
                                totalCandles += accumulatedDataRef.current[tf].length;
                            }
                            
                            if (totalCandles > 0) {
                                setLoadingProgress('Processing historical data...');
                                const sortedData = {};
                                for (const tf in accumulatedDataRef.current) {
                                    sortedData[tf] = accumulatedDataRef.current[tf].sort(
                                        (a, b) => a.timestamp - b.timestamp
                                    );
                                    console.log(`Sorted ${sortedData[tf].length} historical candles for ${tf}`);
                                }
                                
                                // Process sessions if we have 1m data
                                if (sortedData['1m'] && sortedData['1m'].length > 0) {
                                    const sessionData = processSessionsFromCandles(sortedData['1m']);
                                    setSessions(sessionData);
                                    console.log(`Processed ${sessionData.length} trading sessions from historical data`);
                                }
                                
                                // Only set dataLoaded if we actually have data
                                setChartData(sortedData);
                                setDataLoaded(true);
                                console.log('Historical data processing complete in Live mode');
                            } else {
                                console.warn('No historical data accumulated to process');
                            }
                        }, 1000);
                    } else {
                        // In other modes, accumulate as normal
                        accumulatedDataRef.current[timeframe].push(candle);
                        setLoadingProgress(`Loading historical data: ${timeframe} (${accumulatedDataRef.current[timeframe].length} candles)`);

                        if (timeoutRef.current) {
                            clearTimeout(timeoutRef.current);
                        }
                        timeoutRef.current = setTimeout(() => {
                            setLoadingProgress('Processing historical data...');
                            const sortedData = {};
                            for (const tf in accumulatedDataRef.current) {
                                sortedData[tf] = accumulatedDataRef.current[tf].sort((a, b) => a.timestamp - b.timestamp);
                            }
                            
                            // Process sessions if we have 1m data
                            if (sortedData['1m'] && sortedData['1m'].length > 0) {
                                const sessionData = processSessionsFromCandles(sortedData['1m']);
                                setSessions(sessionData);
                                console.log(`Processed ${sessionData.length} trading sessions from historical data`);
                            }
                            
                            setChartData(sortedData);
                            setDataLoaded(true);
                            console.log('Historical data processing complete');
                        }, 1000);
                    }
                }
            }
        };

        websocket.onerror = (err) => {
            console.error('WebSocket error:', err);
        };

        websocket.onclose = () => {
            console.log('WebSocket closed');
            setIsConnected(false);
            setWs(null);
            setLoading(false);
            
            // Reset the annotations processing state
            initialAnnotationsProcessedRef.current = false;
            
            // Reset data flow started flag when WebSocket closes
            dataFlowStartedRef.current = false;
            
            // Clear any queued candles to prevent stale data
            for (const timeframe in candleQueueRef.current) {
                if (candleQueueRef.current[timeframe].length > 0) {
                    console.log(`Clearing ${candleQueueRef.current[timeframe].length} queued candles for ${timeframe}`);
                    candleQueueRef.current[timeframe] = [];
                }
            }
        };
    };

    useEffect(() => {
        if (settingsLoaded && dataLoaded) {
            setLoadingProgress('Finalizing initialization...');
            setLoading(false);
        }
    }, [settingsLoaded, dataLoaded]);

    // Add this new useEffect to monitor isLiveMode
    useEffect(() => {
        console.log('isLiveMode changed to:', isLiveMode);
    }, [isLiveMode]);

    // Add useEffect to fetch strategies when Strategy Manager is opened
    useEffect(() => {
        if (showStrategyManager && ws) {
            console.log('Strategy Manager opened, fetching latest strategies');
            ws.send(JSON.stringify({
                action: 'get_strat'
            }));
        }
    }, [showStrategyManager, ws]);

    const handleMouseDown = (direction, dividerIndex = 0) => (downEvent) => {
        downEvent.preventDefault();
        const startY = downEvent.clientY;
        const startX = downEvent.clientX;

        const handleMouseMove = (moveEvent) => {
            if (direction === 'horizontal') {
                const newRatio = (moveEvent.clientY / windowSize.height) * 100;
                setRowSplitRatio(Math.max(0, Math.min(100, newRatio)));
            } else if (direction === 'vertical') {
                if (chartLayout === '4-way' || dividerIndex === 0) {
                    // First divider in either layout
                    const newRatio = (moveEvent.clientX / windowSize.width) * 100;
                    setColumnSplitRatio(Math.max(0, Math.min(100, newRatio)));
                    
                    if (chartLayout === '6-way' || chartLayout === '6-way-long') {
                        // Also update the first element in columnSplitRatios for both 6-way layouts
                        setColumnSplitRatios([
                            Math.max(0, Math.min(columnSplitRatios[1] - 10, newRatio)),
                            columnSplitRatios[1]
                        ]);
                    }
                } else if (dividerIndex === 1) {
                    // Second divider in 6-way layout
                    const newRatio = (moveEvent.clientX / windowSize.width) * 100;
                    setColumnSplitRatios([
                        columnSplitRatios[0],
                        Math.max(columnSplitRatios[0] + 10, Math.min(100, newRatio))
                    ]);
                }
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleLineOrientationChange = (event) => setLineOrientation(event.target.value);

    // Function to clear existing strategy annotations for a specific strategy ID
    const clearStrategyAnnotations = useCallback((strategyId) => {
        console.log(`Clearing annotations for strategy: ${strategyId}`);
        
        // Use current timeframes based on layout
        const currentTimeframes = chartLayout === '4-way' ? fourWayTimeframes : 
                                chartLayout === '6-way-long' ? sixWayLongTimeframes : sixWayTimeframes;
        
        // For each timeframe, find and remove annotations for this strategy
        currentTimeframes.forEach(timeframe => {
            const sciChartSurface = sciChartSurfaceRefs.current[timeframe];
            if (!sciChartSurface) return;
            
            // Get all annotations
            const annotations = sciChartSurface.annotations;
            const toRemove = [];
            
            // Find annotations with IDs starting with the strategy ID
            for (let i = 0; i < annotations.size(); i++) {
                const anno = annotations.get(i);
                if (anno.id && anno.id.startsWith(strategyId)) {
                    toRemove.push(anno);
                }
            }
            
            // Remove the collected annotations
            if (toRemove.length > 0) {
                console.log(`Removing ${toRemove.length} annotations for strategy ${strategyId} from ${timeframe} chart`);
                toRemove.forEach(anno => {
                    annotations.remove(anno);
                    // Call delete() method on annotation if it exists to free WebGL resources
                    if (typeof anno.delete === 'function') {
                        try {
                            anno.delete();
                        } catch (error) {
                            console.warn(`Error calling delete() on annotation: ${error.message}`);
                        }
                    }
                });
                
                // Redraw the chart
                sciChartSurface.invalidateElement();
            }
        });
        
        // Update annotation counts after clearing
        countStrategyAnnotations();
    }, [chartLayout]);

    // Helper function to format a timestamp in MM/DD hh:mm format
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${month}/${day} ${hours}:${minutes}`;
    };

    // Helper function to get default datetime values for Replay mode in Eastern Time
    const getDefaultDateTimes = () => {
        // Get current date in Eastern Time
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const easternNow = new Date(formatter.format(now).replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+)/, '$3-$1-$2T$4:$5'));
        
        // Get previous trading day
        const prevTradingDayDate = new Date(easternNow);
        // Go back one day
        prevTradingDayDate.setDate(easternNow.getDate() - 1);
        // If it's a weekend, go back to Friday
        const dayOfWeek = prevTradingDayDate.getDay(); // 0 = Sunday, 6 = Saturday
        if (dayOfWeek === 0) { // Sunday, go back 2 more days to Friday
            prevTradingDayDate.setDate(prevTradingDayDate.getDate() - 2);
        } else if (dayOfWeek === 6) { // Saturday, go back 1 more day to Friday
            prevTradingDayDate.setDate(prevTradingDayDate.getDate() - 1);
        }
        
        // Explicitly set times for live start and end
        // Live Start: 8:00 AM on previous trading day
        const liveStartDate = new Date(prevTradingDayDate);
        liveStartDate.setHours(8, 0, 0, 0);
        // Format to yyyy-mm-ddT08:00
        const liveStartStr = `${liveStartDate.toISOString().split('T')[0]}T08:00`;
        
        // Live End: 4:00 PM (16:00) on previous trading day
        const liveEndDate = new Date(prevTradingDayDate);
        liveEndDate.setHours(16, 0, 0, 0);
        // Format to yyyy-mm-ddT16:00
        const liveEndStr = `${liveEndDate.toISOString().split('T')[0]}T16:00`;
        
        // History Start: exactly 24 hours before Live Start
        const historyStartDate = new Date(liveStartDate);
        historyStartDate.setDate(historyStartDate.getDate() - 1);
        const historyStartStr = historyStartDate.toISOString().slice(0, 16); // Format to yyyy-mm-ddThh:mm
        
        return { historyStartStr, liveStartStr, liveEndStr };
    };

    // Helper function to convert Eastern Time datetime-local input to UTC timestamp
    const convertToUTCTimestamp = (easternDateTimeStr) => {
        // Parse the date string (format: yyyy-mm-ddThh:mm)
        const [datePart, timePart] = easternDateTimeStr.split('T');
        const [year, month, day] = datePart.split('-');
        const [hour, minute] = timePart.split(':');
        
        // Create Date object with Eastern Time zone offset
        const date = new Date();
        date.setFullYear(parseInt(year));
        date.setMonth(parseInt(month) - 1); // Month is 0-indexed
        date.setDate(parseInt(day));
        date.setHours(parseInt(hour));
        date.setMinutes(parseInt(minute));
        date.setSeconds(0);
        date.setMilliseconds(0);
        
        // Set time zone to Eastern Time
        const easternDate = new Date(
            date.toLocaleString('en-US', { timeZone: 'America/New_York' })
        );
        
        // Convert to UTC timestamp (milliseconds since epoch)
        const utcTimestamp = date.getTime() - (easternDate.getTime() - date.getTime());
        
        // Return timestamp in milliseconds (don't convert to seconds)
        return utcTimestamp;
    };

    // Modify the useEffect to initialize date values on both initial load and when data mode changes
    useEffect(() => {
        if (dataMode === 'Replay') {
            // Only set default values if the fields are empty
            if (!historyStart || !liveStart || !liveEnd) {
                console.log('Setting default date-time values for Replay mode');
                const { historyStartStr, liveStartStr, liveEndStr } = getDefaultDateTimes();
                setHistoryStart(historyStartStr);
                setLiveStart(liveStartStr);
                setLiveEnd(liveEndStr);
            }
            setCurrentReplayInterval(replayInterval);
            setIntervalInputValue(replayInterval.toString());
        }
    }, [dataMode, replayInterval]); // Removed historyStart, liveStart, liveEnd from dependencies

    // Add another useEffect to initialize date fields on component mount
    useEffect(() => {
        // Initialize date fields ONLY on first component mount when dataMode is Replay
        if (dataMode === 'Replay' && !historyStart && !liveStart && !liveEnd) {
            const { historyStartStr, liveStartStr, liveEndStr } = getDefaultDateTimes();
            console.log('Initial setup of date-time fields:', {
                historyStart: historyStartStr,
                liveStart: liveStartStr,
                liveEnd: liveEndStr
            });
            setHistoryStart(historyStartStr);
            setLiveStart(liveStartStr);
            setLiveEnd(liveEndStr);
            setCurrentReplayInterval(replayInterval);
            setIntervalInputValue(replayInterval.toString());
        }
    }, []); // Empty dependency array means this runs once on mount

    // Add function to handle pause/resume button click
    const handleReplayPauseToggle = () => {
        const newPausedState = !replayPaused;
        setReplayPaused(newPausedState);
        
        // Send message to server
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                action: "modify_replay",
                pause: newPausedState
            }));
            console.log(`Sending replay ${newPausedState ? 'pause' : 'resume'} command`);
        } else {
            console.error('WebSocket not connected, cannot send pause/resume command');
        }
        
        // Blur the button to remove focus
        document.activeElement.blur();
    };

    // Add function to handle stop button click
    const handleReplayStop = () => {
        // Send message to server
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                action: "stop_replay"
            }));
            console.log("Sending replay stop command");
            setReplayEnded(true);
        } else {
            console.error('WebSocket not connected, cannot send stop command');
        }
        
        // Blur the button to remove focus
        document.activeElement.blur();
    };

    // Add function to handle interval change
    const handleIntervalChange = (event) => {
        setIntervalInputValue(event.target.value);
    };

    // Modify the handleIntervalSubmit function to blur the input after pressing Enter
    const handleIntervalSubmit = (event) => {
        if (event.key === 'Enter') {
            const newInterval = parseInt(intervalInputValue, 10);
            if (!isNaN(newInterval) && newInterval > 0) {
                // Update the current interval
                setCurrentReplayInterval(newInterval);
                
                // Send message to server
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        action: "modify_replay",
                        replay_interval: newInterval
                    }));
                    console.log(`Sending replay interval update: ${newInterval}ms`);
                } else {
                    console.error('WebSocket not connected, cannot update interval');
                }
                
                // Blur the input to remove focus
                event.target.blur();
            }
        }
    };

    // Add resetQuatrain function after handleIntervalSubmit
    const resetQuatrain = useCallback(() => {
        console.log('Resetting Quatrain application...');
        
        // First, explicitly send candle-data-reset to ensure external clients get "sync ended" message
        try {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('candle-data-reset');
            console.log('Sent candle-data-reset to main process');
        } catch (error) {
            console.error('Error sending candle-data-reset:', error);
        }
        
        // Reset data flow started flag immediately
        dataFlowStartedRef.current = false;
        
        // Wait a moment for the candle forwarding reset to complete before closing WebSocket
        setTimeout(() => {
            console.log('Proceeding with WebSocket closure and state reset...');
            
            // Close WebSocket if it's open
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
            
            // Reset all state variables to initial values
            setIsConnected(false);
            setWs(null);
            setLoading(false);
            setDataLoaded(false);
            setSettingsLoaded(false);
            setChartData({
                '1d': [],
                '4h': [],
                '1h': [],
                '30m': [],
                '15m': [],
                '10m': [],
                '5m': [],
                '1m': [],
            });
            
            // Clear references
            accumulatedDataRef.current = {
                '1d': [],
                '4h': [],
                '1h': [],
                '30m': [],
                '15m': [],
                '10m': [],
                '5m': [],
                '1m': [],
            };

            // Reset annotations processing state
            initialAnnotationsProcessedRef.current = false;
            
            // Reset external client sync notification
            setShowExternalClientSyncNotification(false);

            // IMPORTANT: Clear the processed gaps cache so that gaps will be detected again
            if (processedGapTimestampsRef.current) {
                processedGapTimestampsRef.current.clear();
                console.log('Cleared session gap cache');
            }
            
            setIsLiveMode(false);
            setReplayPaused(false);
            setReplayEnded(false);
            setIsReplayMode(false);
            
            // Clear annotations
            setAnnotations([]);
            setStratAnnotations([]);
            setPendingStrategyAnnotations([]);
            
            // Clear internal strategy annotations
            internalStrategyAnnotations.removeAllAnnotations();
            
            // Clear session labels annotations
            sessionLabelsAnnotations.removeAllSessionBoxes();
            
            // Clear killzones annotations
            killzonesAnnotations.destroy();
            
            // Clear ICT price lines annotations
            ictPriceLinesAnnotations.removeAllAnnotations();
            
            // Clear opening gaps annotations - DISABLED - Converted to User Study
            // openingGapsAnnotations.destroy();
            
            // Clear user studies (if enabled)
            if (ENABLE_USER_STUDIES && UserStudyManager) {
                UserStudyManager.destroyAllStudies();
            }
            
            // Reset chart surfaces
            const currentTimeframes = chartLayout === '4-way' ? fourWayTimeframes : 
                                    chartLayout === '6-way-long' ? sixWayLongTimeframes : sixWayTimeframes;
            for (const timeframe of currentTimeframes) {
                if (sciChartSurfaceRefs.current[timeframe]) {
                    // Clear any annotations on the charts
                    const chartSurface = sciChartSurfaceRefs.current[timeframe];
                    if (chartSurface && chartSurface.annotations) {
                        // IMPORTANT: Get all annotations and delete them properly to free WebGL resources
                        const annotations = chartSurface.annotations;
                        const toDelete = [];
                        
                        // Collect all annotations first
                        for (let i = 0; i < annotations.size(); i++) {
                            toDelete.push(annotations.get(i));
                        }
                        
                        // Delete each annotation properly to free WebGL memory
                        console.log(`[RESET] Deleting ${toDelete.length} annotations on ${timeframe} chart`);
                        toDelete.forEach(anno => {
                            if (typeof anno.delete === 'function') {
                                try {
                                    anno.delete();
                                } catch (error) {
                                    console.warn(`[RESET] Error calling delete() on annotation: ${error.message}`);
                                }
                            }
                        });
                        
                        // Now clear the collection
                        chartSurface.annotations.clear();
                    }
                    
                    // Reset chart references
                    sciChartSurfaceRefs.current[timeframe] = null;
                    dataSeriesRefs.current[timeframe] = null;
                    lastPriceLineRefs.current[timeframe] = null;
                }
            }
            
            // Reset initialization state
            setInitialized(false);
            initialLoadCompleteRef.current = false;
            
            console.log('App state reset to initial startup');
        }, 250); // Give 250ms for the candle forwarding reset to complete
    }, [ws, chartLayout]); // Restored ws dependency

    // Switch instrument handler
    const handleSwitchInstrument = useCallback((newInstrument) => {
        console.log('App.js: Switching instrument to:', newInstrument);
        
        // Update the instrument state
        setInstrument(newInstrument);
        
        // Call resetQuatrain to clean up current state
        resetQuatrain();
        
        // After reset completes, connect with the new instrument
        setTimeout(() => {
            console.log('App.js: Connecting with new instrument after reset:', newInstrument);
            connect(newInstrument);
        }, 300); // Give slightly more time than reset's 250ms delay
    }, [resetQuatrain]); // Removed 'connect' to avoid circular reference issues

    // Add a useEffect to listen for reset-quatrain event from Electron
    useEffect(() => {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.on('reset-quatrain', resetQuatrain);
        
        return () => {
            ipcRenderer.removeAllListeners('reset-quatrain');
        };
    }, [resetQuatrain]);

    // Add a useEffect to listen for switch-instrument event from Electron
    useEffect(() => {
        const { ipcRenderer } = window.require('electron');
        
        const switchInstrumentHandler = (event, newInstrument) => {
            console.log('App.js: Received switch-instrument IPC message:', newInstrument);
            handleSwitchInstrument(String(newInstrument)); // Ensure it's a string
        };
        
        ipcRenderer.on('switch-instrument', switchInstrumentHandler);
        
        return () => {
            ipcRenderer.removeListener('switch-instrument', switchInstrumentHandler);
        };
    }, [handleSwitchInstrument]);

    // Function to handle crosshair movement and synchronize across all charts
    const handleCrosshairMove = useCallback((timeframe, timestamp, price) => {
        if (!isCrosshairMode) return;
        
        console.log(`DIAGNOSTIC: handleCrosshairMove called from ${timeframe} with timestamp=${timestamp} and price=${price}`);
        
        // Parse the source timeframe value to get duration in minutes
        const sourceTimeframeMinutes = parseTimeframeToMinutes(timeframe);
        
        // Get current timeframes based on layout
        const currentTimeframes = chartLayout === '4-way' ? fourWayTimeframes : 
                                chartLayout === '6-way-long' ? sixWayLongTimeframes : sixWayTimeframes;
        
        // Loop through all timeframes and update their crosshairs
        for (const tf of currentTimeframes) {
            // Skip the source chart that triggered the event
            if (tf === timeframe) continue;
            
            const sciChartSurface = sciChartSurfaceRefs.current[tf];
            if (!sciChartSurface || !sciChartSurface.updateCrosshair) continue;
            
            // Map the timestamp to an appropriate value for each timeframe
            let mappedTimestamp = timestamp;
            
            // Parse the target timeframe value to get duration in minutes
            const targetTimeframeMinutes = parseTimeframeToMinutes(tf);
            
            // If target timeframe is higher than source timeframe (e.g., 5m > 1m)
            if (targetTimeframeMinutes > sourceTimeframeMinutes) {
                // Calculate the start of the containing candle in the higher timeframe
                const date = new Date(timestamp);
                
                // Calculate minutes since the start of the day
                const minutesSinceDayStart = date.getUTCHours() * 60 + date.getUTCMinutes();
                
                // Calculate which candle bucket this timestamp falls into
                const targetCandleIndex = Math.floor(minutesSinceDayStart / targetTimeframeMinutes);
                
                // Calculate the start time of that candle
                const targetCandleStartMinutes = targetCandleIndex * targetTimeframeMinutes;
                const targetHours = Math.floor(targetCandleStartMinutes / 60);
                const targetMinutes = targetCandleStartMinutes % 60;
                
                // Create a new date with the same day but with the calculated hours and minutes
                const mappedDate = new Date(date);
                mappedDate.setUTCHours(targetHours, targetMinutes, 0, 0);
                
                // Convert back to timestamp
                mappedTimestamp = mappedDate.getTime();
                
                // Try to find the exact candle in the data
                if (chartData[tf] && chartData[tf].length > 0) {
                    // Find the exact candle with this start time if it exists
                    const exactCandle = chartData[tf].find(candle => 
                        Math.abs(candle.timestamp - mappedTimestamp) < 1000 // Allow 1 second tolerance
                    );
                    
                    if (exactCandle) {
                        mappedTimestamp = exactCandle.timestamp;
                    } else {
                        // If exact candle not found, find the closest one as fallback
                        let closestCandle = null;
                        let minDistance = Number.MAX_VALUE;
                        
                        for (const candle of chartData[tf]) {
                            const distance = Math.abs(candle.timestamp - mappedTimestamp);
                            if (distance < minDistance) {
                                minDistance = distance;
                                closestCandle = candle;
                            }
                        }
                        
                        if (closestCandle) {
                            mappedTimestamp = closestCandle.timestamp;
                        }
                    }
                }
            } else if (targetTimeframeMinutes < sourceTimeframeMinutes) {
                // For lower timeframes, keep using the closest candle approach
                if (chartData[tf] && chartData[tf].length > 0) {
                    let closestCandle = null;
                    let minDistance = Number.MAX_VALUE;
                    
                    for (const candle of chartData[tf]) {
                        const distance = Math.abs(candle.timestamp - timestamp);
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestCandle = candle;
                        }
                    }
                    
                    if (closestCandle) {
                        mappedTimestamp = closestCandle.timestamp;
                    }
                }
            }
            
            console.log(`DIAGNOSTIC: Updating crosshair in ${tf} chart with mappedTimestamp=${mappedTimestamp}`);
            
            // Update the crosshair on this chart
            sciChartSurface.updateCrosshair(mappedTimestamp, price);
        }
    }, [isCrosshairMode, chartData, chartLayout]);

    // Helper function to parse timeframe string to minutes
    const parseTimeframeToMinutes = (timeframe) => {
        if (timeframe.endsWith('m')) {
            // For minute-based timeframes (1m, 5m, 15m, etc.)
            return parseInt(timeframe.slice(0, -1));
        } else if (timeframe.endsWith('h')) {
            // For hour-based timeframes (1h, 4h, etc.)
            return parseInt(timeframe.slice(0, -1)) * 60;
        } else if (timeframe.endsWith('d')) {
            // For day-based timeframes (1d, etc.)
            return parseInt(timeframe.slice(0, -1)) * 60 * 24;
        }
        // Default to 1 minute if format not recognized
        return 1;
    };

    // Session processing function - separate so it can be reused
    const processSessionsFromCandles = useCallback((candleData) => {
        if (!candleData || candleData.length === 0) return [];
        
        // Sort candles by timestamp (ascending)
        const sortedCandles = [...candleData].sort((a, b) => a.timestamp - b.timestamp);
        
        const updatedSessions = [];
        let currentSessionStart = sortedCandles[0].timestamp;
        let loggedGaps = new Set(); // Track which gaps we've already logged
        
        // Iterate through candles to find gaps (session breaks)
        for (let i = 1; i < sortedCandles.length; i++) {
            const prevCandle = sortedCandles[i-1];
            const currCandle = sortedCandles[i];
            
            // Check for a gap of SESSION_GAP_MINUTES or more
            const timeDiff = currCandle.timestamp - prevCandle.timestamp;
            const oneMinuteInMs = 60 * 1000; // 1 minute in milliseconds
            const sessionGapMs = SESSION_GAP_MINUTES * oneMinuteInMs;
            
            // Log key information about candles with significant gaps, but only once per gap
            const gapId = `${prevCandle.timestamp}-${currCandle.timestamp}`;
            if (timeDiff >= 30 * oneMinuteInMs && !loggedGaps.has(gapId)) {
                loggedGaps.add(gapId);
                console.log(`[DEBUG-BULK] Gap found: ${timeDiff/oneMinuteInMs} min, Previous: ${new Date(prevCandle.timestamp).toLocaleTimeString()}, Current: ${new Date(currCandle.timestamp).toLocaleTimeString()}, SessionGapThreshold: ${SESSION_GAP_MINUTES} min`);
            }
            
            if (timeDiff > sessionGapMs) {
                // We found a gap, so the previous session ends here
                const sessionEnd = prevCandle.timestamp + oneMinuteInMs;
                
                // Add this completed session
                updatedSessions.push({
                    startTime: currentSessionStart,
                    endTime: sessionEnd
                });
                
                // Start a new session with the current candle
                currentSessionStart = currCandle.timestamp;
                if (!loggedGaps.has(`new-${gapId}`)) {
                    loggedGaps.add(`new-${gapId}`);
                    console.log(`[SESSION-BULK] New session started at ${new Date(currentSessionStart).toLocaleTimeString()} after gap of ${timeDiff/oneMinuteInMs} min`);
                }
            }
        }
        
        // Add the current active session
        updatedSessions.push({
            startTime: currentSessionStart,
            endTime: null // Still active
        });
        
        // Return sessions in reverse chronological order (newest first)
        // with relative numbers (0, -1, -2, etc.)
        return updatedSessions.reverse().map((session, index) => ({
            ...session,
            relativeNumber: -1 * index
        }));
    }, []);
    
    // Setup IPC listener for chart click orders
    useEffect(() => {
        try {
            const { ipcRenderer } = window.require('electron');
            
            // Listen for display-chart-click-overlay message
            const displayChartClickOverlayHandler = (event, orderData) => {
                console.log('App: Received display-chart-click-overlay message:', orderData);
                setChartClickOrderData(orderData);
                setIsChartClickOrderMode(true);
            };
            
            // Listen for nt-bridge-send-response to get feedback on order submission
            const ntBridgeSendResponseHandler = (event, response) => {
                console.log('App: Received nt-bridge-send-response:', response);
                
                // Only handle responses related to chart click order placement
                if (response.originalMessage && response.originalMessage.type === 'place_order') {
                    if (response.success) {
                        console.log('App: Order was successfully sent to NinjaTrader Bridge');
                    } else {
                        console.error('App: Failed to send order to NinjaTrader Bridge:', response.error);
                        
                        // Show an error message to the user (you'd need to implement this)
                        // For now, we'll just log to console
                        console.error('ERROR: Order could not be sent. Please check NinjaTrader connection.');
                        
                        // Exit chart click order mode anyway since we got a response
                        setIsChartClickOrderMode(false);
                        setChartClickOrderData(null);
                    }
                }
            };
            
            ipcRenderer.on('display-chart-click-overlay', displayChartClickOverlayHandler);
            ipcRenderer.on('nt-bridge-send-response', ntBridgeSendResponseHandler);
            
            // Cleanup function
            return () => {
                ipcRenderer.removeListener('display-chart-click-overlay', displayChartClickOverlayHandler);
                ipcRenderer.removeListener('nt-bridge-send-response', ntBridgeSendResponseHandler);
            };
        } catch (error) {
            console.error('App: Error setting up chart click order IPC listeners:', error);
        }
    }, []);
    
    // Add handler for chart click when in chart click order mode
    useEffect(() => {
        if (!isChartClickOrderMode || !chartClickOrderData) return;
        
        // When in chart click order mode, we need to handle clicks on chart surfaces
        const handleChartClick = (event) => {
            // Find which chart was clicked
            const targetElement = event.target;
            let chartElement = null;
            let chartTimeframe = null;
            
            // Find the closest chart container
            const chartContainers = document.querySelectorAll('[id^="chart-"]');
            for (const container of chartContainers) {
                if (container.contains(targetElement)) {
                    chartElement = container;
                    // Extract timeframe from the ID (e.g., "chart-1h-container")
                    const match = container.id.match(/chart-(\w+)-container/);
                    if (match && match[1]) {
                        chartTimeframe = match[1];
                    }
                    break;
                }
            }
            
            if (!chartElement || !chartTimeframe) {
                console.log('App: Click was not on a chart or timeframe not found');
                return;
            }
            
            // Get SciChartSurface for the clicked chart
            const sciChartSurface = sciChartSurfaceRefs.current[chartTimeframe];
            if (!sciChartSurface) {
                console.error(`App: SciChart surface not found for timeframe ${chartTimeframe}`);
                return;
            }
            
            // Get chart coordinates at click position
            const rect = chartElement.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // Add cursor offsets - crucial for accurate position
            // These offsets align the click point with the actual data position on the chart
            const cursorOffsetX = 10; // Standard offset used in other chart operations
            const cursorOffsetY = 10; // Standard offset used in other chart operations
            const adjustedMouseX = mouseX - cursorOffsetX;
            const adjustedMouseY = mouseY - cursorOffsetY; // This effectively adds 10px, moving UP on the chart

            // Get data coordinates from pixel coordinates
            const xAxis = sciChartSurface.xAxes.get(0);
            const yAxis = sciChartSurface.yAxes.get(0);

            if (!xAxis || !yAxis) {
                console.error('App: Could not get axes from SciChart surface');
                return;
            }

            const xCoord = xAxis.getCurrentCoordinateCalculator();
            const yCoord = yAxis.getCurrentCoordinateCalculator();

            // Get data values at adjusted mouse position
            const xValue = xCoord.getDataValue(adjustedMouseX);
            const yValue = yCoord.getDataValue(adjustedMouseY);

            console.log(`App: Chart clicked at data coordinates: x=${xValue}, y=${yValue}`);

            // Create order with Y value as price
            const price = yValue; // Y coordinate is the price
            
            try {
                const { ipcRenderer } = window.require('electron');
                
                // IMPORTANT: The main WebSocket (ws) connects to the data service at port 8080
                // But NinjaTrader Bridge is at port 8079, so we need to use IPC to route through main process
                
                // Create the order object - ensure format matches what TradeWindow uses
                const order = {
                    type: 'place_order',
                    action: chartClickOrderData.action, // 'BUY' or 'SELL'
                    orderType: chartClickOrderData.orderType || 'LIMIT', // Use provided orderType or default to LIMIT
                    accountId: chartClickOrderData.accountId,
                    symbol: chartClickOrderData.symbol,
                    quantity: chartClickOrderData.quantity,
                    timestamp: Date.now()
                };
                
                // Set the appropriate price properties based on order type
                if (order.orderType === 'LIMIT' || !order.orderType) {
                    order.limitPrice = price;
                } else if (order.orderType === 'LIMITSTOP') {
                    order.stopPrice = price;
                    order.limitPrice = price; // For StopLimit, NT requires both stop and limit prices
                } else if (order.orderType === 'MARKETSTOP') {
                    order.stopPrice = price;
                }
                
                console.log(`App: Sending chart click ${order.orderType} order to NT Bridge via IPC:`, order);
                
                // Send via IPC to main process which has the NT Bridge connection
                ipcRenderer.send('nt-bridge-send', order);
                
                // Notify main process that order was completed (for UI feedback)
                ipcRenderer.send('chart-click-order-completed', {
                    ...chartClickOrderData,
                    orderType: order.orderType,
                    price: price  // Generic price field for feedback
                });
                
                // Exit chart click order mode
                setIsChartClickOrderMode(false);
                setChartClickOrderData(null);
                
            } catch (error) {
                console.error('App: Error sending chart click order:', error);
            }
        };
        
        // Add click event listener to the entire document
        document.addEventListener('click', handleChartClick);
        
        // Cleanup function
        return () => {
            document.removeEventListener('click', handleChartClick);
        };
    }, [isChartClickOrderMode, chartClickOrderData]);
    
    // Function to cancel chart click order
    const handleCancelChartClickOrder = useCallback(() => {
        setIsChartClickOrderMode(false);
        setChartClickOrderData(null);
        
        try {
            const { ipcRenderer } = window.require('electron');
            // Notify main process that order was canceled
            ipcRenderer.send('cancel-chart-click-order');
        } catch (error) {
            console.error('App: Error sending cancel-chart-click-order:', error);
        }
    }, []);

    // Ref to store gaps we've already processed
    const processedGapTimestampsRef = useRef(new Set());
    
    // Update internal strategy annotations when chart data or sessions change
    useEffect(() => {
        console.log('[USER-STUDIES] 🔄 App.js data update useEffect triggered');
        console.log('[USER-STUDIES] 📊 Initialized:', initialized);
        console.log('[USER-STUDIES] 📊 Chart data 1m length:', chartData['1m']?.length || 0);
        console.log('[USER-STUDIES] 📊 Sessions length:', sessions.length);
        
        if (initialized && (chartData['1m'] || sessions.length > 0)) {
            console.log('[USER-STUDIES] ✅ Calling internal annotations and UserStudyManager.updateAllStudies');
            internalStrategyAnnotations.updateData(chartData, sessions);
            sessionLabelsAnnotations.updateData(chartData, sessions);
            
            // Update user studies with new data (if enabled)
            if (ENABLE_USER_STUDIES && UserStudyManager) {
                UserStudyManager.updateAllStudies(chartData, sessions);
            }
        } else {
            console.log('[USER-STUDIES] ❌ Skipping updates - initialized:', initialized, 'has1mData:', !!chartData['1m'], 'hasSessions:', sessions.length > 0);
        }
    }, [chartData, sessions, initialized]);

    // Add useEffect to monitor significant changes in 1m data and recalculate sessions
    useEffect(() => {
        // Only proceed if we have 1m data and it's not initial load
        if (chartData['1m'] && chartData['1m'].length > 0 && initialized) {
            // Look for sequences of candles that might include gap transitions
            const sorted1mCandles = [...chartData['1m']].sort((a, b) => a.timestamp - b.timestamp);
            let hasNewGap = false;
            let gapStartTime = 0;
            let gapEndTime = 0;
            
            // Check for significant gaps in the data
            for (let i = 1; i < sorted1mCandles.length; i++) {
                const prevTimestamp = sorted1mCandles[i-1].timestamp;
                const currTimestamp = sorted1mCandles[i].timestamp;
                const timeDiff = currTimestamp - prevTimestamp;
                
                // Check if this is a session gap and we haven't processed it yet
                if (timeDiff >= SESSION_GAP_MINUTES * 60 * 1000) {
                    // Create a unique ID for this gap to avoid reprocessing
                    const gapId = `${prevTimestamp}-${currTimestamp}`;
                    
                    // If we haven't processed this specific gap before
                    if (!processedGapTimestampsRef.current.has(gapId)) {
                        hasNewGap = true;
                        gapStartTime = prevTimestamp;
                        gapEndTime = currTimestamp;
                        
                        // Add this gap to our processed set
                        processedGapTimestampsRef.current.add(gapId);
                        
                        console.log(`[SESSION-MONITOR] Found new session gap: ${timeDiff/(60*1000)} minutes between ${new Date(prevTimestamp).toLocaleTimeString()} and ${new Date(currTimestamp).toLocaleTimeString()}`);
                        break;
                    }
                }
            }
            
            // If we found a new gap, recalculate all sessions
            if (hasNewGap) {
                console.log('[SESSION-MONITOR] Recalculating sessions due to new gap');
                const newSessions = processSessionsFromCandles(sorted1mCandles);
                setSessions(newSessions);
            }
        }
    }, [chartData['1m'], initialized, processSessionsFromCandles]);

    // This useEffect is for general IPC listeners that should be set up once
    useEffect(() => {
        const { ipcRenderer } = window.require('electron');

        // Existing listeners like 'reset-quatrain', 'open-settings', etc.
        const handleResetQuatrain = () => resetQuatrain(); // Use our proper reset function
        const handleOpenSettings = () => setShowSettings(true);
        const handleOpenServerLog = () => setShowServerLog(true);
        const handleOpenAnnotationManager = () => setShowAnnotationManager(true);
        const handleOpenStrategyManager = () => setShowStrategyManager(true);
        const handleOpenIndicatorsStudies = () => setShowIndicatorsStudies(true);
        
        // Handle external client sync notification
        const handleExternalClientSynced = () => {
            setShowExternalClientSyncNotification(true);
            // Auto-hide after 10 seconds
            setTimeout(() => {
                setShowExternalClientSyncNotification(false);
            }, 10000);
        };

        ipcRenderer.on('reset-quatrain', handleResetQuatrain);
        ipcRenderer.on('open-settings', handleOpenSettings);
        ipcRenderer.on('open-server-log', handleOpenServerLog);
        ipcRenderer.on('open-annotation-manager', handleOpenAnnotationManager);
        ipcRenderer.on('open-strategy-manager', handleOpenStrategyManager);
        ipcRenderer.on('open-indicators-studies', handleOpenIndicatorsStudies);
        ipcRenderer.on('external-client-synced', handleExternalClientSynced);
        
        // Listeners for the new Chart Modify Order Overlay
        const handleShowModifyOrderOverlay = () => {
            console.log('App: Received show-modify-order-overlay');
            setShowChartModifyOrderOverlay(true);
        };
        const handleHideModifyOrderOverlay = () => {
            console.log('App: Received hide-modify-order-overlay');
            setShowChartModifyOrderOverlay(false);
        };

        ipcRenderer.on('show-modify-order-overlay', handleShowModifyOrderOverlay);
        ipcRenderer.on('hide-modify-order-overlay', handleHideModifyOrderOverlay);
        
        // Add listener for Trade Manager data requests
        const handleRequestDataForTradeManager = () => {
            // Get the current price from the latest data point of the smallest timeframe
            let currentPrice = 0;
            if (chartData['1m'] && chartData['1m'].length > 0) {
                currentPrice = chartData['1m'][chartData['1m'].length - 1].close;
            }
            
            console.log('Sending data to Trade Manager:', { instrument, currentPrice });
            
            // Send data to the Trade Manager window
            ipcRenderer.send('main-window-data', {
                instrument: instrument,
                currentPrice: currentPrice
            });
        };

        ipcRenderer.on('request-data-for-trade-manager', handleRequestDataForTradeManager);
        
        return () => {
            ipcRenderer.removeAllListeners('reset-quatrain');
            ipcRenderer.removeAllListeners('open-settings');
            ipcRenderer.removeAllListeners('open-server-log');
            ipcRenderer.removeAllListeners('open-annotation-manager');
            ipcRenderer.removeAllListeners('open-strategy-manager');
            if (ENABLE_USER_STUDIES) {
                ipcRenderer.removeAllListeners('open-user-studies');
            }
            ipcRenderer.removeAllListeners('open-indicators-studies');
            ipcRenderer.removeAllListeners('request-data-for-trade-manager');
            ipcRenderer.removeAllListeners('execute-trade');
            ipcRenderer.removeAllListeners('external-client-synced');
            
            // Remove new listeners for modify order overlay
            ipcRenderer.removeAllListeners('show-modify-order-overlay');
            ipcRenderer.removeAllListeners('hide-modify-order-overlay');
        };
    }, [chartData, clientId, instrument, resetQuatrain]); // Added resetQuatrain to dependencies

    // Function to count strategy annotations for all strategies
    const countStrategyAnnotations = useCallback(() => {
        const counts = {};
        
        // Use current timeframes based on layout
        const currentTimeframes = chartLayout === '4-way' ? fourWayTimeframes : 
                                chartLayout === '6-way-long' ? sixWayLongTimeframes : sixWayTimeframes;
        
        // For each timeframe, count annotations for each strategy
        currentTimeframes.forEach(timeframe => {
            const sciChartSurface = sciChartSurfaceRefs.current[timeframe];
            if (!sciChartSurface) return;
            
            // Get all annotations
            const annotations = sciChartSurface.annotations;
            
            // Count annotations for each strategy
            for (let i = 0; i < annotations.size(); i++) {
                const anno = annotations.get(i);
                if (anno.id) {
                    // Parse the ID to extract strategy clientid
                    const idParts = anno.id.split('/');
                    if (idParts.length >= 5) {
                        const strategyClientId = idParts[0];
                        
                        // Only count strategy annotations (those starting with strategy clientid)
                        if (strategyClientId.startsWith('strategy') || strategies.some(s => s.clientid === strategyClientId)) {
                            // Initialize count if it doesn't exist
                            if (!counts[strategyClientId]) {
                                counts[strategyClientId] = new Set();
                            }
                            
                            // Use unique ID (5th part) to ensure we don't double-count across timeframes
                            const uniqueId = idParts[4];
                            counts[strategyClientId].add(uniqueId);
                        }
                    }
                }
            }
        });
        
        // Convert Sets to counts
        const finalCounts = {};
        Object.keys(counts).forEach(strategyId => {
            finalCounts[strategyId] = counts[strategyId].size;
        });
        
        setStrategyAnnotationCounts(finalCounts);
        return finalCounts;
    }, [chartLayout, strategies]);

    // Update annotation counts when charts change or strategies change
    useEffect(() => {
        const interval = setInterval(() => {
            countStrategyAnnotations();
        }, 5000); // Update every 5 seconds
        
        // Initial count
        countStrategyAnnotations();
        
        return () => clearInterval(interval);
    }, [countStrategyAnnotations]);

    // Periodic annotation audit and memory management
    useEffect(() => {
        const memoryAuditInterval = setInterval(() => {
            try {
                const audit = auditAnnotations(sciChartSurfaceRefs, timeframes);
                
                // Log audit results if there are potential issues
                if (audit.duplicateIds.length > 0 || audit.orphanedAnnotations.length > 0) {
                    console.warn('Annotation audit found potential memory issues:', {
                        totalAnnotations: audit.totalAnnotations,
                        duplicates: audit.duplicateIds.length,
                        orphaned: audit.orphanedAnnotations.length,
                        estimatedMemoryKB: Math.round(audit.memoryUsageEstimate / 1024)
                    });
                    
                    // DISABLED: Auto-cleanup to prevent incorrect deletions
                    // if (audit.duplicateIds.length > 10 || audit.orphanedAnnotations.length > 5) {
                    //     console.log('Running automatic annotation cleanup...');
                    //     const cleanupResult = cleanupAnnotations(sciChartSurfaceRefs, timeframes);
                    //     console.log('Cleanup completed:', cleanupResult);
                    //     
                    //     // Update counts after cleanup
                    //     countStrategyAnnotations();
                    // }
                } else if (audit.totalAnnotations > 100) {
                    // Log summary for large annotation counts
                    console.log('Annotation audit summary:', {
                        totalAnnotations: audit.totalAnnotations,
                        byStrategy: audit.annotationsByStrategy,
                        estimatedMemoryKB: Math.round(audit.memoryUsageEstimate / 1024)
                    });
                }
            } catch (error) {
                console.error('Error during annotation audit:', error);
            }
        }, 30000); // Run audit every 30 seconds
        
        return () => clearInterval(memoryAuditInterval);
    }, [timeframes, countStrategyAnnotations]);

    if (!isConnected) {
        return (
            <ConnectionScreen
                clientId={clientId}
                setClientId={setClientId}
                instrument={instrument}
                setInstrument={setInstrument}
                historicalDays={historicalDays}
                setHistoricalDays={setHistoricalDays}
                dataMode={dataMode}
                setDataMode={setDataMode}
                chartLayout={chartLayout}
                setChartLayout={setChartLayout}
                historyStart={historyStart}
                setHistoryStart={setHistoryStart}
                liveStart={liveStart}
                setLiveStart={setLiveStart}
                liveEnd={liveEnd}
                setLiveEnd={setLiveEnd}
                replayInterval={replayInterval}
                setReplayInterval={setReplayInterval}
                connect={connect}
                backgroundImage={backgroundImage}
                showExternalClientSyncNotification={showExternalClientSyncNotification}
            />
        );
    }

    if (loading) {
        return <div style={{ 
            textAlign: 'center', 
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh', 
            color: 'white',
            backgroundColor: 'black',
            backgroundImage: `url(${loadingBackground})`, 
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
        }}>
            <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: '20px',
                borderRadius: '10px'
            }}>
                Loading data...
                <br />
                <br />
                <span style={{ fontSize: '0.9em', color: '#aaa' }}>{loadingProgress}</span>
            </div>
        </div>;
    }

    return (
        <div style={{ 
            width: '100vw', 
            height: '100vh', 
            display: 'flex', 
            flexDirection: 'column', 
            position: 'relative', 
            margin: 0, 
            padding: 0,
            overflow: 'hidden',
            boxSizing: 'border-box'
        }}>
            <FlyoutPanel
                isOpen={isFlyoutOpen}
                togglePanel={toggleFlyout}
                isCrosshairMode={isCrosshairMode}
                toggleCrosshairMode={toggleCrosshairMode}
                isDrawingLockMode={isDrawingLockMode}
                toggleDrawingLockMode={toggleDrawingLockMode}
                isLineMode={isLineMode}
                toggleLineMode={handleToggleLineMode}
                isBoxMode={isBoxMode}
                toggleBoxMode={handleToggleBoxMode}
                isTrendMode={isTrendMode}
                toggleTrendMode={handleToggleTrendMode}
                isArrowMode={isArrowMode}
                toggleArrowMode={handleToggleArrowMode}
                isTextMode={isTextMode}
                toggleTextMode={handleToggleTextMode}
            />
            
            {/* Drawings Locked Overlay */}
            {isDrawingLockMode && (
                <div className="drawings-locked-overlay">
                    Drawings Locked
                </div>
            )}
            
            {/* Add the Drawing Options Overlay */}
            <DrawingOptionsOverlay
                isLineMode={isLineMode}
                isTrendMode={isTrendMode}
                isBoxMode={isBoxMode}
                isArrowMode={isArrowMode}
                isTextMode={isTextMode}
                lineColor={lineColor}
                setLineColor={setLineColor}
                lineType={lineType}
                setLineType={setLineType}
                showLabel={showLabel}
                setShowLabel={setShowLabel}
                lineOrientation={lineOrientation}
                handleLineOrientationChange={handleLineOrientationChange}
                isAllTimeframes={isAllTimeframes}
                setIsAllTimeframes={setIsAllTimeframes}
                boxOpacity={boxOpacity}
                setBoxOpacity={setBoxOpacity}
                arrowDirection={arrowDirection}
                setArrowDirection={setArrowDirection}
                arrowSize={arrowSize}
                setArrowSize={setArrowSize}
                arrowStyle={arrowStyle}
                setArrowStyle={setArrowStyle}
                annotationText={annotationText}
                setAnnotationText={setAnnotationText}
                fontSize={fontSize}
                setFontSize={setFontSize}
                textAnchor={textAnchor}
                setTextAnchor={setTextAnchor}
            />
            
            <ChartLayout
                chartLayout={chartLayout}
                timeframes={timeframes}
                instrument={instrument}
                chartData={chartData}
                settings={settings}
                isCrosshairMode={isCrosshairMode}
                isLineMode={isLineMode}
                isBoxMode={isBoxMode}
                isTrendMode={isTrendMode}
                isArrowMode={isArrowMode}
                isTextMode={isTextMode}
                isDrawingLockMode={isDrawingLockMode}
                lineColor={lineColor}
                lineType={lineType}
                showLabel={showLabel}
                lineOrientation={lineOrientation}
                setIsLineMode={setIsLineMode}
                setIsBoxMode={setIsBoxMode}
                setIsTrendMode={setIsTrendMode}
                setIsArrowMode={setIsArrowMode}
                setIsTextMode={setIsTextMode}
                boxOpacity={boxOpacity}
                arrowDirection={arrowDirection}
                arrowSize={arrowSize}
                arrowStyle={arrowStyle}
                annotationText={annotationText}
                fontSize={fontSize}
                textAnchor={textAnchor}
                setDataSeriesRef={setDataSeriesRef}
                setLastPriceLineRef={setLastPriceLineRef}
                setSciChartSurfaceRef={setSciChartSurfaceRef}
                onAnnotationCreated={onAnnotationCreated}
                onAnnotationUpdated={onAnnotationUpdated}
                onAnnotationDeleted={onAnnotationDeleted}
                createAnnotationId={createAnnotationId}
                handleCrosshairMove={handleCrosshairMove}
                isLiveMode={isLiveMode}
                isReplayMode={isReplayMode}
                handleMouseDown={handleMouseDown}
                windowSize={windowSize}
                rowSplitRatio={rowSplitRatio}
                columnSplitRatio={columnSplitRatio}
                columnSplitRatios={columnSplitRatios}
            />
            
            {/* REPLAY label - only show in replay mode */}
            {isReplayMode && (
                <ReplayControls
                    replayEnded={replayEnded}
                    latestTimestamp={latestTimestamp}
                    formatTimestamp={formatTimestamp}
                    resetQuatrain={resetQuatrain}
                    intervalInputValue={intervalInputValue}
                    handleIntervalChange={handleIntervalChange}
                    handleIntervalSubmit={handleIntervalSubmit}
                    replayPaused={replayPaused}
                    handleReplayPauseToggle={handleReplayPauseToggle}
                    handleReplayStop={handleReplayStop}
                />
            )}
            
            {showSettings && (
                <Settings
                    onClose={() => setShowSettings(false)}
                    onApply={newSettings => {
                        setSettings(newSettings);
                        setShowSettings(false);
                    }}
                    settings={settings}
                    ws={ws}
                    clientId={`quatrain-${clientId}`}
                />
            )}
            
            {showServerLog && (
                <ServerLog
                    onClose={() => setShowServerLog(false)}
                    logs={serverLogs}
                />
            )}
            
            {showAnnotationManager && (
                <AnnotationManager
                    onClose={() => setShowAnnotationManager(false)}
                    annotations={annotations}
                    ws={ws}
                    clientId={clientId}
                    onDelete={deleteAnnotationByIds}
                    timeframes={timeframes}
                    sciChartSurfaceRefs={sciChartSurfaceRefs}
                />
            )}
            
            {showStrategyManager && (
                <StrategyManager
                    onClose={() => setShowStrategyManager(false)}
                    strategies={strategies}
                    ws={ws}
                    clientId={clientId}
                    instrument={instrument}
                    clearAndRefreshStrategy={clearStrategyAnnotations}
                    strategyAnnotationCounts={strategyAnnotationCounts}
                />
            )}
            
            {showIndicatorsStudies && (
                <IndicatorsStudies
                    onClose={() => setShowIndicatorsStudies(false)}
                    sessions={sessions}
                />
            )}

            {ENABLE_USER_STUDIES && showUserStudies && UserStudiesPanel && (
                <UserStudiesPanel
                    onClose={() => setShowUserStudies(false)}
                    sciChartSurface={sciChartSurfaceRefs.current}
                    timeframes={timeframes}
                    candles={chartData}
                    sessions={sessions}
                />
            )}

            {/* Add the TradeAnnotationManager component */}
            <TradeAnnotationManager 
                sciChartSurfaceRefs={sciChartSurfaceRefs}
                timeframes={timeframes}
                currentInstrument={instrument}
            />
            
            {isChartClickOrderMode && chartClickOrderData && (
                <ChartClickOrderOverlay
                    orderData={chartClickOrderData}
                    onCancel={handleCancelChartClickOrder}
                />
            )}
            
            {/* Conditionally render the Chart Modify Order Overlay */}
            {showChartModifyOrderOverlay && <ChartModifyOrderOverlay />}
            
            {/* External Client Sync Notification */}
            {showExternalClientSyncNotification && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    backgroundColor: 'rgba(0, 128, 0, 0.9)',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    fontSize: '14px',
                    zIndex: 10000,
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
                    animation: 'fadeIn 0.3s ease-in'
                }}>
                    External client sync'd
                </div>
            )}
        </div>
    );
}

export default App;
