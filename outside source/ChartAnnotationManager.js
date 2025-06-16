/**
 * ChartAnnotationManager.js
 * 
 * A class-based API for simplified chart annotation management.
 * This manager handles the creation, modification, and deletion of 
 * chart annotations by generating the appropriate WebSocket messages
 * to communicate with the Chronicle server.
 */

class ChartAnnotationManager {
    /**
     * Create a new ChartAnnotationManager
     * @param {WebSocket} websocket - The WebSocket connection to the Chronicle server
     * @param {string} clientId - The client identifier for annotations
     * @param {string} instrument - Default instrument for annotations
     */
    constructor(websocket, clientId, instrument = 'default') {
        this.ws = websocket;
        this.clientId = clientId;
        this.instrument = instrument;
    }

    /**
     * Set the default instrument
     * @param {string} instrument - The instrument identifier
     */
    setInstrument(instrument) {
        this.instrument = instrument;
    }

    /**
     * Generate a unique ID for an annotation
     * Follows the same pattern used in the application
     * @param {string} timeframe - The timeframe for the annotation
     * @param {string} [type='generic'] - The type of annotation
     * @returns {string} A unique identifier
     */
    generateUniqueId(timeframe, type = 'generic') {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000000);
        return `${timestamp.toString(36)}${random.toString(36)}`.substring(0, 12);
    }

    /**
     * Create a new annotation with specified parameters
     * @param {Object} params - The annotation parameters
     * @param {string} params.type - The annotation type (arrow, tline, box, hline)
     * @param {string} params.timeframe - The timeframe (1m, 5m, 15m, 1h, or 'all')
     * @param {Object} params.properties - The annotation-specific properties
     * @returns {Object} The created annotation data
     */
    createAnnotation(params) {
        const { type, timeframe = 'all', properties } = params;
        const uniqueId = this.generateUniqueId(timeframe, type);
        
        const annotationData = this._buildAnnotationObject(type, {
            ...properties,
            uniqueId,
            timeframe
        });
        
        this._sendToWebSocket('save_anno', annotationData);
        return annotationData;
    }

    /**
     * Update an existing annotation
     * @param {Object} annotation - The annotation object to update
     * @param {Object} updates - The properties to update
     * @returns {Object} The updated annotation data
     */
    updateAnnotation(annotation, updates) {
        console.log(`Updating annotation:`, annotation.unique);
        
        // Apply updates to the annotation object
        Object.assign(annotation.object, updates);
        
        // Send the updated annotation to the server
        this._sendToWebSocket('save_anno', annotation);
        
        // Return the updated annotation
        return annotation;
    }

    /**
     * Delete an annotation
     * @param {Object} annotation - The annotation object to delete
     * @returns {null} Returns null to indicate deletion
     */
    deleteAnnotation(annotation) {
        console.log(`Deleting annotation:`, annotation.unique);
        
        const request = {
            clientid: this.clientId,
            unique: annotation.unique
        };
        
        this._sendToWebSocket('delete_anno', request);
        return null;
    }

    /**
     * Create an arrow annotation
     * @param {number} time - The time value (x-coordinate) as timestamp
     * @param {number} price - The price value (y-coordinate)
     * @param {string} direction - The arrow direction ('up', 'down', 'left', 'right')
     * @param {string} color - The arrow color (CSS color value)
     * @param {string} [timeframe='all'] - The timeframe for the annotation
     * @param {string} [size='M'] - The arrow size ('XS', 'S', 'M', 'L', 'XL')
     * @param {string} [style='triangle'] - The arrow style ('triangle', 'arrow')
     * @returns {Object} The created annotation data
     */
    createArrow(time, price, direction, color, timeframe = 'all', size = 'M', style = 'triangle') {
        const uniqueId = this.generateUniqueId(timeframe, 'arrow');
        const id = `${this.clientId}/${this.instrument}/${timeframe}/arrow/${uniqueId}`;
        
        // Generate SVG string including color and get anchor points as string values
        const { svgString, horizontalAnchorPoint, verticalAnchorPoint } = this._createArrowSvg(direction, size, style, color);
        
        const annotationData = {
            clientid: this.clientId,
            instrument: this.instrument,
            timeframe: timeframe,
            annotype: 'arrow',
            unique: uniqueId,
            object: {
                id: id,
                type: 'SVGCustomAnnotation',
                x1: time,
                y1: price,
                svgString: svgString,
                horizontalAnchorPoint: horizontalAnchorPoint,
                verticalAnchorPoint: verticalAnchorPoint
            }
        };
        
        this._sendToWebSocket('save_anno', annotationData);
        return annotationData;
    }

    /**
     * Create a horizontal line annotation
     * @param {number} price - The price level (y-coordinate)
     * @param {string} color - The line color (CSS color value)
     * @param {string} [timeframe='all'] - The timeframe for the annotation
     * @param {string} [lineType='solid'] - The line style ('solid', 'dash', 'dot', 'dash-dot')
     * @param {boolean} [showLabel=false] - Whether to show a label
     * @param {number} [startTime=null] - Optional start time value (x1-coordinate) as timestamp
     * @returns {Object} The created annotation data
     */
    createHorizontalLine(price, color, timeframe = 'all', lineType = 'solid', showLabel = false, startTime = null) {
        const uniqueId = this.generateUniqueId(timeframe, 'hline');
        const id = `${this.clientId}/${this.instrument}/${timeframe}/hline/${uniqueId}`;
        
        // Format the price for the label
        const formattedPrice = parseFloat(price).toFixed(2);
        
        const annotationData = {
            clientid: this.clientId,
            instrument: this.instrument,
            timeframe: timeframe,
            annotype: 'hline',
            unique: uniqueId,
            object: {
                id: id,
                type: 'RenderContextHorizontalLineAnnotation',
                stroke: color,
                strokeThickness: 2,
                y1: price,
                strokeDashArray: this._getLineDashPattern(lineType),
                showLabel: showLabel,
                labelValue: formattedPrice,
                labelPlacement: 'Axis',
                axisLabelFill: color,
                axisLabelStroke: '#FFFFFF'
            }
        };
        
        // Add x1 only if a valid startTime is provided
        if (startTime !== null && startTime !== undefined) {
            annotationData.object.x1 = startTime;
        }
        
        this._sendToWebSocket('save_anno', annotationData);
        return annotationData;
    }

    /**
     * Create a trend line annotation
     * @param {number} startTime - Start time value (x1-coordinate) as timestamp
     * @param {number} startPrice - Start price value (y1-coordinate)
     * @param {number} endTime - End time value (x2-coordinate) as timestamp
     * @param {number} endPrice - End price value (y2-coordinate)
     * @param {string} color - The line color (CSS color value)
     * @param {string} [timeframe='all'] - The timeframe for the annotation
     * @param {string} [lineType='solid'] - The line style ('solid', 'dash', 'dot', 'dash-dot')
     * @returns {Object} The created annotation data
     */
    createTrendLine(startTime, startPrice, endTime, endPrice, color, timeframe = 'all', lineType = 'solid') {
        const uniqueId = this.generateUniqueId(timeframe, 'tline');
        const id = `${this.clientId}/${this.instrument}/${timeframe}/tline/${uniqueId}`;
        
        const annotationData = {
            clientid: this.clientId,
            instrument: this.instrument,
            timeframe: timeframe,
            annotype: 'tline',
            unique: uniqueId,
            object: {
                id: id,
                type: 'RenderContextLineAnnotation',
                stroke: color,
                strokeThickness: 2,
                x1: startTime,
                y1: startPrice,
                x2: endTime,
                y2: endPrice,
                strokeDashArray: this._getLineDashPattern(lineType)
            }
        };
        
        this._sendToWebSocket('save_anno', annotationData);
        return annotationData;
    }

    /**
     * Create a box annotation
     * @param {number} startTime - Start time value (x1-coordinate) as timestamp
     * @param {number} startPrice - Start price value (y1-coordinate)
     * @param {number} endTime - End time value (x2-coordinate) as timestamp
     * @param {number} endPrice - End price value (y2-coordinate)
     * @param {string} color - The box color (CSS color value)
     * @param {number} [opacity=0.2] - The fill opacity (0-1)
     * @param {string} [timeframe='all'] - The timeframe for the annotation
     * @param {string} [lineType='solid'] - The border style ('solid', 'dash', 'dot', 'dash-dot')
     * @returns {Object} The created annotation data
     */
    createBox(startTime, startPrice, endTime, endPrice, color, opacity = 0.2, timeframe = 'all', lineType = 'solid') {
        const uniqueId = this.generateUniqueId(timeframe, 'box');
        const id = `${this.clientId}/${this.instrument}/${timeframe}/box/${uniqueId}`;
        
        // Convert opacity to hex for fill color
        const hexOpacity = Math.round(opacity * 255).toString(16).padStart(2, '0');
        const fillColor = `${color}${hexOpacity}`;
        
        const annotationData = {
            clientid: this.clientId,
            instrument: this.instrument,
            timeframe: timeframe,
            annotype: 'box',
            unique: uniqueId,
            object: {
                id: id,
                type: 'RenderContextBoxAnnotation',
                stroke: color,
                strokeThickness: 2,
                x1: startTime,
                y1: startPrice,
                x2: endTime,
                y2: endPrice,
                fill: fillColor,
                annotationLayer: 'Background'
            }
        };
        
        // Add stroke dash array if it's not solid
        if (lineType !== 'solid') {
            annotationData.object.strokeDashArray = this._getLineDashPattern(lineType);
        }
        
        this._sendToWebSocket('save_anno', annotationData);
        return annotationData;
    }

    /**
     * Get annotations for a specific client ID, instrument, or timeframe
     * @param {Object} [params={}] - Query parameters
     * @param {string} [params.clientid] - Filter by client ID (defaults to this.clientId)
     * @param {string} [params.instrument] - Filter by instrument (defaults to this.instrument)
     * @param {string} [params.timeframe] - Filter by timeframe
     * @param {Function} callback - Function to call with the results: callback(annotations)
     */
    getAnnotations(params = {}, callback) {
        if (!callback || typeof callback !== 'function') {
            console.error('getAnnotations requires a callback function');
            return;
        }

        console.log('Sending get_anno request with params:', params);
        const request = {
            action: 'get_anno',
            clientid: params.clientid || this.clientId,
            instrument: params.instrument || this.instrument
        };
        
        if (params.timeframe) {
            request.timeframe = params.timeframe;
        }
        
        // Create a one-time message handler for this specific request
        const messageHandler = (event) => {
            try {
                const response = JSON.parse(event.data);
                
                // Check if this is a get_anno_response
                if (response.action === 'get_anno_response') {
                    // Call the callback with the annotations
                    callback(response.annos || []);
                    
                    // Remove this handler after processing
                    this.ws.removeEventListener('message', messageHandler);
                }
            } catch (err) {
                console.error('Error processing get_anno response:', err);
            }
        };
        
        // Add the message handler
        this.ws.addEventListener('message', messageHandler);
        
        // Send the request
        this.ws.send(JSON.stringify(request));
    }

    /**
     * Build the annotation object based on type and properties
     * @param {string} type - The annotation type
     * @param {Object} params - The annotation parameters
     * @returns {Object} The complete annotation object
     * @private
     */
    _buildAnnotationObject(type, params) {
        const { uniqueId, timeframe, ...properties } = params;
        
        return {
            clientid: this.clientId,
            instrument: this.instrument,
            timeframe: timeframe || 'all',
            annotype: type,
            unique: uniqueId,
            object: {
                id: `${this.clientId}/${this.instrument}/${timeframe}/${type}/${uniqueId}`,
                ...properties
            }
        };
    }

    /**
     * Convert line type to SciChart stroke dash array
     * @param {string} lineType - The line type ('solid', 'dash', 'dot', 'dash-dot')
     * @returns {Array|null} The stroke dash array or null for solid lines
     * @private
     */
    _getLineDashPattern(lineType) {
        const patterns = {
            'solid': [],
            'dash': [4, 4],
            'dot': [1, 2],
            'dash-dot': [4, 4, 1, 4]
        };
        
        return patterns[lineType] || null;
    }

    /**
     * Create SVG string and anchor points for arrow annotations
     * @param {string} direction - Arrow direction ('up', 'down', 'left', 'right')
     * @param {string} size - Arrow size ('XS', 'S', 'M', 'L', 'XL')
     * @param {string} style - Arrow style ('triangle', 'arrow')
     * @param {string} color - Arrow color (CSS color value)
     * @returns {Object} Object containing svgString and anchor points
     * @private
     */
    _createArrowSvg(direction, size, style, color) {
        // Size mappings
        const sizeDimensions = {
            'XS': { width: 10, height: 10 },
            'S': { width: 15, height: 15 },
            'M': { width: 20, height: 20 },
            'L': { width: 30, height: 30 },
            'XL': { width: 40, height: 40 }
        };
        
        const dimensions = sizeDimensions[size] || sizeDimensions['M'];
        const { width, height } = dimensions;
        
        let svgString = '';
        let horizontalAnchorPoint = '';
        let verticalAnchorPoint = '';
        
        if (style === 'triangle') {
            // Triangle style arrows
            if (direction === 'up') {
                svgString = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
                            `    <polygon points="${width/2},0 ${width},${height} 0,${height}" fill="${color}" stroke="none" />\n` +
                            `</svg>`;
                horizontalAnchorPoint = "Center";
                verticalAnchorPoint = "Bottom";
            } else if (direction === 'down') {
                svgString = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
                            `    <polygon points="0,0 ${width},0 ${width/2},${height}" fill="${color}" stroke="none" />\n` +
                            `</svg>`;
                horizontalAnchorPoint = "Center";
                verticalAnchorPoint = "Top";
            } else if (direction === 'left') {
                svgString = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
                            `    <polygon points="${width},0 ${width},${height} 0,${height/2}" fill="${color}" stroke="none" />\n` +
                            `</svg>`;
                horizontalAnchorPoint = "Right";
                verticalAnchorPoint = "Center";
            } else { // right
                svgString = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
                            `    <polygon points="0,0 0,${height} ${width},${height/2}" fill="${color}" stroke="none" />\n` +
                            `</svg>`;
                horizontalAnchorPoint = "Left";
                verticalAnchorPoint = "Center";
            }
        } else { // arrow style
            // Arrow style with stem and head
            if (direction === 'up') {
                svgString = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
                            `    <path d="M${width/2},0 L${width*0.8},${height*0.4} L${width*0.6},${height*0.4} L${width*0.6},${height} L${width*0.4},${height} L${width*0.4},${height*0.4} L${width*0.2},${height*0.4} Z" fill="${color}" stroke="none" />\n` +
                            `</svg>`;
                horizontalAnchorPoint = "Center";
                verticalAnchorPoint = "Bottom";
            } else if (direction === 'down') {
                svgString = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
                            `    <path d="M${width*0.4},0 L${width*0.6},0 L${width*0.6},${height*0.6} L${width*0.8},${height*0.6} L${width/2},${height} L${width*0.2},${height*0.6} L${width*0.4},${height*0.6} Z" fill="${color}" stroke="none" />\n` +
                            `</svg>`;
                horizontalAnchorPoint = "Center";
                verticalAnchorPoint = "Top";
            } else if (direction === 'left') {
                svgString = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
                            `    <path d="M0,${height/2} L${width*0.4},${height*0.2} L${width*0.4},${height*0.4} L${width},${height*0.4} L${width},${height*0.6} L${width*0.4},${height*0.6} L${width*0.4},${height*0.8} Z" fill="${color}" stroke="none" />\n` +
                            `</svg>`;
                horizontalAnchorPoint = "Right";
                verticalAnchorPoint = "Center";
            } else { // right
                svgString = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
                            `    <path d="M${width},${height/2} L${width*0.6},${height*0.2} L${width*0.6},${height*0.4} L0,${height*0.4} L0,${height*0.6} L${width*0.6},${height*0.6} L${width*0.6},${height*0.8} Z" fill="${color}" stroke="none" />\n` +
                            `</svg>`;
                horizontalAnchorPoint = "Left";
                verticalAnchorPoint = "Center";
            }
        }
        
        return { svgString, horizontalAnchorPoint, verticalAnchorPoint };
    }

    /**
     * Send annotation action to the server
     * @param {string} action - The action to perform ('save_anno' or 'delete_anno')
     * @param {Object} data - The annotation data
     * @private
     */
    _sendToWebSocket(action, data) {
        // WebSocket.OPEN is 1 in both browser and Node.js
        const OPEN_STATE = 1;
        
        if (!this.ws || this.ws.readyState !== OPEN_STATE) {
            console.error('WebSocket is not connected');
            return;
        }
        
        try {
            const message = {
                action,
                ...data
            };
            
            console.log(`Sending ${action} message:`, JSON.stringify(message).substring(0, 200) + '...');
            this.ws.send(JSON.stringify(message));
        } catch (err) {
            console.error('Error sending WebSocket message:', err);
        }
    }
}

// Export the class if in a module environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChartAnnotationManager };
} else if (typeof window !== 'undefined') {
    // Add to window object if in browser
    window.ChartAnnotationManager = ChartAnnotationManager;
}