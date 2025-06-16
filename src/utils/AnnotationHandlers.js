import { HorizontalLineAnnotation, BoxAnnotation, LineAnnotation, CustomAnnotation, NativeTextAnnotation } from 'scichart';
import { getAnnotationProperties, getReadableTextColor, getArrowAnchorPoints } from './chartUtils';

// Add this to access WebSocket constants
const WebSocket = window.WebSocket || window.MozWebSocket;

// Function to generate a unique ID for annotations
export const generateAnnotationId = (clientId, instrument, isAllTimeframes, annotationType, timeframe) => {
    // Use "all" as the timeframe when isAllTimeframes is checked
    const tfValue = isAllTimeframes ? "all" : timeframe;
    
    // Format: clientID/instrument/timeframe/annotationType/uniqueID
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    return `quatrain-${clientId}/${instrument}/${tfValue}/${annotationType}/${uniqueId}`;
};

// Handler for annotation creation
export const handleAnnotationCreated = (annotation, timeframe, ws, clientId, instrument, isAllTimeframes, arrowDirection, timeframes, sciChartSurfaceRefs, isDrawingLockMode = false) => {
    // console.log(`Annotation Created on ${timeframe} chart:`, annotation.type, 'ID:', annotation.id);
    
    // If drawing lock mode is on, set isEditable to false on this annotation immediately
    if (isDrawingLockMode && annotation.isEditable) {
        annotation.isEditable = false;
        sciChartSurfaceRefs.current[timeframe].invalidateElement();
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            // Parse the annotation ID to get components
            const idParts = annotation.id.split('/');
            const clientid = idParts[0];
            const instrument = idParts[1];
            const annotationTimeframe = idParts[2];
            const annotype = idParts[3];
            const unique = idParts[4];
            
            // Create the creation message
            const message = {
                action: "save_anno",
                clientid: clientid,
                instrument: instrument,
                timeframe: annotationTimeframe,
                annotype: annotype,
                unique: unique,
                // this needs to be set inside of the object - id: annotation.id,
                object: getAnnotationProperties(annotation)
            };
            
            // Send the message
            ws.send(JSON.stringify(message));
            // console.log('Sent annotation creation message:', message);
            
            // If this is an "all" timeframe annotation, create it on all other charts too
            if (annotationTimeframe === "all") {
                // console.log('Propagating creation of "all" timeframe annotation to other charts');
                
                // Go through all timeframes
                timeframes.forEach(tf => {
                    // Skip the original timeframe where the annotation was created
                    if (tf === timeframe) return;
                    
                    // Get the chart surface for this timeframe
                    const targetSurface = sciChartSurfaceRefs.current[tf];
                    if (!targetSurface) {
                        console.warn(`Cannot create annotation on ${tf} chart: Surface not found`);
                        return;
                    }
                    
                    // Check if the annotation already exists on this chart
                    const existingAnnotation = targetSurface.annotations.asArray().find(anno => anno.id === annotation.id);
                    if (existingAnnotation) {
                        // console.log(`Annotation with ID ${annotation.id} already exists on ${tf} chart`);
                        return;
                    }
                    
                    // Create a new annotation of the same type on this chart
                    let newAnnotation;
                    if (annotation.type === "HorizontalLineAnnotation" || annotation.type === "RenderContextHorizontalLineAnnotation") {
                        const { stroke, strokeThickness, labelPlacement, y1, x1, strokeDashArray, labelValue, showLabel } = annotation;
                        newAnnotation = new HorizontalLineAnnotation({
                            id: annotation.id,
                            stroke,
                            strokeThickness,
                            strokeDashArray,
                            labelPlacement,
                            y1,
                            x1,
                            labelValue,
                            showLabel,
                            isEditable: !isDrawingLockMode,
                            isSelected: false,
                            axisLabelFill: stroke,
                            axisLabelStroke: getReadableTextColor(stroke),
                            fontSize: 12,
                            yAxisId: 'yAxis',
                            onDrag: () => {
                                // Update label value during drag
                                newAnnotation.labelValue = newAnnotation.y1.toFixed(2);
                                targetSurface.invalidateElement();
                            },
                            onDragEnded: () => {
                                // Store original handler
                                const originalOnDragEnded = newAnnotation.onDragEnded;
                                
                                // Create handler that properly updates all charts
                                setTimeout(() => {
                                    // console.log(`Handler: Line drag ended on ${tf} chart for propagated annotation (from creation)`);
                                    handleAnnotationUpdated(newAnnotation, tf, ws, clientId, instrument, isAllTimeframes, arrowDirection, timeframes, sciChartSurfaceRefs);
                                }, 0);
                            }
                        });
                    } else if (annotation.type === "BoxAnnotation" || annotation.type === "RenderContextBoxAnnotation") {
                        const { stroke, strokeThickness, fill, x1, x2, y1, y2 } = annotation;
                        newAnnotation = new BoxAnnotation({
                            id: annotation.id,
                            stroke,
                            strokeThickness,
                            fill,
                            x1, x2, y1, y2,
                            isEditable: !isDrawingLockMode,
                            isSelected: false,
                            annotationLayer: "Background", // Set annotation layer to Background
                            onDrag: () => {
                                // Just invalidate during drag
                                targetSurface.invalidateElement();
                            },
                            onDragEnded: () => {
                                // Store original handler
                                const originalOnDragEnded = newAnnotation.onDragEnded;
                                
                                // Create handler that properly updates all charts
                                setTimeout(() => {
                                    // console.log(`Handler: Box drag ended on ${tf} chart for propagated annotation (from creation)`);
                                    handleAnnotationUpdated(newAnnotation, tf, ws, clientId, instrument, isAllTimeframes, arrowDirection, timeframes, sciChartSurfaceRefs);
                                }, 0);
                            }
                        });
                    } else if (annotation.type === "LineAnnotation" || annotation.type === "RenderContextLineAnnotation") {
                        const { stroke, strokeThickness, x1, y1, x2, y2, strokeDashArray } = annotation;
                        newAnnotation = new LineAnnotation({
                            id: annotation.id,
                            stroke,
                            strokeThickness,
                            strokeDashArray,
                            x1, y1, x2, y2,
                            isEditable: !isDrawingLockMode,
                            isSelected: false,
                            xAxisId: 'xAxis',
                            yAxisId: 'yAxis',
                            onDrag: () => {
                                // Just invalidate the element during drag
                                targetSurface.invalidateElement();
                            },
                            onDragEnded: () => {
                                // Store original handler
                                const originalOnDragEnded = newAnnotation.onDragEnded;
                                
                                // Create handler that properly updates all charts
                                setTimeout(() => {
                                    // console.log(`Handler: Trendline drag ended on ${tf} chart for propagated annotation (from creation)`);
                                    handleAnnotationUpdated(newAnnotation, tf, ws, clientId, instrument, isAllTimeframes, arrowDirection, timeframes, sciChartSurfaceRefs);
                                }, 0);
                            }
                        });
                    } else if (annotation.type === "SVGCustomAnnotation") {
                        // This is an arrow annotation
                        if (annotype === 'arrow') {
                            // Get the anchor points based on direction from the original annotation
                            // console.log('Attempting to replicate arrow annotation...');
                            const anchorPoints = getArrowAnchorPoints(arrowDirection);
                            
                            // Create a new arrow annotation
                            newAnnotation = new CustomAnnotation({
                                id: annotation.id,
                                x1: annotation.x1,
                                y1: annotation.y1,
                                svgString: annotation.svgString,
                                horizontalAnchorPoint: anchorPoints.horizontalAnchorPoint,
                                verticalAnchorPoint: anchorPoints.verticalAnchorPoint,
                                xAxisId: 'xAxis',
                                yAxisId: 'yAxis',
                                isEditable: !isDrawingLockMode,
                                onDrag: () => {
                                    // Just invalidate the element during drag
                                    targetSurface.invalidateElement();
                                },
                                onDragEnded: () => {
                                    // Call the update handler when arrow drag is finished
                                    // console.log(`Handler: Arrow drag ended on ${tf} chart for propagated annotation (from creation)`);
                                    handleAnnotationUpdated(newAnnotation, tf, ws, clientId, instrument, isAllTimeframes, arrowDirection, timeframes, sciChartSurfaceRefs);
                                }
                            });
                        } else {
                            console.warn(`Unknown custom annotation type: ${annotype}...brace for error!`);
                        }
                    } else if (annotation.type === "NativeTextAnnotation" || annotation.type === "RenderContextNativeTextAnnotation") {
                        const { x1, y1, text, textColor, fontSize, fontWeight, horizontalAnchorPoint, verticalAnchorPoint } = annotation;
                        
                        // Create a new text annotation
                        newAnnotation = new NativeTextAnnotation({
                            id: annotation.id,
                            x1,
                            y1,
                            text,
                            textColor,
                            backgroundColor: 'transparent',
                            fontSize: fontSize || 14,
                            fontWeight: fontWeight || 'bold',
                            horizontalAnchorPoint: horizontalAnchorPoint || 'Center',
                            verticalAnchorPoint: verticalAnchorPoint || 'Center',
                            xAxisId: 'xAxis',
                            yAxisId: 'yAxis',
                            isEditable: !isDrawingLockMode,
                            onDrag: () => {
                                // Just invalidate the element during drag
                                targetSurface.invalidateElement();
                            },
                            onDragEnded: () => {
                                // Call the update handler when text annotation drag is finished
                                console.log(`Handler: Text annotation drag ended on ${tf} chart for propagated annotation (from creation)`);
                                handleAnnotationUpdated(newAnnotation, tf, ws, clientId, instrument, isAllTimeframes, arrowDirection, timeframes, sciChartSurfaceRefs);
                            }
                        });
                    } else{
                        console.warn(`Unknown annotation type: ${annotation.type}...brace for error!`);       
                    }
                    
                    // Add the new annotation to the target chart
                    targetSurface.annotations.add(newAnnotation);
                    targetSurface.invalidateElement();
                    console.log(`Created ${annotation.type} with ID ${annotation.id} on ${tf} chart`);
                });
            }
        } catch (error) {
            console.error('Error handling annotation creation:', error);
        }
    }
};

