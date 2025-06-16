/**
 * Trade Annotation Service for Quatrain
 * 
 * This service manages annotations for trade orders on charts.
 * It uses the shared data service for communication between 
 * Trade Manager and chart components.
 */

// Import timeframe utility
import { timeframeToMilliseconds } from '../utils/chartUtils';

// Define order color mapping
const ORDER_COLORS = {
  'BuyMarket': '#00FF00',  // Green for Buy Market orders
  'SellMarket': '#FF0000', // Red for Sell Market orders
  'BuyLimit': '#008800',   // Dark green for Buy Limit orders
  'SellLimit': '#880000',  // Dark red for Sell Limit orders
  'BuyStop': '#005555',    // Green-blue for Buy Stop orders (closing short positions)
  'SellStop': '#550055',   // Red-purple for Sell Stop orders (closing long positions)
  // Add compound order types with same colors as their base types
  'BuyStopLimit': '#005555',  // Same as BuyStop
  'SellStopLimit': '#550055', // Same as SellStop
  'BuyStopMarket': '#005555', // Same as BuyStop
  'SellStopMarket': '#550055', // Same as SellStop
  // Add lowercase variations for case-insensitive matching
  'buystop': '#005555',
  'sellstop': '#550055',
  'buymarket': '#00FF00',
  'sellmarket': '#FF0000',
  'buylimit': '#008800',
  'selllimit': '#880000',
  'buystoplimit': '#005555',
  'sellstoplimit': '#550055',
  'buystopmarket': '#005555',
  'sellstopmarket': '#550055',
};

// Define position colors
const POSITION_COLORS = {
  'Long': '#006600',   // Dark green for long positions
  'Short': '#660000',  // Dark red for short positions
};

/**
 * Get color for an order based on action and type
 * @param {Object} order Order object
 * @returns {string} Color hex code
 */
export const getOrderColor = (order) => {
  // Make case-insensitive by converting to lowercase
  const actionType = `${order.action}${order.type}`.toLowerCase();
  console.log(`Getting color for order type: ${actionType}, action: ${order.action}, type: ${order.type}`);
  
  // First try exact match with current case, then try lowercase, then default to white
  const color = ORDER_COLORS[`${order.action}${order.type}`] || ORDER_COLORS[actionType] || '#FFFFFF';
  console.log(`Selected color for ${actionType}: ${color}`);
  
  return color;
};

/**
 * Generate annotation ID for an order
 * @param {string} accountName Account name
 * @param {string} orderId Order ID
 * @returns {string} Unique annotation ID
 */
export const generateTradeAnnotationId = (accountName, orderId) => {
  return `trade/${accountName}/${orderId}`;
};

/**
 * Generate annotation ID for a position
 * @param {string} accountName Account name
 * @param {string} positionId Position ID or instrument name
 * @returns {string} Unique annotation ID
 */
export const generatePositionAnnotationId = (accountName, positionId) => {
  return `trade/${accountName}/position/${positionId}`;
};

/**
 * Create annotation config for a position
 * @param {Object} position Position object
 * @param {string} accountName Account name
 * @param {number} currentTimestamp Current candle timestamp
 * @returns {Object} Annotation configuration object for a TextAnnotation
 */
export const createPositionAnnotationConfig = (position, accountName, currentTimestamp) => {
  console.log('Creating annotation for position:', JSON.stringify(position, null, 2));
  
  // Skip if no valid position data
  if (!position || !position.marketPosition || !position.quantity || !position.averagePrice) {
    console.log(`Skipping position for ${position.instrument} - insufficient data`);
    return null;
  }
  
  // Get position color based on direction (Long/Short)
  const positionColor = POSITION_COLORS[position.marketPosition] || '#FFFFFF';
  
  // Create position text in format "2 Long @19950" with properly formatted price
  const formattedPrice = Number(position.averagePrice).toFixed(2);
  const positionText = `${position.quantity} ${position.marketPosition} @${formattedPrice}`;
  
  // Use instrument name as position ID if no explicit ID is provided
  const positionId = position.positionId || position.instrument;
  
  // Extract the timeframe from the position data, default to 1 minute if not available
  const timeframe = position.timeframe || '1m';
  
  // Convert timeframe to milliseconds using the imported utility
  const timeframeMs = timeframeToMilliseconds(timeframe);
  
  // Position the annotation one candle ahead of the current timestamp
  // This is now a default for the base 1m chart only - it will be adjusted per chart
  const aheadTimestamp = currentTimestamp + timeframeMs;
  
  console.log(`Position ${positionId} annotation: ${positionText} at ${position.averagePrice} with color ${positionColor}`);
  console.log(`Placing annotation one candle ahead of currentTimestamp(${currentTimestamp}): ${aheadTimestamp} [timeframe: ${timeframe}, interval: ${timeframeMs}ms]`);
  
  return {
    id: generatePositionAnnotationId(accountName, positionId),
    text: positionText,
    textColor: '#FFFFFF',
    background: positionColor,
    opacity: 0.8,
    x1: aheadTimestamp, // This is the base position, it will be adjusted per chart
    baseTimestamp: currentTimestamp, // Include the base timestamp for adjustments in TradeAnnotationManager
    y1: position.averagePrice,
    isEditable: false,
    fontSize: 10,
    horizontalAnchorPoint: 'Left',
    verticalAnchorPoint: 'Center',
    yAxisId: 'yAxis',
    annotationKind: 'position' // Custom property to identify position annotations
  };
};

