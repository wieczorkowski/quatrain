import { useState, useCallback } from 'react';
import {
  validateTradeBossOrder,
  createTradeBossOrder,
  useTradeBossOrderTracking,
  checkTradeBossOrderFills
} from './TradeBossLogic';

/**
 * Custom hook for Trade Boss functionality
 * 
 * Manages all Trade Boss state, validation, and order handling.
 * Extracted from TradeWindow.js for better code organization.
 */
export const useTradeBoss = (isConnected, accountName, symbol, setStatus) => {
  // Trade Boss state
  const [tradePlan, setTradePlan] = useState('');
  const [stopLossPoints, setStopLossPoints] = useState('5');
  const [scaleOutQty, setScaleOutQty] = useState('1');
  const [scaleOutPoints, setScaleOutPoints] = useState('5');
  const [scaleOutUnit, setScaleOutUnit] = useState('points');
  const [tradeBossQuantity, setTradeBossQuantity] = useState('1');
  
  // Order tracking
  const {
    activeTradeBossOrdersRef,
    addTradeBossOrder,
    removeTradeBossOrder,
    getActiveOrdersCount
  } = useTradeBossOrderTracking();
  
  // Handle Trade Boss Go Long
  const handleGoLong = useCallback(() => {
    console.log(`Trade Boss: Initiating Go Long for ${tradeBossQuantity} ${symbol}`);
    
    // Validate order parameters
    const validation = validateTradeBossOrder(
      isConnected,
      accountName,
      symbol,
      tradeBossQuantity,
      stopLossPoints,
      scaleOutQty,
      scaleOutPoints
    );
    
    if (!validation.isValid) {
      console.error('TradeWindow: Cannot place Trade Boss order -', validation.error);
      setStatus({
        message: validation.error,
        type: 'error'
      });
      return;
    }
    
    // Parse values
    const qty = parseInt(tradeBossQuantity, 10);
    const stopPoints = parseFloat(stopLossPoints);
    const scaleQty = parseInt(scaleOutQty, 10);
    const scalePoints = parseFloat(scaleOutPoints);
    
    // Create Trade Boss order
    const result = createTradeBossOrder(
      'BUY',
      qty,
      symbol,
      accountName,
      stopPoints,
      scaleQty,
      scalePoints,
      scaleOutUnit
    );
    
    if (result.success) {
      // Add to tracking
      addTradeBossOrder(result.orderTrackingId, result.automationSettings);
      
      setStatus({
        message: result.message,
        type: 'success'
      });
    } else {
      setStatus({
        message: result.message,
        type: 'error'
      });
    }
  }, [
    isConnected,
    accountName,
    symbol,
    tradeBossQuantity,
    stopLossPoints,
    scaleOutQty,
    scaleOutPoints,
    scaleOutUnit,
    setStatus,
    addTradeBossOrder
  ]);
  
  // Handle Trade Boss Go Short
  const handleGoShort = useCallback(() => {
    console.log(`Trade Boss: Initiating Go Short for ${tradeBossQuantity} ${symbol}`);
    
    // Validate order parameters
    const validation = validateTradeBossOrder(
      isConnected,
      accountName,
      symbol,
      tradeBossQuantity,
      stopLossPoints,
      scaleOutQty,
      scaleOutPoints
    );
    
    if (!validation.isValid) {
      console.error('TradeWindow: Cannot place Trade Boss order -', validation.error);
      setStatus({
        message: validation.error,
        type: 'error'
      });
      return;
    }
    
    // Parse values
    const qty = parseInt(tradeBossQuantity, 10);
    const stopPoints = parseFloat(stopLossPoints);
    const scaleQty = parseInt(scaleOutQty, 10);
    const scalePoints = parseFloat(scaleOutPoints);
    
    // Create Trade Boss order
    const result = createTradeBossOrder(
      'SELL',
      qty,
      symbol,
      accountName,
      stopPoints,
      scaleQty,
      scalePoints,
      scaleOutUnit
    );
    
    if (result.success) {
      // Add to tracking
      addTradeBossOrder(result.orderTrackingId, result.automationSettings);
      
      setStatus({
        message: result.message,
        type: 'success'
      });
    } else {
      setStatus({
        message: result.message,
        type: 'error'
      });
    }
  }, [
    isConnected,
    accountName,
    symbol,
    tradeBossQuantity,
    stopLossPoints,
    scaleOutQty,
    scaleOutPoints,
    scaleOutUnit,
    setStatus,
    addTradeBossOrder
  ]);
  
  // Handle NinjaTrader message for Trade Boss automation
  const handleTradeBossMessage = useCallback((message) => {
    return checkTradeBossOrderFills(message, activeTradeBossOrdersRef, setStatus);
  }, [activeTradeBossOrdersRef, setStatus]);
  
  return {
    // State
    tradePlan,
    setTradePlan,
    stopLossPoints,
    setStopLossPoints,
    scaleOutQty,
    setScaleOutQty,
    scaleOutPoints,
    setScaleOutPoints,
    scaleOutUnit,
    setScaleOutUnit,
    tradeBossQuantity,
    setTradeBossQuantity,
    
    // Order tracking
    activeTradeBossOrdersRef,
    getActiveOrdersCount,
    
    // Event handlers
    handleGoLong,
    handleGoShort,
    handleTradeBossMessage
  };
}; 