// Handler for annotation updates
export const handleAnnotationUpdated = (annotation, timeframe, ws, clientId, instrument, isAllTimeframes, arrowDirection, timeframes, sciChartSurfaceRefs, isDrawingLockMode = false) => {
    // Apply drawing lock mode to the annotation being updated
    if (annotation.isEditable !== !isDrawingLockMode) {
        annotation.isEditable = !isDrawingLockMode;
        sciChartSurfaceRefs.current[timeframe].invalidateElement();
    }
    
    console.log(`Annotation Updated on ${timeframe} chart:`, annotation.type, 'ID:', annotation.id);

    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            // Parse the annotation ID to get components
            const idParts = annotation.id.split('/');
            const clientid = idParts[0];
            const instrument = idParts[1];
            const annotationTimeframe = idParts[2];
            const annotype = idParts[3];
            const unique = idParts[4];
            
            // Create the update message
            const message = {
                action: "save_anno",
                clientid: clientid,
                instrument: instrument,
                timeframe: annotationTimeframe,
                annotype: annotype,
                unique: unique,
                object: getAnnotationProperties(annotation)
            };
            
            // Send the message
            ws.send(JSON.stringify(message));
            console.log('Sent annotation update message:', message);
            
            // If this is an "all" timeframe annotation, update it on all other charts too
            if (annotationTimeframe === "all") {
                console.log('Propagating update of "all" timeframe annotation to other charts');
                
                // Go through all timeframes
                timeframes.forEach(tf => {
                    // Skip the original timeframe where the annotation was updated
                    if (tf === timeframe) return;
                    
                    // Get the chart surface for this timeframe
                    const targetSurface = sciChartSurfaceRefs.current[tf];
                    if (!targetSurface) {
                        console.warn(`Cannot update annotation on ${tf} chart: Surface not found`);
                        return;
                    }
                    
                    // Find the annotation with this ID on the target chart
                    const existingAnnotation = targetSurface.annotations.asArray().find(anno => anno.id === annotation.id);
                    if (!existingAnnotation) {
                        console.warn(`Annotation with ID ${annotation.id} not found on ${tf} chart for update`);
                        return;
                    }
                    
                    // Apply drawing lock mode to this annotation as well
                    if (existingAnnotation.isEditable !== !isDrawingLockMode) {
                        existingAnnotation.isEditable = !isDrawingLockMode;
                    }
                    
                    // Check annotation type and update properties accordingly
                    if (annotype === 'hline') {
                        existingAnnotation.y1 = annotation.y1;
                        existingAnnotation.stroke = annotation.stroke;
                        existingAnnotation.strokeDashArray = annotation.strokeDashArray;
                        existingAnnotation.showLabel = annotation.showLabel;
                        existingAnnotation.labelValue = annotation.labelValue;
                            
                        existingAnnotation.axisLabelFill = annotation.stroke;
                        existingAnnotation.axisLabelStroke = getReadableTextColor(annotation.stroke);
                        
                        // Update the onDrag handler to ensure label is updated during drag
                        existingAnnotation.onDrag = () => {
                            // Update label value during drag to match current y1 value
                            existingAnnotation.labelValue = existingAnnotation.y1.toFixed(2);
                            targetSurface.invalidateElement();
                        };
                        
                        // Only attach the handler if it doesn't already have our custom handler
                        if (!existingAnnotation._hasCustomUpdateHandler) {
                            // Store the original onDragEnded handler
                            const originalOnDragEnded = existingAnnotation.onDragEnded;
                            
                            // Create a new handler that calls the original and then our code
                            existingAnnotation.onDragEnded = function(...args) {
                                // First call the original handler if it exists to maintain proper mouse release
                                if (typeof originalOnDragEnded === 'function') {
                                    originalOnDragEnded.apply(this, args);
                                }
                                
                                // After a short delay to allow the mouse to be released first
                                setTimeout(() => {
                                    console.log(`Handler: Line drag ended on ${tf} chart for propagated annotation`);
                                    handleAnnotationUpdated(existingAnnotation, tf, ws, clientId, instrument, isAllTimeframes, arrowDirection, timeframes, sciChartSurfaceRefs);
                                }, 0);
                            };
                            
                            // Mark this annotation as having our custom handler
                            existingAnnotation._hasCustomUpdateHandler = true;
                        }
                    } else if (annotype === 'box') {
                        existingAnnotation.x1 = annotation.x1;
                        existingAnnotation.y1 = annotation.y1;
                        existingAnnotation.x2 = annotation.x2;
                        existingAnnotation.y2 = annotation.y2;
                        existingAnnotation.fill = annotation.fill;
                        existingAnnotation.annotationLayer = "Background"; // Ensure annotationLayer is set to Background
                        
                        // Only attach the handler if it doesn't already have our custom handler
                        if (!existingAnnotation._hasCustomUpdateHandler) {
                            // Store the original onDragEnded handler
                            const originalOnDragEnded = existingAnnotation.onDragEnded;
                            
                            // Create a new handler that calls the original and then our code
                            existingAnnotation.onDragEnded = function(...args) {
                                // First call the original handler if it exists to maintain proper mouse release
                                if (typeof originalOnDragEnded === 'function') {
                                    originalOnDragEnded.apply(this, args);
                                }
                                
                                // After a short delay to allow the mouse to be released first
                                setTimeout(() => {
                                    console.log(`Handler: Box drag ended on ${tf} chart for propagated annotation`);
                                    handleAnnotationUpdated(existingAnnotation, tf, ws, clientId, instrument, isAllTimeframes, arrowDirection, timeframes, sciChartSurfaceRefs);
                                }, 0);
                            };
                            
                            // Mark this annotation as having our custom handler
                            existingAnnotation._hasCustomUpdateHandler = true;
                        }
                    } else if (annotype === 'tline') {
                        existingAnnotation.x1 = annotation.x1;
                        existingAnnotation.y1 = annotation.y1;
                        existingAnnotation.x2 = annotation.x2;
                        existingAnnotation.y2 = annotation.y2;
                        existingAnnotation.strokeDashArray = annotation.strokeDashArray;
                        
                        // Only attach the handler if it doesn't already have our custom handler
                        if (!existingAnnotation._hasCustomUpdateHandler) {
                            // Store the original onDragEnded handler
                            const originalOnDragEnded = existingAnnotation.onDragEnded;
                            
                            // Create a new handler that calls the original and then our code
                            existingAnnotation.onDragEnded = function(...args) {
                                // First call the original handler if it exists to maintain proper mouse release
                                if (typeof originalOnDragEnded === 'function') {
                                    originalOnDragEnded.apply(this, args);
                                }
                                
                                // After a short delay to allow the mouse to be released first
                                setTimeout(() => {
                                    console.log(`Handler: Trendline drag ended on ${tf} chart for propagated annotation`);
                                    handleAnnotationUpdated(existingAnnotation, tf, ws, clientId, instrument, isAllTimeframes, arrowDirection, timeframes, sciChartSurfaceRefs);
                                }, 0);
                            };
                            
                            // Mark this annotation as having our custom handler
                            existingAnnotation._hasCustomUpdateHandler = true;
                        }
                    } else if (annotype === 'arrow') {
                        existingAnnotation.x1 = annotation.x1;
                        existingAnnotation.y1 = annotation.y1;
                        existingAnnotation.svgString = annotation.svgString;
                        existingAnnotation.horizontalAnchorPoint = annotation.horizontalAnchorPoint;
                        existingAnnotation.verticalAnchorPoint = annotation.verticalAnchorPoint;
                        
                        // Only attach the handler if it doesn't already have our custom handler
                        if (!existingAnnotation._hasCustomUpdateHandler) {
                            // Store the original onDragEnded handler
                            const originalOnDragEnded = existingAnnotation.onDragEnded;
                            
                            // Create a new handler that calls the original and then our code
                            existingAnnotation.onDragEnded = function(...args) {
                                // First call the original handler if it exists to maintain proper mouse release
                                if (typeof originalOnDragEnded === 'function') {
                                    originalOnDragEnded.apply(this, args);
                                }
                                
                                // After a short delay to allow the mouse to be released first
                                setTimeout(() => {
                                    console.log(`Handler: Arrow drag ended on ${tf} chart for propagated annotation`);
                                    handleAnnotationUpdated(existingAnnotation, tf, ws, clientId, instrument, isAllTimeframes, arrowDirection, timeframes, sciChartSurfaceRefs);
                                }, 0);
                            };
                            
                            // Mark this annotation as having our custom handler
                            existingAnnotation._hasCustomUpdateHandler = true;
                        }
                    } else if (annotype === 'text') {
                        // Update text annotation properties
                        existingAnnotation.x1 = annotation.x1;
                        existingAnnotation.y1 = annotation.y1;
                        existingAnnotation.text = annotation.text;
                        existingAnnotation.textColor = annotation.textColor;
                        existingAnnotation.fontSize = annotation.fontSize;
                        existingAnnotation.fontWeight = annotation.fontWeight;
                        existingAnnotation.horizontalAnchorPoint = annotation.horizontalAnchorPoint;
                        existingAnnotation.verticalAnchorPoint = annotation.verticalAnchorPoint;
                        
                        // Only attach the handler if it doesn't already have our custom handler
                        if (!existingAnnotation._hasCustomUpdateHandler) {
                            // Store the original onDragEnded handler
                            const originalOnDragEnded = existingAnnotation.onDragEnded;
                            
                            // Create a new handler that calls the original and then our code
                            existingAnnotation.onDragEnded = function(...args) {
                                // First call the original handler if it exists to maintain proper mouse release
                                if (typeof originalOnDragEnded === 'function') {
                                    originalOnDragEnded.apply(this, args);
                                }
                                
                                // After a short delay to allow the mouse to be released first
                                setTimeout(() => {
                                    console.log(`Handler: Text annotation drag ended on ${tf} chart for propagated annotation`);
                                    handleAnnotationUpdated(existingAnnotation, tf, ws, clientId, instrument, isAllTimeframes, arrowDirection, timeframes, sciChartSurfaceRefs);
                                }, 0);
                            };
                            
                            // Mark this annotation as having our custom handler
                            existingAnnotation._hasCustomUpdateHandler = true;
                        }
                    }
                    
                    targetSurface.invalidateElement();
                });
            }
        } catch (error) {
            console.error('Error handling annotation update:', error);
        }
    }
};

