import React, { useRef } from 'react';
import '../App.css';
// Import drawing lock image
import drawingLockImage from '../images/button-drawing-lock.png';

// Updated Flyout Panel Component with new drawing lock button
const FlyoutPanel = ({ 
    isOpen, 
    togglePanel, 
    isCrosshairMode, 
    toggleCrosshairMode, 
    isDrawingLockMode,
    toggleDrawingLockMode,
    isLineMode, 
    toggleLineMode, 
    isBoxMode, 
    toggleBoxMode, 
    isTrendMode, 
    toggleTrendMode,
    isArrowMode,
    toggleArrowMode,
    isTextMode,
    toggleTextMode
}) => {
    const panelRef = useRef(null);

    // Create styling object with the direct image reference
    const drawingLockStyle = {
        backgroundImage: `url(${drawingLockImage})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center'
    };

    return (
        <div ref={panelRef} className={`flyout-panel ${isOpen ? 'open' : ''}`}>
            <div className="flyout-content">
                <div className="flyout-tab" onClick={togglePanel} />
                <p style={{ fontSize: '12px', margin: '2px 0', textAlign: 'center' }}>Tools</p>
                <div className="button-rows">
                    {/* First row with crosshair and drawing lock tools */}
                    <div className="button-row">
                        <div
                            className={`crosshair-button ${isCrosshairMode ? 'active' : ''}`}
                            onClick={toggleCrosshairMode}
                        />
                        <div
                            className={`drawing-lock-button ${isDrawingLockMode ? 'active' : ''}`}
                            onClick={toggleDrawingLockMode}
                            style={drawingLockStyle}
                        />
                    </div>
                    
                    <hr className="tools-separator" />
                    
                    {/* Drawing tools in 2-column grid */}
                    <div className="button-row">
                        <div
                            className={`line-button ${isLineMode ? 'active' : ''}`}
                            onClick={toggleLineMode}
                        />
                        <div
                            className={`box-button ${isBoxMode ? 'active' : ''}`}
                            onClick={toggleBoxMode}
                        />
                    </div>
                    <div className="button-row">
                        <div
                            className={`trend-button ${isTrendMode ? 'active' : ''}`}
                            onClick={toggleTrendMode}
                        />
                        <div
                            className={`arrow-button ${isArrowMode ? 'active' : ''}`}
                            onClick={toggleArrowMode}
                        />
                    </div>
                    <div className="button-row">
                        <div
                            className={`text-button ${isTextMode ? 'active' : ''}`}
                            onClick={toggleTextMode}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlyoutPanel; 