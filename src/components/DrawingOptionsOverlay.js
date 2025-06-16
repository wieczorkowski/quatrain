import React from 'react';

// New component for drawing options overlay
const DrawingOptionsOverlay = ({
    isLineMode,
    isTrendMode,
    isBoxMode,
    isArrowMode,
    isTextMode,
    lineColor,
    setLineColor,
    lineType,
    setLineType,
    showLabel,
    setShowLabel,
    lineOrientation,
    handleLineOrientationChange,
    isAllTimeframes,
    setIsAllTimeframes,
    boxOpacity,
    setBoxOpacity,
    arrowDirection,
    setArrowDirection,
    arrowSize,
    setArrowSize,
    arrowStyle,
    setArrowStyle,
    annotationText,
    setAnnotationText,
    fontSize,
    setFontSize,
    textAnchor,
    setTextAnchor
}) => {
    // Handlers for form controls
    const handleLineColorChange = (event) => setLineColor(event.target.value);
    const handleLineTypeChange = (event) => setLineType(event.target.value);
    const handleShowLabelChange = (event) => setShowLabel(event.target.checked);
    const handleAllTimeframesChange = (event) => setIsAllTimeframes(event.target.checked);
    const handleBoxOpacityChange = (event) => setBoxOpacity(parseFloat(event.target.value));
    const handleArrowDirectionChange = (event) => setArrowDirection(event.target.value);
    const handleArrowSizeChange = (event) => setArrowSize(event.target.value);
    const handleArrowStyleChange = (event) => setArrowStyle(event.target.value);
    const handleAnnotationTextChange = (event) => setAnnotationText(event.target.value);

    // Check if any drawing mode is active
    const isAnyDrawingModeActive = isLineMode || isBoxMode || isTrendMode || isArrowMode || isTextMode;

    // Return null if no drawing mode is active
    if (!isAnyDrawingModeActive) return null;

    return (
        <div className="drawing-options-overlay">
            {isLineMode && (
                <div className="drawing-options">
                    <div className="drawing-option-row">
                        <label>Color:</label>
                        <input type="color" value={lineColor} onChange={handleLineColorChange} />
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>Type:</label>
                        <select value={lineType} onChange={handleLineTypeChange}>
                            <option value="solid">Solid</option>
                            <option value="dash">Dash</option>
                            <option value="dot">Dot</option>
                        </select>
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>
                            <input type="checkbox" checked={showLabel} onChange={handleShowLabelChange} />
                            Label
                        </label>
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>Extend:</label>
                        <select value={lineOrientation} onChange={handleLineOrientationChange}>
                            <option value="Both">Both</option>
                            <option value="Right">Right</option>
                        </select>
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>
                            <input type="checkbox" checked={isAllTimeframes} onChange={handleAllTimeframesChange} />
                            All TFs
                        </label>
                    </div>
                </div>
            )}
            
            {isBoxMode && (
                <div className="drawing-options">
                    <div className="drawing-option-row">
                        <label>Color:</label>
                        <input type="color" value={lineColor} onChange={handleLineColorChange} />
                    </div>
                    <div className="drawing-option-row">
                        <label>Opacity: {Math.round(boxOpacity * 100)}%</label>
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.1"
                            value={boxOpacity} 
                            onChange={handleBoxOpacityChange}
                        />
                    </div>
                    <div className="drawing-option-row">
                        <label>
                            <input type="checkbox" checked={isAllTimeframes} onChange={handleAllTimeframesChange} />
                            All TFs
                        </label>
                    </div>
                </div>
            )}
            
            {isTrendMode && (
                <div className="drawing-options">
                    <div className="drawing-option-row">
                        <label>Color:</label>
                        <input type="color" value={lineColor} onChange={handleLineColorChange} />
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>Type:</label>
                        <select value={lineType} onChange={handleLineTypeChange}>
                            <option value="solid">Solid</option>
                            <option value="dash">Dash</option>
                            <option value="dot">Dot</option>
                        </select>
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>
                            <input type="checkbox" checked={isAllTimeframes} onChange={handleAllTimeframesChange} />
                            All TFs
                        </label>
                    </div>
                </div>
            )}
            
            {isArrowMode && (
                <div className="drawing-options">
                    <div className="drawing-option-row">
                        <label>Color:</label>
                        <input type="color" value={lineColor} onChange={handleLineColorChange} />
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>Direction:</label>
                        <select value={arrowDirection} onChange={handleArrowDirectionChange}>
                            <option value="up">Up</option>
                            <option value="down">Down</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>Size:</label>
                        <select value={arrowSize} onChange={handleArrowSizeChange}>
                            <option value="XS">XS</option>
                            <option value="S">S</option>
                            <option value="M">M</option>
                            <option value="L">L</option>
                            <option value="XL">XL</option>
                        </select>
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>Style:</label>
                        <select value={arrowStyle} onChange={handleArrowStyleChange}>
                            <option value="triangle">Triangle</option>
                            <option value="arrow">Arrow</option>
                        </select>
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>
                            <input type="checkbox" checked={isAllTimeframes} onChange={handleAllTimeframesChange} />
                            All TFs
                        </label>
                    </div>
                </div>
            )}
            
            {isTextMode && (
                <div className="drawing-options">
                    <div className="drawing-option-row">
                        <label>Color:</label>
                        <input type="color" value={lineColor} onChange={handleLineColorChange} />
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>Text:</label>
                        <input 
                            type="text" 
                            value={annotationText} 
                            onChange={handleAnnotationTextChange} 
                            style={{ 
                                background: '#222',
                                color: '#fff',
                                border: '1px solid #444'
                            }} 
                        />
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>Fontsize:</label>
                        <select value={fontSize || '14'} onChange={(e) => setFontSize(e.target.value)}>
                            <option value="12">12</option>
                            <option value="14">14</option>
                            <option value="16">16</option>
                            <option value="18">18</option>
                            <option value="20">20</option>
                            <option value="24">24</option>
                            <option value="30">30</option>
                        </select>
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>Anchor:</label>
                        <select value={textAnchor} onChange={(e) => setTextAnchor(e.target.value)}>
                            <option value="Left">Left</option>
                            <option value="Center">Center</option>
                            <option value="Right">Right</option>
                        </select>
                    </div>
                    
                    <div className="drawing-option-row">
                        <label>
                            <input type="checkbox" checked={isAllTimeframes} onChange={handleAllTimeframesChange} />
                            All TFs
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DrawingOptionsOverlay; 