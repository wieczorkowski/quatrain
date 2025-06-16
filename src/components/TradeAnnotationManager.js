import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HorizontalLineAnnotation, TextAnnotation } from 'scichart';
import DataClient from '../services/data-client';
import initTradeAnnotations from '../services/trade-annotation-service';

/**
 * TradeAnnotationManager component
 * 
 * This component manages trade-related annotations on chart panes.
 * It subscribes to trade annotation updates from the shared data service
 * and renders them on all chart panes.
 */
const TradeAnnotationManager = ({ sciChartSurfaceRefs, timeframes, currentInstrument }) => {
  const dataClientRef = useRef(null);
  const tradeAnnotationServiceRef = useRef(null);
  const [tradeAnnotations, setTradeAnnotations] = useState([]);

  // Initialize the data client and trade annotation service
  useEffect(() => {
    if (!dataClientRef.current) {
      dataClientRef.current = new DataClient();
      tradeAnnotationServiceRef.current = initTradeAnnotations(dataClientRef.current);
      console.log('Trade Annotation Manager: DataClient initialized');
    }
    
    // Initial fetch of trade annotations
    const fetchAnnotations = async () => {
      if (tradeAnnotationServiceRef.current) {
        const annotations = await tradeAnnotationServiceRef.current.getTradeAnnotations();
        if (annotations) {
          setTradeAnnotations(annotations);
        }
      }
    };
    
    fetchAnnotations();
    
    // Subscribe to annotation updates
    const subscribe = () => {
      if (tradeAnnotationServiceRef.current) {
        return tradeAnnotationServiceRef.current.subscribeToTradeAnnotations((annotations) => {
          setTradeAnnotations(annotations || []);
        });
      }
      return () => {};
    };
    
    const unsubscribe = subscribe();
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Function to handle order annotation drag ended
  const handleOrderAnnotationDragEnded = useCallback((annotation) => {
    console.log('TradeAnnotationManager: Order annotation drag ended', annotation.id, 'new y1:', annotation.y1);
    
    // Extract order ID from annotation ID (format: "trade/accountName/orderId")
    const idParts = annotation.id.split('/');
    console.log('TradeAnnotationManager: Annotation ID parts:', idParts);
    
    if (idParts.length >= 3 && idParts[0] === 'trade') {
      const orderId = idParts[2];
      const newPrice = annotation.y1;
      
      console.log(`TradeAnnotationManager: Extracted order ID: "${orderId}" from annotation ID: "${annotation.id}"`);
      console.log(`TradeAnnotationManager: Sending drag event for order ${orderId} to new price ${newPrice}`);
      
      // Send drag event to Trade Manager via IPC
      try {
        const { ipcRenderer } = window.require('electron');
        const dragData = {
          orderId: orderId,
          y1: newPrice
        };
        console.log('TradeAnnotationManager: Sending IPC message with data:', dragData);
        ipcRenderer.send('order-annotation-drag-ended', dragData);
        console.log('TradeAnnotationManager: IPC message sent successfully');
      } catch (error) {
        console.error('TradeAnnotationManager: Error sending drag event via IPC:', error);
      }
    } else {
      console.error('TradeAnnotationManager: Invalid annotation ID format:', annotation.id);
      console.error('TradeAnnotationManager: Expected format: "trade/accountName/orderId", got parts:', idParts);
    }
  }, []);
  
  // Update the annotations on all chart panes when they change
  useEffect(() => {
    if (!sciChartSurfaceRefs || !sciChartSurfaceRefs.current || !timeframes) {
      return;
    }
    
    // Clear existing trade annotations from all chart panes
    timeframes.forEach(tf => {
      const chartSurface = sciChartSurfaceRefs.current[tf];
      if (!chartSurface) return;
      
      // Find and remove annotations that start with 'trade/'
      const existingTradeAnnotations = chartSurface.annotations.asArray()
        .filter(anno => anno.id && typeof anno.id === 'string' && anno.id.startsWith('trade/'));
      
      existingTradeAnnotations.forEach(anno => {
        // CRITICAL FIX: Call delete() method on annotation to free WebGL resources
        if (typeof anno.delete === 'function') {
          try {
            anno.delete();
          } catch (error) {
            console.warn(`TradeAnnotationManager: Error calling delete() on trade annotation: ${error.message}`);
          }
        }
        chartSurface.annotations.remove(anno);
      });
    });
    
    // Filter annotations for current instrument
    const relevantAnnotations = tradeAnnotations.filter(anno => 
      // Filter logic is implemented in the Trade Manager component
      // Only annotations for the current instrument are sent to the shared data store
      true
    );
    
    // Add filtered annotations to all chart panes
    if (relevantAnnotations.length > 0) {
      timeframes.forEach(tf => {
        const chartSurface = sciChartSurfaceRefs.current[tf];
        if (!chartSurface) return;
        
        relevantAnnotations.forEach(annoConfig => {
          try {
            console.log(`TradeAnnotationManager: Processing annotation for chart ${tf}:`, annoConfig.id);
            console.log(`TradeAnnotationManager: Annotation config:`, annoConfig);
            
            let annotation;
            
            // Check the annotation type and create the appropriate annotation
            if (annoConfig.annotationKind === 'position') {
              // Create a text annotation for positions
              
              // Calculate appropriate x1 position based on this chart's timeframe
              // This ensures the annotation is one candle-interval ahead on each chart
              let adjustedX1 = annoConfig.x1;
              
              // Get the timeframe duration in milliseconds for this chart
              const timeframeMs = getTimeframeMs(tf);
              
              // For position annotations, we want them to be one candle interval ahead
              // on each chart to avoid overlapping with the live candle
              adjustedX1 = annoConfig.baseTimestamp + timeframeMs;
              
              annotation = new TextAnnotation({
                id: annoConfig.id,
                text: annoConfig.text,
                textColor: annoConfig.textColor,
                background: annoConfig.background,
                opacity: annoConfig.opacity,
                x1: adjustedX1, // Use the adjusted x1 position
                y1: annoConfig.y1,
                isEditable: annoConfig.isEditable,
                fontSize: annoConfig.fontSize,
                horizontalAnchorPoint: annoConfig.horizontalAnchorPoint,
                verticalAnchorPoint: annoConfig.verticalAnchorPoint,
                yAxisId: annoConfig.yAxisId,
                annotationLayer: "AboveChart"
              });
              console.log(`DebugPos - Chart ${tf}: Adjusted annotation from ${annoConfig.x1} to ${adjustedX1}`);
              console.log('DebugPos - AnnotationID:', annotation.id);
              console.log('DebugPos - Annotation layer:', annotation.annotationLayer);
            } else {
              // Default to horizontal line annotation for orders
              annotation = new HorizontalLineAnnotation({
                id: annoConfig.id,
                stroke: annoConfig.stroke,
                strokeDashArray: annoConfig.strokeDashArray,
                strokeThickness: annoConfig.strokeThickness,
                y1: annoConfig.y1,
                isEditable: annoConfig.isEditable,
                showLabel: annoConfig.showLabel,
                labelPlacement: annoConfig.labelPlacement,
                labelValue: annoConfig.labelValue,
                axisLabelFill: annoConfig.axisLabelFill,
                axisLabelStroke: annoConfig.axisLabelStroke,
                fontSize: annoConfig.fontSize,
                yAxisId: annoConfig.yAxisId,
                annotationLayer: "AboveChart"
              });

              // Add onDragEnded handler for order annotations when in modification mode
              if (annoConfig.annotationKind === 'order' && annoConfig.isEditable && annoConfig.isDragListening) {
                console.log(`TradeAnnotationManager: Adding drag handler to order annotation ${annoConfig.id}`);
                console.log(`TradeAnnotationManager: Annotation config - isEditable: ${annoConfig.isEditable}, isDragListening: ${annoConfig.isDragListening}`);
                
                // Store the original onDragStarted handler from SciChart
                const originalOnDragStarted = annotation.onDragStarted;
                
                // Create a new onDragStarted handler to track when drags begin
                annotation.onDragStarted = function(...args) {
                  console.log(`TradeAnnotationManager: onDragStarted triggered for annotation ${annotation.id}`);
                  
                  // First call the original handler if it exists
                  if (typeof originalOnDragStarted === 'function') {
                    originalOnDragStarted.apply(this, args);
                  }
                  
                  // Send drag start event to Trade Manager via IPC
                  try {
                    const { ipcRenderer } = window.require('electron');
                    ipcRenderer.send('order-annotation-drag-started');
                    console.log('TradeAnnotationManager: Sent drag started IPC message');
                  } catch (error) {
                    console.error('TradeAnnotationManager: Error sending drag started event via IPC:', error);
                  }
                };
                
                // Store the original onDragEnded handler from SciChart
                const originalOnDragEnded = annotation.onDragEnded;
                
                // Create a new handler that calls the original and then our code
                annotation.onDragEnded = function(...args) {
                  console.log(`TradeAnnotationManager: onDragEnded triggered for annotation ${annotation.id}`);
                  console.log(`TradeAnnotationManager: Drag args:`, args);
                  console.log(`TradeAnnotationManager: Annotation y1 after drag:`, annotation.y1);
                  
                  // First call the original handler if it exists to maintain proper mouse release
                  if (typeof originalOnDragEnded === 'function') {
                    console.log(`TradeAnnotationManager: Calling original onDragEnded handler`);
                    originalOnDragEnded.apply(this, args);
                  } else {
                    console.log(`TradeAnnotationManager: No original onDragEnded handler found`);
                  }
                  
                  // After a short delay to allow the mouse to be released first
                  setTimeout(() => {
                    console.log(`TradeAnnotationManager: Drag ended for order annotation ${annotation.id}`);
                    handleOrderAnnotationDragEnded(annotation);
                    
                    // Send drag end event to Trade Manager via IPC
                    try {
                      const { ipcRenderer } = window.require('electron');
                      ipcRenderer.send('order-annotation-drag-ended-complete');
                      console.log('TradeAnnotationManager: Sent drag ended complete IPC message');
                    } catch (error) {
                      console.error('TradeAnnotationManager: Error sending drag ended complete event via IPC:', error);
                    }
                  }, 0);
                };
                
                console.log(`TradeAnnotationManager: Drag handlers successfully attached to annotation ${annoConfig.id}`);
              } else {
                console.log(`TradeAnnotationManager: NOT adding drag handler to annotation ${annoConfig.id} - annotationKind: ${annoConfig.annotationKind}, isEditable: ${annoConfig.isEditable}, isDragListening: ${annoConfig.isDragListening}`);
              }
            }
            
            // Add the annotation to the chart
            chartSurface.annotations.add(annotation);
          } catch (error) {
            console.error('Error adding trade annotation:', error);
          }
        });
        
        // Refresh the chart
        chartSurface.invalidateElement();
      });
    }
    
  }, [sciChartSurfaceRefs, timeframes, tradeAnnotations, currentInstrument, handleOrderAnnotationDragEnded]);
  
  // Helper function to convert timeframe string to milliseconds
  const getTimeframeMs = (timeframe) => {
    const match = timeframe.match(/^(\d+)([mhd])$/);
    if (!match) {
      console.warn(`Invalid timeframe format: ${timeframe}. Expected format like '1m', '5m', '1h'. Defaulting to 1m.`);
      return 60 * 1000; // Default to 1 minute
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    if (unit === 'm') return value * 60 * 1000; // minutes to milliseconds
    if (unit === 'h') return value * 60 * 60 * 1000; // hours to milliseconds
    if (unit === 'd') return value * 24 * 60 * 60 * 1000; // days to milliseconds
    
    return 60 * 1000; // Default to 1 minute if unit not recognized
  };
  
  // Empty render because this is a controller component
  return null;
};

export default TradeAnnotationManager; 