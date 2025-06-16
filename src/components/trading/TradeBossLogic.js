import { useRef, useCallback } from 'react';

/**
 * Trade Boss Logic Module
 * 
 * Contains all Trade Boss automation logic, order tracking, and execution functions
 * extracted from TradeWindow.js for better code organization.
 */

// Generate unique order tracking ID
export const generateOrderTrackingId = () => {
  return `trade_boss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Validate Trade Boss order parameters
export const validateTradeBossOrder = (isConnected, accountName, symbol, quantity, stopLossPoints, scaleOutQty, scaleOutPoints) => {
  // Check bridge connection
  if (!isConnected) {
    return {
      isValid: false,
      error: 'Cannot place order: NinjaTrader Bridge is not connected'
    };
  }
  
  // Check for valid account
  if (!accountName) {
    return {
      isValid: false,
      error: 'Cannot place order: No account selected'
    };
  }
  
  // Check for valid symbol
  if (!symbol) {
    return {
      isValid: false,
      error: 'Cannot place order: No instrument selected'
    };
  }
  
  // Validate quantity
  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty < 1) {
    return {
      isValid: false,
      error: 'Please enter a valid quantity'
    };
  }
  
  // Validate Trade Boss settings
  const stopPoints = parseFloat(stopLossPoints);
  const scaleQty = parseInt(scaleOutQty, 10);
  const scalePointsNum = parseFloat(scaleOutPoints);
  
  if (isNaN(stopPoints) || stopPoints <= 0) {
    return {
      isValid: false,
      error: 'Please enter a valid stop loss points value'
    };
  }
  
  if (isNaN(scaleQty) || scaleQty < 1) {
    return {
      isValid: false,
      error: 'Please enter a valid scale out quantity'
    };
  }
  
  if (isNaN(scalePointsNum) || scalePointsNum <= 0) {
    return {
      isValid: false,
      error: 'Please enter a valid scale out points value'
    };
  }
  
  return { isValid: true };
};

// Function to execute Trade Boss automation after market order fills
export const executeTradeBossAutomation = (fillPrice, tradeBossSettings, accountName) => {
  try {
    const { ipcRenderer } = window.require('electron');
    const { action, quantity, symbol, stopLossPoints, scaleOutQty, scaleOutPoints, scaleOutUnit } = tradeBossSettings;
    
    console.log(`Trade Boss: Executing automation for ${action} at fill price ${fillPrice}`);
    console.log('Trade Boss: Settings:', { action, quantity, symbol, stopLossPoints, scaleOutQty, scaleOutPoints, scaleOutUnit });
    console.log('Trade Boss: AccountName received:', accountName, 'Type:', typeof accountName, 'Length:', accountName ? accountName.length : 'null/undefined');
    
    // Calculate stop loss price
    const stopPrice = action === 'BUY' 
      ? fillPrice - stopLossPoints 
      : fillPrice + stopLossPoints;
    
    console.log(`Trade Boss: Calculated stop price: ${stopPrice}`);
    
    // Place stop loss order
    const stopOrder = {
      type: 'place_order',
      action: action === 'BUY' ? 'SELL' : 'BUY',
      orderType: 'LIMITSTOP',
      accountId: accountName,
      symbol: symbol,
      quantity: quantity,
      stopPrice: stopPrice,
      limitPrice: stopPrice, // Use same price for limit as stop
      timestamp: Date.now()
    };
    
    console.log('Trade Boss: Placing stop loss order:', stopOrder);
    ipcRenderer.send('nt-bridge-send-request', stopOrder);
    
    // Calculate scale-out orders
    let remainingQty = quantity;
    let orderCount = 0;
    
    console.log(`Trade Boss: Starting scale-out calculation with ${remainingQty} remaining qty`);
    
    while (remainingQty > 0) {
      orderCount++;
      
      // Calculate scale-out price
      let scalePrice;
      if (scaleOutUnit === 'points') {
        scalePrice = action === 'BUY' 
          ? fillPrice + (scaleOutPoints * orderCount)
          : fillPrice - (scaleOutPoints * orderCount);
      } else { // 'R' mode
        const rInterval = stopLossPoints; // R = stop loss distance
        scalePrice = action === 'BUY' 
          ? fillPrice + (rInterval * orderCount)
          : fillPrice - (rInterval * orderCount);
      }
      
      console.log(`Trade Boss: Scale-out order ${orderCount} - price: ${scalePrice} (${scaleOutUnit} mode)`);
      
      // Determine quantity for this scale-out order
      const orderQty = remainingQty >= scaleOutQty ? scaleOutQty : remainingQty;
      remainingQty -= orderQty;
      
      console.log(`Trade Boss: Scale-out order ${orderCount} - quantity: ${orderQty}, remaining: ${remainingQty}`);
      
      // Place scale-out limit order
      const scaleOrder = {
        type: 'place_order',
        action: action === 'BUY' ? 'SELL' : 'BUY',
        orderType: 'LIMIT',
        accountId: accountName,
        symbol: symbol,
        quantity: orderQty,
        limitPrice: scalePrice,
        timestamp: Date.now()
      };
      
      console.log(`Trade Boss: Placing scale-out order ${orderCount}:`, scaleOrder);
      ipcRenderer.send('nt-bridge-send-request', scaleOrder);
    }
    
    console.log(`Trade Boss: Automation complete - placed stop loss and ${orderCount} scale-out orders`);
    
    return {
      success: true,
      message: `Trade Boss: Automation complete - placed stop loss and ${orderCount} scale-out orders`
    };
    
  } catch (error) {
    console.error('Trade Boss: Error executing automation:', error);
    return {
      success: false,
      message: 'Trade Boss: Error placing automated orders'
    };
  }
};

// Check for Trade Boss order fills and trigger automation
export const checkTradeBossOrderFills = (message, activeTradeBossOrdersRef, setStatus) => {
  try {
    // Extract order information from the message
    let orderId, status, action, quantity, symbol, fillPrice;
    
    if (message.type === 'orderUpdate' && message.order) {
      // For orderUpdate messages, data is in the order object
      orderId = message.order.orderId || 'N/A';
      status = message.order.state || 'N/A';
      action = message.order.action || '';
      quantity = message.order.quantity ? message.order.quantity.toString() : '';
      symbol = message.order.instrument || '';
      fillPrice = message.order.averageFillPrice || '';
    } else {
      // For order_confirmation messages, use the old extraction
      orderId = message.orderId || 'N/A';
      status = message.status || 'N/A';
      action = message.action || '';
      quantity = message.quantity || '';
      symbol = message.symbol || message.instrument || '';
      fillPrice = message.price || '';
    }
    
    console.log(`TradeWindow: ${message.type} received:`, { orderId, status, action, quantity, symbol, fillPrice });
    console.log('TradeWindow: Complete message:', JSON.stringify(message, null, 2));
    console.log('TradeWindow: Active Trade Boss orders:', Array.from(activeTradeBossOrdersRef.current.entries()));
    
    // Check if this is a Trade Boss market order that got filled
    if (status && status.toLowerCase() === 'filled') {
      console.log('TradeWindow: Order was completely filled, checking for Trade Boss match...');
      
      // Look for matching Trade Boss order
      let matchedTradeBossId = null;
      let matchedSettings = null;
      
      for (const [tradeBossId, settings] of activeTradeBossOrdersRef.current.entries()) {
        console.log('TradeWindow: Checking Trade Boss order:', { tradeBossId, settings });
        
        // Check if this fill matches a Trade Boss order (improved matching)
        const actionMatch = settings.action.toUpperCase() === action.toUpperCase();
        const quantityMatch = settings.quantity.toString() === quantity;
        
        // For symbol matching, check if stored symbol is contained in the instrument name
        // e.g., "MNQM5" should match "MNQ 06-25"
        const symbolMatch = symbol.includes(settings.symbol.substring(0, 3)) || 
                           settings.symbol.includes(symbol.substring(0, 3));
        
        console.log('TradeWindow: Match check:', { 
          actionMatch, 
          quantityMatch, 
          symbolMatch,
          storedAction: settings.action,
          receivedAction: action,
          storedSymbol: settings.symbol,
          receivedSymbol: symbol
        });
        
        if (actionMatch && quantityMatch && symbolMatch) {
          console.log('TradeWindow: Found matching Trade Boss order!');
          matchedTradeBossId = tradeBossId;
          matchedSettings = settings;
          break;
        }
      }
      
      if (matchedTradeBossId && matchedSettings && fillPrice && !isNaN(parseFloat(fillPrice))) {
        console.log(`TradeWindow: Trade Boss automation triggered - market order filled at ${fillPrice}`);
        
        // Use the accountId from the order message instead of component state
        const orderAccountId = message.order ? message.order.accountId : '';
        console.log('TradeWindow: Using accountId from order message:', orderAccountId);
        
        // Execute automation after a short delay to ensure order is fully processed
        setTimeout(() => {
          console.log('TradeWindow: Executing Trade Boss automation...');
          const result = executeTradeBossAutomation(parseFloat(fillPrice), matchedSettings, orderAccountId);
          
          if (setStatus) {
            setStatus({
              message: result.message,
              type: result.success ? 'success' : 'error'
            });
          }
        }, 1000);
        
        // Remove from tracking map
        const newTradeBossOrders = new Map(activeTradeBossOrdersRef.current);
        newTradeBossOrders.delete(matchedTradeBossId);
        activeTradeBossOrdersRef.current = newTradeBossOrders;
        
        return true; // Indicate that a Trade Boss order was processed
      } else {
        console.log('TradeWindow: No matching Trade Boss order found or missing fill price');
      }
    } else {
      console.log('TradeWindow: Order status check failed. Status:', status, 'Type:', typeof status);
    }
    
    return false; // No Trade Boss order was processed
  } catch (error) {
    console.error('Trade Boss: Error checking order fills:', error);
    return false;
  }
};

// Create Trade Boss order with tracking
export const createTradeBossOrder = (action, quantity, symbol, accountName, stopLossPoints, scaleOutQty, scaleOutPoints, scaleOutUnit) => {
  try {
    const { ipcRenderer } = window.require('electron');
    
    // Create a unique order ID for tracking
    const orderTrackingId = generateOrderTrackingId();
    
    // Create automation settings object
    const automationSettings = {
      action: action,
      quantity: quantity,
      symbol: symbol,
      stopLossPoints: stopLossPoints,
      scaleOutQty: scaleOutQty,
      scaleOutPoints: scaleOutPoints,
      scaleOutUnit: scaleOutUnit
    };
    
    // Create regular market order
    const order = {
      type: 'place_order',
      action: action,
      orderType: 'MARKET',
      accountId: accountName,
      symbol: symbol,
      quantity: quantity,
      timestamp: Date.now(),
      tradeBossId: orderTrackingId // Add tracking ID
    };
    
    console.log('TradeWindow: Sending Trade Boss market order:', order);
    
    // Send the order via IPC
    ipcRenderer.send('nt-bridge-send-request', order);
    
    return {
      success: true,
      orderTrackingId: orderTrackingId,
      automationSettings: automationSettings,
      message: `Trade Boss: Sending ${action.toLowerCase()} market order for ${quantity} ${symbol} with automated management...`
    };
  } catch (error) {
    console.error('Error sending Trade Boss order:', error);
    return {
      success: false,
      message: 'Failed to send Trade Boss order. Please try again.'
    };
  }
};

// Custom hook for Trade Boss order tracking
export const useTradeBossOrderTracking = () => {
  const activeTradeBossOrdersRef = useRef(new Map());
  
  const addTradeBossOrder = useCallback((orderTrackingId, automationSettings) => {
    console.log('Trade Boss: Storing order tracking:', orderTrackingId, automationSettings);
    
    const newTradeBossOrders = new Map(activeTradeBossOrdersRef.current);
    newTradeBossOrders.set(orderTrackingId, automationSettings);
    activeTradeBossOrdersRef.current = newTradeBossOrders;
    
    console.log('Trade Boss: New map size:', newTradeBossOrders.size);
  }, []);
  
  const removeTradeBossOrder = useCallback((orderTrackingId) => {
    const newTradeBossOrders = new Map(activeTradeBossOrdersRef.current);
    newTradeBossOrders.delete(orderTrackingId);
    activeTradeBossOrdersRef.current = newTradeBossOrders;
  }, []);
  
  const getActiveOrdersCount = useCallback(() => {
    return activeTradeBossOrdersRef.current.size;
  }, []);
  
  return {
    activeTradeBossOrdersRef,
    addTradeBossOrder,
    removeTradeBossOrder,
    getActiveOrdersCount
  };
}; 