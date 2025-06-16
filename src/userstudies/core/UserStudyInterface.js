/**
 * UserStudyInterface - Standardized interface for all user studies
 * This defines the required methods that every user study must implement
 */

/**
 * Base User Study Interface
 * All user studies must implement these methods
 */
export class UserStudyInterface {
    constructor() {
        // Default settings structure
        this.settings = {
            enabled: true
        };
        
        // Track annotations for cleanup
        this.annotations = [];
        
        // Chart references
        this.sciChartSurfaceRefs = null;
        this.timeframes = [];
        this.chartData = {};
        this.sessions = [];
    }

    /**
     * Initialize the study with chart references and data
     * Called once when Quatrain is ready to initialize the study
     * 
     * @param {Object} sciChartSurfaceRefs - Object containing SciChart surface references by timeframe
     * @param {Array} timeframes - Array of active timeframes (e.g., ['1m', '5m', '15m', '1h'])
     * @param {Object} chartData - Object containing candle data by timeframe
     * @param {Array} sessions - Array of trading session objects
     */
    initialize(sciChartSurfaceRefs, timeframes, chartData, sessions) {
        throw new Error('initialize() method must be implemented by user study');
    }

    /**
     * Update study with new data
     * Called whenever new data arrives (live mode) or when replay data changes
     * 
     * @param {Object} chartData - Updated candle data object by timeframe
     * @param {Array} sessions - Updated trading sessions array
     */
    updateData(chartData, sessions) {
        throw new Error('updateData() method must be implemented by user study');
    }

    /**
     * Clean up and destroy the study
     * Called when Quatrain is resetting or shutting down
     * Must clean up all annotations and resources
     */
    destroy() {
        throw new Error('destroy() method must be implemented by user study');
    }

    /**
     * Get current study settings
     * Returns current study settings object for UI initialization
     * 
     * @returns {Object} - Current settings object
     */
    getSettings() {
        throw new Error('getSettings() method must be implemented by user study');
    }

    /**
     * Update study settings
     * Called when user changes settings in the UI
     * Must apply changes and refresh annotations
     * 
     * @param {Object} newSettings - New settings to apply
     */
    updateSettings(newSettings) {
        throw new Error('updateSettings() method must be implemented by user study');
    }

    /**
     * Get UI configuration schema
     * Returns UI configuration schema for automatic UI generation
     * 
     * @returns {Object} - UI configuration object
     */
    getUIConfig() {
        throw new Error('getUIConfig() method must be implemented by user study');
    }
}

/**
 * UI Schema Types and Examples
 * These are the supported control types for dynamic UI generation
 */
export const UIControlTypes = {
    CHECKBOX: 'checkbox',
    COLOR: 'color',
    RANGE: 'range',
    NUMBER: 'number',
    SELECT: 'select',
    TIME: 'time',
    SECTION: 'section'
};

/**
 * Example UI Configuration Schema
 * This shows how to structure the getUIConfig() return value
 */