// Handler for annotation deletion
export const handleAnnotationDeleted = (annotation, timeframe, ws, timeframes, sciChartSurfaceRefs) => {
    console.log(`Annotation Deleted on ${timeframe} chart:`, annotation.type, 'ID:', annotation.id);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            // Parse the annotation ID to get components
            const idParts = annotation.id.split('/');
            const clientid = idParts[0];
            const instrument = idParts[1];
            const annotationTimeframe = idParts[2];
            const annotype = idParts[3];
            const unique = idParts[4];
            
            // Create the deletion message
            const message = {
                action: "delete_anno",
                clientid: clientid,
                unique: unique,
            };
            
            // Send the message
            ws.send(JSON.stringify(message));
            console.log('Sent annotation deletion message:', message);
            
            // If this is an "all" timeframe annotation, delete it from all other charts too
            if (annotationTimeframe === "all") {
                console.log('Propagating deletion of "all" timeframe annotation to other charts');
                
                // Go through all timeframes
                timeframes.forEach(tf => {
                    // Skip the original timeframe where the annotation was deleted
                    if (tf === timeframe) return;
                    
                    // Get the chart surface for this timeframe
                    const targetSurface = sciChartSurfaceRefs.current[tf];
                    if (!targetSurface) {
                        console.warn(`Cannot delete annotation from ${tf} chart: Surface not found`);
                        return;
                    }
                    
                    // Find and remove the annotation with this ID from the target chart
                    const existingAnnotation = targetSurface.annotations.asArray().find(anno => anno.id === annotation.id);
                    if (existingAnnotation) {
                        console.log(`Removing annotation with ID ${annotation.id} from ${tf} chart`);
                        // CRITICAL FIX: Call delete() method on annotation to free WebGL resources
                        if (typeof existingAnnotation.delete === 'function') {
                            try {
                                existingAnnotation.delete();
                            } catch (error) {
                                console.warn(`Error calling delete() on annotation during deletion: ${error.message}`);
                            }
                        }
                        targetSurface.annotations.remove(existingAnnotation);
                        targetSurface.invalidateElement();
                    } else {
                        console.log(`Annotation with ID ${annotation.id} not found on ${tf} chart`);
                    }
                });
            }
        } catch (error) {
            console.error('Error handling annotation deletion:', error);
        }
    }
}; 