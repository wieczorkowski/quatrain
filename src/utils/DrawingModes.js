import { ZoomPanModifier } from 'scichart/Charting/ChartModifiers/ZoomPanModifier';

// Function to toggle line drawing mode
export const toggleLineMode = (isLineMode, setIsLineMode, setIsBoxMode, setIsTrendMode, setIsArrowMode, setIsTextMode) => {
    const newLineMode = !isLineMode;
    setIsLineMode(newLineMode);
    if (newLineMode) {
        setIsBoxMode(false); // Turn off box mode if line mode is enabled
        setIsTrendMode(false); // Turn off trend mode if line mode is enabled
        setIsArrowMode(false); // Turn off arrow mode if line mode is enabled
        setIsTextMode(false); // Turn off text mode if line mode is enabled
    }
};

// Function to toggle box drawing mode
export const toggleBoxMode = (isBoxMode, setIsBoxMode, setIsLineMode, setIsTrendMode, setIsArrowMode, setIsTextMode) => {
    const newBoxMode = !isBoxMode;
    setIsBoxMode(newBoxMode);
    if (newBoxMode) {
        setIsLineMode(false); // Turn off line mode if box mode is enabled
        setIsTrendMode(false); // Turn off trend mode if box mode is enabled
        setIsArrowMode(false); // Turn off arrow mode if box mode is enabled
        setIsTextMode(false); // Turn off text mode if box mode is enabled
    }
};

// Function to toggle trend drawing mode
export const toggleTrendMode = (isTrendMode, setIsTrendMode, setIsLineMode, setIsBoxMode, setIsArrowMode, setIsTextMode) => {
    const newTrendMode = !isTrendMode;
    // console.log(`Toggling trend mode from ${isTrendMode} to ${newTrendMode}`);
    setIsTrendMode(newTrendMode);
    
    if (newTrendMode) {
        setIsLineMode(false); // Turn off line mode if trend mode is enabled
        setIsBoxMode(false); // Turn off box mode if trend mode is enabled
        setIsArrowMode(false); // Turn off arrow mode if trend mode is enabled
        setIsTextMode(false); // Turn off text mode if trend mode is enabled
        // console.log('Trend mode enabled, disabled line and box modes');
    }
};

// Function to toggle arrow drawing mode
export const toggleArrowMode = (isArrowMode, setIsArrowMode, setIsLineMode, setIsBoxMode, setIsTrendMode, setIsTextMode) => {
    const newArrowMode = !isArrowMode;
    // console.log(`Toggling arrow mode from ${isArrowMode} to ${newArrowMode}`);
    setIsArrowMode(newArrowMode);
    
    if (newArrowMode) {
        setIsLineMode(false); // Turn off line mode if arrow mode is enabled
        setIsBoxMode(false); // Turn off box mode if arrow mode is enabled
        setIsTrendMode(false); // Turn off trend mode if arrow mode is enabled
        setIsTextMode(false); // Turn off text mode if arrow mode is enabled
        // console.log('Arrow mode enabled, disabled other drawing modes');
    }
};

// Function to toggle text drawing mode
export const toggleTextMode = (isTextMode, setIsTextMode, setIsLineMode, setIsBoxMode, setIsTrendMode, setIsArrowMode) => {
    const newTextMode = !isTextMode;
    // console.log(`Toggling text mode from ${isTextMode} to ${newTextMode}`);
    setIsTextMode(newTextMode);
    
    if (newTextMode) {
        setIsLineMode(false); // Turn off line mode if text mode is enabled
        setIsBoxMode(false); // Turn off box mode if text mode is enabled
        setIsTrendMode(false); // Turn off trend mode if text mode is enabled
        setIsArrowMode(false); // Turn off arrow mode if text mode is enabled
        // console.log('Text mode enabled, disabled other drawing modes');
    }
};

// Function to update zoom pan modifier state
export const updateZoomPanModifierState = (isBoxMode, isTrendMode, isArrowMode, isTextMode, sciChartSurfaceRefs, timeframes) => {
    // Check if any drawing mode is active - if any is active, disable ZoomPanModifier
    const isAnyDrawingModeActive = isBoxMode || isTrendMode || isArrowMode || isTextMode;
    
    // console.log(`Updating ZoomPanModifier state. Drawing active: ${isAnyDrawingModeActive} (Box: ${isBoxMode}, Trend: ${isTrendMode}, Arrow: ${isArrowMode}, Text: ${isTextMode})`);
    
    // Apply to all chart surfaces
    timeframes.forEach(tf => {
        const surface = sciChartSurfaceRefs.current[tf];
        if (surface) {
            const zoomPanModifier = surface.chartModifiers.asArray().find(
                modifier => modifier instanceof ZoomPanModifier
            );
            if (zoomPanModifier) {
                // Disable if any drawing mode is active, enable otherwise
                zoomPanModifier.isEnabled = !isAnyDrawingModeActive;
                // console.log(`${isAnyDrawingModeActive ? 'Disabled' : 'Enabled'} ZoomPanModifier in ${tf} chart`);
            }
        }
    });
}; 