import { NumberRange } from 'scichart/Core/NumberRange';

/**
 * Resets the visible range of a chart to show a reasonable default view
 * @param {SciChartSurface} sciChartSurface - The chart surface to reset
 * @param {OhlcDataSeries} dataSeries - The data series containing the candle data
 * @param {Object} chartBehavior - The behavior configuration
 */
export function resetToDefaultRange(sciChartSurface, dataSeries, chartBehavior, timeframe = null) {
    if (!sciChartSurface) {
        console.warn('SciChart surface is not available.');
        return;
    }

    const { numCandles, numSpace, yPercentSpace } = chartBehavior;
    
    // DEBUG: Log the chartBehavior values and chart ID to diagnose 1d issue
    console.log(`[DEBUG resetToDefaultRange] Chart ID: ${sciChartSurface.id}, timeframe: ${timeframe}, chartBehavior:`, chartBehavior, 
                `numCandles: ${numCandles}, numSpace: ${numSpace}, yPercentSpace: ${yPercentSpace}`);
    const candleCount = dataSeries.count();

    if (candleCount === 0) {
        console.warn(`No data available for ${sciChartSurface.id}`);
        return;
    }

    const lastCandleIndex = candleCount - 1;
    const xValues = dataSeries.getNativeXValues();
    const xEnd = xValues.get(lastCandleIndex);

    // Determine the timeframe - use explicit parameter if provided, otherwise fall back to chart ID extraction
    let timeframeMs;
    
    if (timeframe) {
        // Use the timeframeToMilliseconds function for reliable conversion
        timeframeMs = timeframeToMilliseconds(timeframe);
        console.log(`[DEBUG] Using explicit timeframe: ${timeframe} = ${timeframeMs}ms`);
    } else {
        // Fallback to chart ID extraction (legacy behavior)
        const chartId = sciChartSurface.id || '';
        
        // Add explicit handling for 1d timeframe before regex
        if (chartId.includes('1d')) {
            timeframeMs = 24 * 60 * 60 * 1000; // 1 day in ms
        } else {
            // Try to extract timeframe from chart ID (e.g., "chart-1h-container" or "scichart-root-5m")
            const timeframeMatch = chartId.match(/(\d+)([mh])/);
            
            if (timeframeMatch) {
                const value = parseInt(timeframeMatch[1]);
                const unit = timeframeMatch[2];
                
                if (unit === 'm') {
                    timeframeMs = value * 60 * 1000; // minutes to ms
                } else if (unit === 'h') {
                    timeframeMs = value * 60 * 60 * 1000; // hours to ms
                }
            }
        }
    } 
    
    // If we couldn't determine timeframe from ID, estimate from the average candle spacing
    // but only consider consecutive candles that are within a reasonable timeframe
    if (!timeframeMs && candleCount > 1) {
        // Calculate an average time difference between consecutive candles, ignoring large gaps
        let totalDiff = 0;
        let countedDiffs = 0;
        const maxReasonableGap = 24 * 60 * 60 * 1000; // 24 hours in ms
        
        for (let i = 1; i < candleCount; i++) {
            const diff = xValues.get(i) - xValues.get(i - 1);
            if (diff > 0 && diff < maxReasonableGap) {
                totalDiff += diff;
                countedDiffs++;
            }
        }
        
        timeframeMs = countedDiffs > 0 ? totalDiff / countedDiffs : 60 * 60 * 1000; // Default to 1 hour
    } else if (!timeframeMs) {
        // No timeframe could be determined, default to 1 hour
        timeframeMs = 60 * 60 * 1000;
    }
    
    // Calculate the time range to display (numCandles * candle width + space)
    const timeRange = timeframeMs * numCandles;
    const xStart = Math.max(0, xEnd - timeRange);
    
    // Add space for future candles
    const xRangeEnd = xEnd + (timeframeMs * numSpace);
    const xRange = new NumberRange(xStart, xRangeEnd);
    
    // Find min/max y values within the visible time range
    const visibleHighs = [];
    const visibleLows = [];
    
    for (let i = 0; i < candleCount; i++) {
        const x = xValues.get(i);
        if (x >= xStart && x <= xEnd) {
            visibleHighs.push(dataSeries.getNativeHighValues().get(i));
            visibleLows.push(dataSeries.getNativeLowValues().get(i));
        }
    }
    
    // If no candles are in the visible range, use all available data
    if (visibleHighs.length === 0 || visibleLows.length === 0) {
        for (let i = 0; i < candleCount; i++) {
            visibleHighs.push(dataSeries.getNativeHighValues().get(i));
            visibleLows.push(dataSeries.getNativeLowValues().get(i));
        }
    }
    
    const highestHigh = Math.max(...visibleHighs);
    const lowestLow = Math.min(...visibleLows);
    const range = highestHigh - lowestLow;
    const buffer = range * (yPercentSpace / 100);
    const yRange = new NumberRange(lowestLow - buffer, highestHigh + buffer);

    sciChartSurface.xAxes.get(0).visibleRange = xRange;
    sciChartSurface.yAxes.get(0).visibleRange = yRange;
}