/**
 * Create annotation config for an order
 * @param {Object} order Order object
 * @param {string} accountName Account name
 * @param {number} currentTimestamp Current candle timestamp
 * @param {boolean} isChartModificationModeActive Whether chart modification mode is active
 * @param {function | undefined} onDragEndedCallback Callback for onDragEnded event
 * @returns {Object | null} Annotation configuration object or null
 */
export const createOrderAnnotationConfig = (
  order, 
  accountName, 
  currentTimestamp,
  isChartModificationModeActive,
  onDragEndedCallback
) => {
  console.log('Creating annotation for order:', JSON.stringify(order, null, 2), `ModMode: ${isChartModificationModeActive}`);
  
  const orderColor = getOrderColor(order);
  // Make case-insensitive type comparisons using toLowerCase()
  const orderType = order.type && order.type.toLowerCase();
  
  // Handle different price determination based on order type
  let orderPrice = 0;
  if (orderType === 'market') {
    // Market orders are typically filled and won't have draggable lines for modification.
    // If they appear as working (e.g. simulated), use averageFillPrice or a placeholder.
    orderPrice = order.averageFillPrice || order.limitPrice; 
  } else if (orderType === 'limit') {
    orderPrice = order.limitPrice;
  } else if (orderType === 'stop' || orderType === 'stopmarket') {
    orderPrice = order.stopPrice;
  } else if (orderType === 'stoplimit') {
    orderPrice = order.stopPrice; // The stop price is the one dragged for StopLimit
  }
  
  // Skip if no valid price
  if (!orderPrice || orderPrice === 0) {
    console.log(`Skipping order ${order.orderId} - no valid price found. Type: ${orderType}`);
    return null;
  }
  
  // Set label based on order type
  let orderTypeLabel = '';
  if (orderType === 'market') {
    orderTypeLabel = order.action === 'Buy' ? 'Buy' : 'Sell';
  } else if (orderType === 'limit') {
    orderTypeLabel = order.action === 'Buy' ? 'Buy' : 'Sell';
  } else if (orderType === 'stoplimit') {
    orderTypeLabel = 'StopL';
  } else if (orderType === 'stop' || orderType === 'stopmarket') {
    orderTypeLabel = 'StopM';
  }
  
  console.log(`Order ${order.orderId} annotation: ${orderTypeLabel} at ${orderPrice} with color ${orderColor}`);
  
  const annotationConfig = {
    id: generateTradeAnnotationId(accountName, order.orderId),
    stroke: orderColor,
    strokeDashArray: isChartModificationModeActive ? [2,2] : [1, 3], // Different dash when editable
    strokeThickness: isChartModificationModeActive ? 3 : 2, // Thicker when editable
    // x1: currentTimestamp, // x1 being undefined makes it a full-width horizontal line
    y1: orderPrice,
    isEditable: isChartModificationModeActive || false, 
    showLabel: true,
    labelPlacement: "Axis",
    labelValue: `${orderTypeLabel} ${order.quantity}`,
    axisLabelFill: orderColor,
    axisLabelStroke: '#FFFFFF',
    fontSize: 9,
    yAxisId: 'yAxis', // Ensure it's associated with the correct Y-axis
    annotationKind: 'order' // Custom property to identify order annotations
  };

  if (isChartModificationModeActive && onDragEndedCallback) {
    // annotationConfig.onDragEnded = onDragEndedCallback; // Removed direct function assignment
    annotationConfig.isDragListening = true; // Add a flag instead
    // We can also add onDragStarted or onDrag if needed for visual feedback during drag
  }
  
  // Log the final config before returning, especially when in modification mode
  if (isChartModificationModeActive) {
    console.log(`FINAL ANNOTATION CONFIG for ${order.orderId} (MOD MODE ON):`, JSON.stringify(annotationConfig, (key, value) => {
      if (typeof value === 'function') {
        return '[Function]'; // Replace function with a placeholder string for logging
      }
      return value;
    }, 2));
  }

  return annotationConfig;
};

/**
 * Use the shared data service to manage trade annotations
 * @param {DataClient} dataClient Shared data client instance
 */
export const initTradeAnnotations = (dataClient) => {
  // Set up data channel for trade annotations
  const TRADE_ANNOTATIONS_CHANNEL = 'trade:annotations';
  
  /**
   * Update trade annotations
   * @param {Array} annotations Array of annotation configs
   * @returns {Promise<boolean>} Success status
   */
  const updateTradeAnnotations = async (annotations) => {
    return await dataClient.push(TRADE_ANNOTATIONS_CHANNEL, annotations);
  };
  
  /**
   * Subscribe to trade annotation updates
   * @param {Function} callback Callback function
   * @returns {Function} Unsubscribe function
   */
  const subscribeToTradeAnnotations = (callback) => {
    return dataClient.subscribe(TRADE_ANNOTATIONS_CHANNEL, callback);
  };
  
  /**
   * Get current trade annotations
   * @returns {Promise<Array>} Array of annotation configs
   */
  const getTradeAnnotations = async () => {
    return await dataClient.request(TRADE_ANNOTATIONS_CHANNEL) || [];
  };
  
  // Return the API
  return {
    updateTradeAnnotations,
    subscribeToTradeAnnotations,
    getTradeAnnotations,
  };
};

export default initTradeAnnotations; 