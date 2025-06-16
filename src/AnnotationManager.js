import React, { useState, useEffect } from 'react';
import './AnnotationManager.css';
import annoIcon from './images/annomgr-icon.png';

const AnnotationManager = ({ sciChartSurfaceRefs, timeframes, onClose, ws, clientId }) => {
    const [annotations, setAnnotations] = useState([]);
    const [selectedAnnotations, setSelectedAnnotations] = useState(new Set());
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState('');
    const [deleteAction, setDeleteAction] = useState(null);

    // Function to format x1 as a date string
    const formatX1AsDate = (x1) => {
        if (!x1 || isNaN(x1)) return "N/A";
        try {
            const date = new Date(x1);
            if (isNaN(date.getTime())) return "Invalid date";
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        } catch (e) {
            console.error("Error formatting x1 as date:", e);
            return "Format error";
        }
    };

    // Extract color from SVG string
    const extractColorFromSvg = (svgString) => {
        if (!svgString) return "#FFFFFF";
        
        try {
            // Extract fill attribute using regex
            const fillMatch = svgString.match(/fill="([^"]+)"/);
            if (fillMatch && fillMatch[1]) {
                return fillMatch[1];
            }
            return "#FFFFFF"; // Default white if not found
        } catch (e) {
            console.error("Error extracting color from SVG:", e);
            return "#FFFFFF";
        }
    };

    // Toggle annotation selection
    const toggleSelection = (id) => {
        setSelectedAnnotations(prevSelected => {
            const newSelected = new Set(prevSelected);
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
            return newSelected;
        });
    };

    // Check if an annotation belongs to the current client
    const isCurrentClientAnnotation = (annotationClientId) => {
        // Account for the format "quatrain-clientId"
        const fullClientId = clientId.startsWith('quatrain-') ? clientId : `quatrain-${clientId}`;
        return annotationClientId === fullClientId;
    };

    // Show confirmation dialog for delete actions
    const confirmDelete = (isAll) => {
        if (isAll) {
            setConfirmationMessage("ALL Annotations will be deleted!");
            setDeleteAction(() => deleteAllAnnotations);
        } else {
            if (selectedAnnotations.size === 0) return; // Don't show dialog if nothing is selected
            setConfirmationMessage("Selected Annotations will be deleted.");
            setDeleteAction(() => deleteSelectedAnnotations);
        }
        setShowConfirmation(true);
    };

    // Delete a single annotation from all charts and server
    const deleteAnnotation = (annotationId) => {
        // Parse the ID to get components
        const idParts = annotationId.split('/');
        if (idParts.length !== 5) {
            console.error("Invalid annotation ID format:", annotationId);
            return;
        }

        const annotationClientId = idParts[0];
        const annotationTimeframe = idParts[2];
        const uniqueId = idParts[4];

        // Only allow deletion of own annotations
        if (!isCurrentClientAnnotation(annotationClientId)) {
            console.warn(`Cannot delete annotation from client ${annotationClientId} - belongs to another client`);
            return;
        }

        console.log(`Deleting annotation with ID: ${annotationId}`);

        if (annotationTimeframe === "all") {
            // Handle "all" timeframe annotation (delete from all charts)
            timeframes.forEach(tf => {
                const chartSurface = sciChartSurfaceRefs.current[tf];
                if (chartSurface) {
                    const existingAnnotation = chartSurface.annotations.asArray().find(anno => anno.id === annotationId);
                    if (existingAnnotation) {
                        // Remove any custom handlers that might be attached
                        if (existingAnnotation._hasCustomUpdateHandler) {
                            existingAnnotation._hasCustomUpdateHandler = false;
                            existingAnnotation.onDragEnded = null;
                        }
                        // CRITICAL FIX: Call delete() method on annotation to free WebGL resources
                        if (typeof existingAnnotation.delete === 'function') {
                            try {
                                existingAnnotation.delete();
                            } catch (error) {
                                console.warn(`Error calling delete() on annotation: ${error.message}`);
                            }
                        }
                        chartSurface.annotations.remove(existingAnnotation);
                        chartSurface.invalidateElement();
                    }
                }
            });
        } else {
            // Handle regular timeframe annotation (delete from specific chart)
            const chartSurface = sciChartSurfaceRefs.current[annotationTimeframe];
            if (chartSurface) {
                const existingAnnotation = chartSurface.annotations.asArray().find(anno => anno.id === annotationId);
                if (existingAnnotation) {
                    // Remove any custom handlers that might be attached
                    if (existingAnnotation._hasCustomUpdateHandler) {
                        existingAnnotation._hasCustomUpdateHandler = false;
                        existingAnnotation.onDragEnded = null;
                    }
                    // CRITICAL FIX: Call delete() method on annotation to free WebGL resources
                    if (typeof existingAnnotation.delete === 'function') {
                        try {
                            existingAnnotation.delete();
                        } catch (error) {
                            console.warn(`Error calling delete() on annotation: ${error.message}`);
                        }
                    }
                    chartSurface.annotations.remove(existingAnnotation);
                    chartSurface.invalidateElement();
                }
            }
        }

        // Send delete request to the server
        if (ws && ws.readyState === WebSocket.OPEN) {
            const message = {
                action: "delete_anno",
                clientid: annotationClientId,
                unique: uniqueId,
            };
            
            ws.send(JSON.stringify(message));
            console.log('Sent annotation deletion message:', message);
        } else {
            console.warn("WebSocket not available or not open");
        }
    };

    // Delete selected annotations
    const deleteSelectedAnnotations = () => {
        if (selectedAnnotations.size === 0) return;
        
        // Create a copy to avoid issues while iterating and deleting
        const annotationsToDelete = [...selectedAnnotations];
        
        // Delete each selected annotation
        annotationsToDelete.forEach(id => {
            deleteAnnotation(id);
        });
        
        // Clear the selection
        setSelectedAnnotations(new Set());
        
        // Refresh the annotation list
        refreshAnnotationList();
    };

    // Delete all annotations
    const deleteAllAnnotations = () => {
        if (annotations.length === 0) return;
        
        // Only delete annotations that belong to the current client
        const clientAnnotations = annotations.filter(annotation => 
            isCurrentClientAnnotation(annotation.clientId)
        );
        
        // Delete each annotation from this client
        clientAnnotations.forEach(annotation => {
            deleteAnnotation(annotation.id);
        });
        
        // Clear the selection
        setSelectedAnnotations(new Set());
        
        // Refresh the annotation list
        refreshAnnotationList();
    };

    // Refresh the annotation list after deletions
    const refreshAnnotationList = () => {
        // Force refresh by re-running the effect
        // This will collect annotations again from all charts
        setAnnotations([]);
        setTimeout(() => {
            // Re-run the effect to refresh the list
            if (sciChartSurfaceRefs && sciChartSurfaceRefs.current) {
                collectAnnotations();
            }
        }, 100);
    };

    // Collect annotations from all chart surfaces
    const collectAnnotations = () => {
        if (!sciChartSurfaceRefs || !sciChartSurfaceRefs.current) return;
        
        const allAnnotations = [];
        const annotationIds = new Set(); // For de-duplication
        
        // Loop through each timeframe
        timeframes.forEach(timeframe => {
            const chartSurface = sciChartSurfaceRefs.current[timeframe];
            if (!chartSurface) return;
            
            // Get all annotations from this chart
            const chartAnnotations = chartSurface.annotations.asArray();
            
            // Add each annotation to the list if it's not a duplicate
            chartAnnotations.forEach(annotation => {
                // Check if this annotation is one of "our" annotations by validating the ID format
                // Expected format: clientid/instrument/timeframe/annotype/uniqueid
                const isValidFormat = annotation.id && 
                                      typeof annotation.id === 'string' && 
                                      annotation.id.split('/').length === 5;
                
                // Skip this annotation if it doesn't follow our ID format
                if (!isValidFormat) return;
                
                // Only add if we haven't seen this ID before
                // For "all" timeframe annotations, we'll only include them once
                if (!annotationIds.has(annotation.id)) {
                    annotationIds.add(annotation.id);
                    
                    // Parse the annotation ID to get components
                    const idParts = annotation.id.split('/');
                    const annotationClientId = idParts[0];
                    const instrument = idParts[1];
                    const annotationTimeframe = idParts[2];
                    const annotype = idParts[3];
                    const uniqueId = idParts[4];
                    
                    const isAllTimeframe = annotationTimeframe === 'all';
                    
                    // Check if this is a strategy annotation
                    const isStrategyAnnotation = annotationClientId.startsWith('strategy');
                    const isCurrentClient = isCurrentClientAnnotation(annotationClientId);
                    
                    // Try to extract creation timestamp from the unique part
                    let createdAt = null;
                    if (uniqueId && uniqueId.length > 8) {  // Check if it might contain a timestamp
                        try {
                            // The first part of the unique ID is often a timestamp in base36
                            const timestampPart = uniqueId.split('').slice(0, 8).join('');
                            const timestamp = parseInt(timestampPart, 36);
                            if (!isNaN(timestamp) && timestamp > 0) {
                                createdAt = new Date(timestamp);
                            }
                        } catch (e) {
                            console.log('Could not parse timestamp from unique ID');
                        }
                    }
                    
                    // Get the color of the annotation
                    let color = "#FFFFFF"; // Default color
                    if (annotation.type === "SVGCustomAnnotation") {
                        // Extract color from SVG string for arrow annotations
                        color = extractColorFromSvg(annotation.svgString);
                    } else if (annotation.type === "NativeTextAnnotation" || annotation.type === "RenderContextNativeTextAnnotation") {
                        // For text annotations, use the textColor property
                        color = annotation.textColor || "#FFFFFF";
                    } else {
                        // For other annotation types, use the stroke color
                        color = annotation.stroke || "#FFFFFF";
                    }
                    
                    allAnnotations.push({
                        id: annotation.id,
                        type: annotation.type,
                        clientId: annotationClientId,
                        instrument,
                        annotype,
                        timeframe: isAllTimeframe ? 'all' : timeframe,
                        isAllTimeframe,
                        createdAt,
                        x1: annotation.x1,
                        y1: annotation.y1,
                        color: color,
                        isCurrentClient: isCurrentClient,
                        isStrategyAnnotation: isStrategyAnnotation
                    });
                }
            });
        });
        
        // Sort annotations: client annotations first, then by timeframe and type
        allAnnotations.sort((a, b) => {
            // First sort by annotation type (client vs strategy)
            if (a.isStrategyAnnotation !== b.isStrategyAnnotation) {
                return a.isStrategyAnnotation ? 1 : -1; // Client annotations first
            }
            
            // For annotations of the same type, sort by timeframe
            if (a.isAllTimeframe !== b.isAllTimeframe) {
                return a.isAllTimeframe ? -1 : 1; // All timeframe annotations first
            }
            if (a.timeframe !== b.timeframe) {
                return a.timeframe.localeCompare(b.timeframe);
            }
            return a.type.localeCompare(b.type);
        });
        
        setAnnotations(allAnnotations);
    };

    // Collect annotations when the component mounts
    useEffect(() => {
        collectAnnotations();
    }, [sciChartSurfaceRefs, timeframes]);

    return (
        <div className="annotation-manager-overlay">
            <div className="annotation-manager-panel">
                <div className="annotation-manager-header">
                    <div className="header-title">
                        <img 
                            src={annoIcon} 
                            alt="Annotation Manager" 
                            className="annotation-manager-icon" 
                            width="30" 
                        />
                        <h2>Annotation Manager</h2>
                    </div>
                    <button className="close-button" onClick={onClose}>
                        X
                    </button>
                </div>
                <div className="annotation-manager-content">
                    {annotations.length === 0 ? (
                        <div className="no-annotations">No annotations found</div>
                    ) : (
                        <div className="annotation-list">
                            {annotations.map((annotation, index) => (
                                <div 
                                    key={index} 
                                    className={`annotation-entry ${annotation.isStrategyAnnotation ? 'strategy-annotation' : ''}`}
                                    data-type={annotation.type}
                                    style={{ borderLeftColor: annotation.color }}
                                >
                                    {annotation.isStrategyAnnotation ? (
                                        // Compact display for strategy annotations
                                        <>
                                            <div className="annotation-type-container compact">
                                                <div className="annotation-type">
                                                    {(() => {
                                                        // Convert annotation type to user-friendly name
                                                        if (annotation.type === "HorizontalLineAnnotation" || 
                                                            annotation.type === "RenderContextHorizontalLineAnnotation") {
                                                            return "Horizontal Line";
                                                        } else if (annotation.type === "BoxAnnotation" || 
                                                                annotation.type === "RenderContextBoxAnnotation") {
                                                            return "Box";
                                                        } else if (annotation.type === "LineAnnotation" || 
                                                                annotation.type === "RenderContextLineAnnotation") {
                                                            return "Trend Line";
                                                        } else if (annotation.type === "SVGCustomAnnotation") {
                                                            return "Arrow";
                                                        } else if (annotation.type === "NativeTextAnnotation" || 
                                                                annotation.type === "RenderContextNativeTextAnnotation") {
                                                            return "Text";
                                                        } else {
                                                            return annotation.type;
                                                        }
                                                    })()}
                                                    <span className="timeframe-indicator">
                                                        {annotation.timeframe === 'all' ? 'ALL' : annotation.timeframe}
                                                    </span>
                                                    <span className="strategy-indicator">
                                                        {annotation.clientId}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="annotation-details compact">
                                                <div className="annotation-id">{annotation.id}</div>
                                            </div>
                                            <div className="annotation-select">
                                                {/* Strategy annotations are not selectable */}
                                            </div>
                                        </>
                                    ) : (
                                        // Full display for client annotations
                                        <>
                                            <div className="annotation-type-container">
                                                <div className="annotation-type">
                                                    {(() => {
                                                        // Convert annotation type to user-friendly name
                                                        if (annotation.type === "HorizontalLineAnnotation" || 
                                                            annotation.type === "RenderContextHorizontalLineAnnotation") {
                                                            return "Horizontal Line";
                                                        } else if (annotation.type === "BoxAnnotation" || 
                                                                annotation.type === "RenderContextBoxAnnotation") {
                                                            return "Box";
                                                        } else if (annotation.type === "LineAnnotation" || 
                                                                annotation.type === "RenderContextLineAnnotation") {
                                                            return "Trend Line";
                                                        } else if (annotation.type === "SVGCustomAnnotation") {
                                                            return "Arrow";
                                                        } else if (annotation.type === "NativeTextAnnotation" || 
                                                                annotation.type === "RenderContextNativeTextAnnotation") {
                                                            return "Text";
                                                        } else {
                                                            return annotation.type;
                                                        }
                                                    })()}
                                                    <span className="timeframe-indicator">
                                                        {annotation.timeframe === 'all' ? 'ALL' : annotation.timeframe}
                                                    </span>
                                                </div>
                                                <div className="annotation-coordinates">
                                                    x1: {annotation.x1 !== undefined ? formatX1AsDate(annotation.x1) : "n/a"} / y1: {annotation.y1 !== undefined ? annotation.y1.toFixed(2) : "n/a"}
                                                </div>
                                                {annotation.createdAt && (
                                                    <div className="annotation-date">
                                                        {annotation.createdAt.toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="annotation-details">
                                                <div className="annotation-meta">
                                                    <span>Client: {annotation.clientId}</span>
                                                    <span>Instrument: {annotation.instrument}</span>
                                                    <span>Type: {annotation.annotype}</span>
                                                </div>
                                                <div className="annotation-id">{annotation.id}</div>
                                            </div>
                                            <div className="annotation-select">
                                                {annotation.isCurrentClient && (
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedAnnotations.has(annotation.id)}
                                                        onChange={() => toggleSelection(annotation.id)} 
                                                    />
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="annotation-controls">
                    <div className="control-buttons">
                        <button 
                            className="delete-button" 
                            onClick={() => confirmDelete(false)}
                            disabled={selectedAnnotations.size === 0}
                        >
                            Delete Selected
                        </button>
                        <button 
                            className="delete-all-button" 
                            onClick={() => confirmDelete(true)}
                            disabled={!annotations.some(a => a.isCurrentClient)}
                        >
                            Delete ALL
                        </button>
                    </div>
                    <div className="selection-status">
                        {selectedAnnotations.size > 0 ? 
                            `${selectedAnnotations.size} selected` : 
                            'None selected'}
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog */}
            {showConfirmation && (
                <div className="confirmation-dialog-overlay">
                    <div className="confirmation-dialog">
                        <div className="confirmation-message">
                            {confirmationMessage}
                        </div>
                        <div className="confirmation-buttons">
                            <button 
                                className="cancel-button"
                                onClick={() => setShowConfirmation(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                className="confirm-button"
                                onClick={() => {
                                    if (deleteAction) deleteAction();
                                    setShowConfirmation(false);
                                }}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnnotationManager; 