export const ExampleUIConfig = {
    id: 'exampleStudy',
    displayName: 'Example Study',
    description: 'An example study demonstrating the user study interface',
    category: 'examples',
    settingsSchema: [
        {
            type: 'section',
            title: 'Main Settings',
            key: 'main',
            controls: [
                {
                    key: 'enabled',
                    type: 'checkbox',
                    label: 'Enable Study',
                    tooltip: 'Turn the study on/off',
                    default: true
                },
                {
                    key: 'color',
                    type: 'color',
                    label: 'Line Color',
                    tooltip: 'Color for study lines and annotations',
                    default: '#FF0000'
                },
                {
                    key: 'period',
                    type: 'number',
                    label: 'Period',
                    suffix: 'bars',
                    min: 1,
                    max: 200,
                    tooltip: 'Number of bars to include in calculation',
                    default: 20
                },
                {
                    key: 'opacity',
                    type: 'range',
                    label: 'Opacity',
                    min: 0,
                    max: 1,
                    step: 0.1,
                    showPercentage: true,
                    tooltip: 'Transparency of annotations',
                    default: 0.8
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
                    tooltip: 'Style of the drawn lines',
                    default: 'solid'
                },
                {
                    key: 'startTime',
                    type: 'time',
                    label: 'Start Time',
                    tooltip: 'Time to start calculations',
                    default: '09:30'
                }
            ]
        },
        {
            type: 'section',
            title: 'Advanced Settings',
            key: 'advanced',
            controls: [
                {
                    key: 'showLabels',
                    type: 'checkbox',
                    label: 'Show Labels',
                    tooltip: 'Display value labels on annotations',
                    default: false
                },
                {
                    key: 'labelColor',
                    type: 'color',
                    label: 'Label Color',
                    tooltip: 'Color for annotation labels',
                    default: '#FFFFFF'
                }
            ]
        }
    ]
};

/**
 * Data Structures Documentation
 * These document the data structures passed to user studies
 */

/**
 * Chart Data Structure
 * @typedef {Object} ChartData
 * @property {Array} 1m - Array of 1-minute candles
 * @property {Array} 5m - Array of 5-minute candles  
 * @property {Array} 15m - Array of 15-minute candles
 * @property {Array} 1h - Array of 1-hour candles
 */

/**
 * Candle Structure
 * @typedef {Object} Candle
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {number} open - Opening price
 * @property {number} high - High price
 * @property {number} low - Low price
 * @property {number} close - Closing price
 * @property {number} volume - Volume
 */

/**
 * Session Structure
 * @typedef {Object} Session
 * @property {number} relativeNumber - Session number (0 = current, -1 = previous, etc.)
 * @property {number} startTime - Session start timestamp
 * @property {number|null} endTime - Session end timestamp (null if active)
 * @property {number} duration - Session duration in milliseconds
 */

/**
 * Utility functions for common study patterns
 */
export const StudyUtils = {
    /**
     * Get the latest candle from a dataset
     * @param {Array} data - Array of candles
     * @returns {Object|null} - Latest candle or null if no data
     */
    getLatestCandle(data) {
        return data && data.length > 0 ? data[data.length - 1] : null;
    },

    /**
     * Get candles for a specific session
     * @param {Array} data - Array of candles
     * @param {Object} session - Session object
     * @returns {Array} - Filtered candles for the session
     */
    getSessionCandles(data, session) {
        if (!data || !session) return [];
        
        return data.filter(candle => 
            candle.timestamp >= session.startTime &&
            (session.endTime ? candle.timestamp <= session.endTime : true)
        );
    },

    /**
     * Calculate simple moving average
     * @param {Array} data - Array of candles
     * @param {number} period - Period for calculation
     * @param {string} field - Field to calculate on ('close', 'high', 'low', 'open')
     * @returns {Array} - Array of {timestamp, value} objects
     */
    calculateSMA(data, period, field = 'close') {
        if (!data || data.length < period) return [];
        
        const result = [];
        for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j][field];
            }
            result.push({
                timestamp: data[i].timestamp,
                value: sum / period
            });
        }
        return result;
    },

    /**
     * Find session by relative number
     * @param {Array} sessions - Array of sessions
     * @param {number} relativeNumber - Session relative number
     * @returns {Object|null} - Session object or null
     */
    findSession(sessions, relativeNumber) {
        return sessions.find(s => s.relativeNumber === relativeNumber) || null;
    },

    /**
     * Generate unique annotation ID
     * @param {string} studyId - Study identifier
     * @param {string} type - Annotation type
     * @param {string} timeframe - Timeframe
     * @returns {string} - Unique ID
     */
    generateAnnotationId(studyId, type, timeframe) {
        return `${studyId}_${type}_${Date.now()}_${timeframe}`;
    }
};

export default UserStudyInterface; 