/**
 * Calculates a readable text color (black or white) based on background color brightness
 * @param {string} hexColor - Hex color code (e.g. #FFFFFF)
 * @returns {string} - Contrasting text color (#000000 or #FFFFFF)
 */
export function getReadableTextColor(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Converts a timeframe string (e.g., '1m', '5m', '1h') to milliseconds
 * @param {string} timeframe - The timeframe string (e.g., '1m', '5m', '1h')
 * @returns {number} The equivalent time in milliseconds
 */
export function timeframeToMilliseconds(timeframe) {
    const match = timeframe.match(/^(\d+)([mhd])$/);
    if (!match) {
        console.warn(`Invalid timeframe format: ${timeframe}. Expected format like '1m', '5m', '1h', '4h', '1d'.`);
        return 60 * 1000; // Default to 1 minute
    }
    const value = parseInt(match[1]);
    const unit = match[2];
    
    if (unit === 'm') return value * 60 * 1000; // minutes to milliseconds
    if (unit === 'h') return value * 60 * 60 * 1000; // hours to milliseconds
    if (unit === 'd') return value * 24 * 60 * 60 * 1000; // days to milliseconds
    
    return 60 * 1000; // Default to 1 minute if unit not recognized
}

/**
 * Extracts properties from an annotation for serialization
 * @param {Annotation} annotation - The annotation to extract properties from
 * @returns {Object} - Object containing annotation properties
 */
export function getAnnotationProperties(annotation) {
    // Base properties for all annotation types
    const properties = {
        id: annotation.id,
        type: annotation.type,
        stroke: annotation.stroke,
        strokeThickness: annotation.strokeThickness,
        x1: annotation.x1,
        y1: annotation.y1,
    };
    
    // Add type-specific properties
    if (annotation.type === "HorizontalLineAnnotation" || annotation.type === "RenderContextHorizontalLineAnnotation") {
        properties.strokeDashArray = annotation.strokeDashArray;
        properties.labelValue = annotation.labelValue;
        properties.showLabel = annotation.showLabel;
        properties.labelPlacement = annotation.labelPlacement;
        properties.axisLabelFill = annotation.axisLabelFill;
        properties.axisLabelStroke = annotation.axisLabelStroke;
        properties.fontSize = annotation.fontSize;
    } else if (annotation.type === "BoxAnnotation" || annotation.type === "RenderContextBoxAnnotation") {
        properties.x2 = annotation.x2;
        properties.y2 = annotation.y2;
        properties.fill = annotation.fill;
        properties.annotationLayer = annotation.annotationLayer || "Background";
    } else if (annotation.type === "LineAnnotation" || annotation.type === "RenderContextLineAnnotation") {
        properties.x2 = annotation.x2;
        properties.y2 = annotation.y2;
        properties.strokeDashArray = annotation.strokeDashArray;
    } else if (annotation.type === "SVGCustomAnnotation") {
        // For arrow annotations
        properties.svgString = annotation.svgString;
        properties.horizontalAnchorPoint = annotation.horizontalAnchorPoint;
        properties.verticalAnchorPoint = annotation.verticalAnchorPoint;
        
        // Store arrow-specific properties if they exist
        if (annotation.arrowDirection) properties.arrowDirection = annotation.arrowDirection;
        if (annotation.arrowSize) properties.arrowSize = annotation.arrowSize;
        if (annotation.arrowStyle) properties.arrowStyle = annotation.arrowStyle;
    } else if (annotation.type === "NativeTextAnnotation" || annotation.type === "RenderContextNativeTextAnnotation") {
        // For text annotations
        properties.text = annotation.text;
        properties.textColor = annotation.textColor;
        properties.backgroundColor = annotation.backgroundColor;
        properties.fontSize = annotation.fontSize;
        properties.fontWeight = annotation.fontWeight;
        properties.horizontalAnchorPoint = annotation.horizontalAnchorPoint;
        properties.verticalAnchorPoint = annotation.verticalAnchorPoint;
    }
    
    return properties;
}

/**
 * Generates an SVG string for an arrow annotation
 * @param {string} direction - 'up', 'down', 'left', or 'right'
 * @param {string} color - Hex color code (e.g. #FF0000)
 * @param {string} size - Size of the arrow ('XS', 'S', 'M', 'L', 'XL')
 * @param {string} style - 'triangle' or 'arrow'
 * @returns {string} - SVG string for the arrow
 */
export function createArrowSvg(direction, color, size = 'M', style = 'triangle') {
    // Convert size string to pixels
    const sizeMap = {
        'XS': 12,
        'S': 16,
        'M': 20,
        'L': 28,
        'XL': 36
    };
    
    const pixelSize = sizeMap[size] || 20;
    
    // Base path data for different arrow directions
    let pathData = '';
    let viewBoxWidth = pixelSize;
    let viewBoxHeight = pixelSize;
    
    if (style === 'triangle') {
        // Triangle style path data
        if (direction === 'up') {
            pathData = `M${pixelSize/2},0 L0,${pixelSize} L${pixelSize},${pixelSize} Z`;
        } else if (direction === 'down') {
            pathData = `M${pixelSize/2},${pixelSize} L0,0 L${pixelSize},0 Z`;
        } else if (direction === 'left') {
            pathData = `M0,${pixelSize/2} L${pixelSize},0 L${pixelSize},${pixelSize} Z`;
        } else if (direction === 'right') {
            pathData = `M${pixelSize},${pixelSize/2} L0,0 L0,${pixelSize} Z`;
        }
    } else if (style === 'arrow') {
        // Arrow style with head and shaft
        const headSize = pixelSize * 0.5; // Head size as proportion of total size
        const shaftWidth = pixelSize * 0.5; // Shaft width as proportion of total size
        
        if (direction === 'up') {
            viewBoxHeight = pixelSize * 1.5; // Make taller for the shaft
            const arrowHeadBottom = headSize;
            const arrowTip = 0;
            const arrowBottom = viewBoxHeight;
            const halfWidth = pixelSize / 2;
            const halfShaftWidth = shaftWidth / 2;
            
            pathData = `M${halfWidth},${arrowTip} ` +                        // Arrow tip top
                       `L${pixelSize},${arrowHeadBottom} ` +                 // Arrow head right corner
                       `L${halfWidth + halfShaftWidth},${arrowHeadBottom} ` + // Right edge of shaft start
                       `L${halfWidth + halfShaftWidth},${arrowBottom} ` +     // Right edge of shaft end
                       `L${halfWidth - halfShaftWidth},${arrowBottom} ` +     // Left edge of shaft end
                       `L${halfWidth - halfShaftWidth},${arrowHeadBottom} ` + // Left edge of shaft start
                       `L0,${arrowHeadBottom} Z`;                            // Arrow head left corner and close
        } else if (direction === 'down') {
            viewBoxHeight = pixelSize * 1.5; // Make taller for the shaft
            const arrowHeadTop = viewBoxHeight - headSize;
            const arrowTip = viewBoxHeight;
            const arrowTop = 0;
            const halfWidth = pixelSize / 2;
            const halfShaftWidth = shaftWidth / 2;
            
            pathData = `M${halfWidth},${arrowTip} ` +                        // Arrow tip bottom
                       `L0,${arrowHeadTop} ` +                               // Arrow head left corner
                       `L${halfWidth - halfShaftWidth},${arrowHeadTop} ` +    // Left edge of shaft end
                       `L${halfWidth - halfShaftWidth},${arrowTop} ` +        // Left edge of shaft start
                       `L${halfWidth + halfShaftWidth},${arrowTop} ` +        // Right edge of shaft start
                       `L${halfWidth + halfShaftWidth},${arrowHeadTop} ` +    // Right edge of shaft end
                       `L${pixelSize},${arrowHeadTop} Z`;                    // Arrow head right corner and close
        } else if (direction === 'left') {
            viewBoxWidth = pixelSize * 1.5; // Make wider for the shaft
            const arrowHeadRight = headSize;
            const arrowTip = 0;
            const arrowRight = viewBoxWidth;
            const halfHeight = pixelSize / 2;
            const halfShaftWidth = shaftWidth / 2;
            
            pathData = `M${arrowTip},${halfHeight} ` +                        // Arrow tip left
                       `L${arrowHeadRight},0 ` +                              // Arrow head top corner
                       `L${arrowHeadRight},${halfHeight - halfShaftWidth} ` +  // Top edge of shaft start
                       `L${arrowRight},${halfHeight - halfShaftWidth} ` +      // Top edge of shaft end
                       `L${arrowRight},${halfHeight + halfShaftWidth} ` +      // Bottom edge of shaft end
                       `L${arrowHeadRight},${halfHeight + halfShaftWidth} ` +  // Bottom edge of shaft start
                       `L${arrowHeadRight},${pixelSize} Z`;                   // Arrow head bottom corner and close
        } else if (direction === 'right') {
            viewBoxWidth = pixelSize * 1.5; // Make wider for the shaft
            const arrowHeadLeft = viewBoxWidth - headSize;
            const arrowTip = viewBoxWidth;
            const arrowLeft = 0;
            const halfHeight = pixelSize / 2;
            const halfShaftWidth = shaftWidth / 2;
            
            pathData = `M${arrowTip},${halfHeight} ` +                        // Arrow tip right
                       `L${arrowHeadLeft},0 ` +                               // Arrow head top corner
                       `L${arrowHeadLeft},${halfHeight - halfShaftWidth} ` +   // Top edge of shaft end
                       `L${arrowLeft},${halfHeight - halfShaftWidth} ` +       // Top edge of shaft start
                       `L${arrowLeft},${halfHeight + halfShaftWidth} ` +       // Bottom edge of shaft start
                       `L${arrowHeadLeft},${halfHeight + halfShaftWidth} ` +   // Bottom edge of shaft end
                       `L${arrowHeadLeft},${pixelSize} Z`;                    // Arrow head bottom corner and close
        }
    }
    
    return `<svg width="${viewBoxWidth}" height="${viewBoxHeight}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">
        <path d="${pathData}" fill="${color}" stroke="none" />
    </svg>`;
}

/**
 * Gets the appropriate anchor points for an arrow based on direction
 * @param {string} direction - 'up', 'down', 'left', or 'right' 
 * @returns {Object} - Object with horizontalAnchorPoint and verticalAnchorPoint
 */
export function getArrowAnchorPoints(direction) {
    // Import the enum values directly in the function to avoid import issues
    const EHorizontalAnchorPoint = {
        Left: 0,
        Center: 1,
        Right: 2
    };
    
    const EVerticalAnchorPoint = {
        Top: 0,
        Center: 1,
        Bottom: 2
    };

    switch (direction) {
        case 'up':
            return {
                horizontalAnchorPoint: "Center",
                verticalAnchorPoint: "Top"
            };
        case 'down':
            return {
                horizontalAnchorPoint: "Center",
                verticalAnchorPoint: "Bottom"
            };
        case 'left':
            return {
                horizontalAnchorPoint: "Left",
                verticalAnchorPoint: "Center"
            };
        case 'right':
            return {
                horizontalAnchorPoint: "Right",
                verticalAnchorPoint: "Center"
            };
        default:
            return {
                horizontalAnchorPoint: "Center",
                verticalAnchorPoint: "Center"
            };
    }
} 