import React, { useState, useEffect } from 'react';
import './Settings.css';
import settingsIcon from './images/settings-icon.png';

const Settings = ({ onClose, onApply, settings, ws, clientId }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [selectedCategory, setSelectedCategory] = useState('Chart Behavior');
    const [candleWidth, setCandleWidth] = useState(settings.candleWidth || 50); // Default to 50%
    const [chartTypes, setChartTypes] = useState(settings.chartTypes || {
        '1d': 'Candle',
        '4h': 'Candle',
        '1h': 'Candle',
        '30m': 'Candle',
        '15m': 'Candle',
        '10m': 'Candle',
        '5m': 'Candle',
        '1m': 'Candle',
    });

    // Sync localSettings with props.settings when it changes
    useEffect(() => {
        setLocalSettings(settings);
        setCandleWidth(settings.candleWidth || 50); // Update candleWidth if settings change
        // Initialize chartTypes from settings or default to Candle
        const initialChartTypes = settings.chartTypes || {
            '1d': 'Candle',
            '4h': 'Candle',
            '1h': 'Candle',
            '30m': 'Candle',
            '15m': 'Candle',
            '10m': 'Candle',
            '5m': 'Candle',
            '1m': 'Candle',
        };
        setChartTypes(initialChartTypes);
    }, [settings]);

    const handleInputChange = (timeframe, field, value) => {
        setLocalSettings((prev) => ({
            ...prev,
            chartBehavior: {
                ...prev.chartBehavior,
                [timeframe]: {
                    ...prev.chartBehavior[timeframe],
                    [field]: Number(value),
                },
            },
        }));
    };

    const handleColorChange = (field, value) => {
        setLocalSettings((prev) => ({
            ...prev,
            colors: {
                ...prev.colors,
                [field]: value,
            },
        }));
    };

    const handleGridOptionChange = (field, checked) => {
        setLocalSettings((prev) => ({
            ...prev,
            gridOptions: {
                ...prev.gridOptions,
                [field]: checked,
            },
        }));
    };

    const handleCandleWidthChange = (event) => {
        setCandleWidth(Number(event.target.value));
    };

    // New handler for chart type changes
    const handleChartTypeChange = (timeframe, value) => {
        setChartTypes(prev => ({
            ...prev,
            [timeframe]: value
        }));
    };

    const handleApply = () => {
        // Update local settings in the client with chartTypes included
        onApply({ ...localSettings, candleWidth, chartTypes });

        // Construct the save_client_settings request with the structure App.js expects
        const saveRequest = {
            action: 'save_client_settings',
            client_id: clientId,
            new_values: {
                chartBehavior: localSettings.chartBehavior,
                colors: localSettings.colors,
                gridOptions: localSettings.gridOptions,
                candleWidth: candleWidth, // Add candleWidth to the settings
                chartTypes: chartTypes, // Add chartTypes to the settings
            },
        };

        // Send the request via WebSocket
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(saveRequest));
            console.log('Sent save_client_settings request:', saveRequest);
        } else {
            console.error('WebSocket is not open. Cannot save settings.');
        }

        // Close the settings window
        onClose();
    };

    // Render Chart Behavior content
    const renderChartBehaviorContent = () => (
        <div className="category-content">
            <div className="settings-section">
                <h3 className="settings-subheader">Default Range for Double-Click</h3>
                <div className="chart-settings-header">
                    <span className="header-label"></span>
                    <span className="header-label">X Candles</span>
                    <span className="header-label">X Space</span>
                    <span className="header-label">Y Space %</span>
                </div>
                {Object.keys(localSettings.chartBehavior).map((timeframe) => (
                    <div key={timeframe} className="chart-settings-row">
                        <label>{timeframe}</label>
                        <input
                            type="number"
                            value={localSettings.chartBehavior[timeframe].numCandles}
                            onChange={(e) => handleInputChange(timeframe, 'numCandles', e.target.value)}
                            min="1"
                        />
                        <input
                            type="number"
                            value={localSettings.chartBehavior[timeframe].numSpace}
                            onChange={(e) => handleInputChange(timeframe, 'numSpace', e.target.value)}
                            min="0"
                        />
                        <input
                            type="number"
                            value={localSettings.chartBehavior[timeframe].yPercentSpace}
                            onChange={(e) => handleInputChange(timeframe, 'yPercentSpace', e.target.value)}
                            min="0"
                        />
                    </div>
                ))}
            </div>
        </div>
    );

    // Render Chart Type content - new section
    const renderChartTypeContent = () => (
        <div className="category-content">
            <div className="settings-section">
                <h3 className="settings-subheader">Chart Type</h3>
                <div className="chart-settings-header">
                    <span className="header-label">Timeframe</span>
                    <span className="header-label">Chart Type</span>
                </div>
                {Object.keys(chartTypes).map((timeframe) => (
                    <div key={timeframe} className="chart-settings-row">
                        <label>{timeframe}</label>
                        <select
                            value={chartTypes[timeframe]}
                            onChange={(e) => handleChartTypeChange(timeframe, e.target.value)}
                        >
                            <option value="Candle">Candle</option>
                            <option value="Line">Line</option>
                            <option value="Both">Both</option>
                        </select>
                    </div>
                ))}
            </div>
        </div>
    );

    // Render Appearance content
    const renderAppearanceContent = () => (
        <div className="category-content">
            <div className="settings-section">
                <h3 className="settings-subheader">Colors</h3>
                <div className="color-setting">
                    <label>Up-Candle Stroke</label>
                    <input
                        type="color"
                        value={localSettings.colors.upCandleStroke}
                        onChange={(e) => handleColorChange('upCandleStroke', e.target.value)}
                    />
                </div>
                <div className="color-setting">
                    <label>Up-Candle Fill</label>
                    <input
                        type="color"
                        value={localSettings.colors.upCandleFill}
                        onChange={(e) => handleColorChange('upCandleFill', e.target.value)}
                    />
                </div>
                <div className="color-setting">
                    <label>Down-Candle Stroke</label>
                    <input
                        type="color"
                        value={localSettings.colors.downCandleStroke}
                        onChange={(e) => handleColorChange('downCandleStroke', e.target.value)}
                    />
                </div>
                <div className="color-setting">
                    <label>Down-Candle Fill</label>
                    <input
                        type="color"
                        value={localSettings.colors.downCandleFill}
                        onChange={(e) => handleColorChange('downCandleFill', e.target.value)}
                    />
                </div>
                <div className="color-setting">
                    <label>Chart Background</label>
                    <input
                        type="color"
                        value={localSettings.colors.chartBackground}
                        onChange={(e) => handleColorChange('chartBackground', e.target.value)}
                    />
                </div>
                <div className="color-setting">
                    <label>Axis Text</label>
                    <input
                        type="color"
                        value={localSettings.colors.axisText}
                        onChange={(e) => handleColorChange('axisText', e.target.value)}
                    />
                </div>
                <div className="color-setting">
                    <label>Line Chart Uptick</label>
                    <input
                        type="color"
                        value={localSettings.colors.lineChartUptickColor || '#008800'}
                        onChange={(e) => handleColorChange('lineChartUptickColor', e.target.value)}
                    />
                </div>
                <div className="color-setting">
                    <label>Line Chart Downtick</label>
                    <input
                        type="color"
                        value={localSettings.colors.lineChartDowntickColor || '#AA0000'}
                        onChange={(e) => handleColorChange('lineChartDowntickColor', e.target.value)}
                    />
                </div>
            </div>
            
            <hr className="settings-divider" />
            
            <div className="settings-section">
                <h3 className="settings-subheader">Grid and Shading Visibility</h3>
                <label>
                    <input
                        type="checkbox"
                        checked={localSettings.gridOptions.xAxisShading}
                        onChange={(e) => handleGridOptionChange('xAxisShading', e.target.checked)}
                    />
                    X Axis Shading
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={localSettings.gridOptions.yAxisShading}
                        onChange={(e) => handleGridOptionChange('yAxisShading', e.target.checked)}
                    />
                    Y Axis Shading
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={localSettings.gridOptions.gridlines}
                        onChange={(e) => handleGridOptionChange('gridlines', e.target.checked)}
                    />
                    Gridlines
                </label>
            </div>
            
            <hr className="settings-divider" />
            
            <div className="settings-section">
                <h3 className="settings-subheader">Candle Appearance</h3>
                <div className="candle-width-setting">
                    <label>Candle Width % (0-100)</label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={candleWidth}
                        onChange={handleCandleWidthChange}
                    />
                    <span>{candleWidth}%</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="settings-overlay">
            <div className="settings-panel">
                <div className="settings-header">
                    <div className="header-title">
                        <img 
                            src={settingsIcon} 
                            alt="Settings" 
                            className="settings-icon" 
                            width="30" 
                        />
                        <h2>Settings</h2>
                    </div>
                    <button className="close-button" onClick={onClose}>
                        X
                    </button>
                </div>
                <div className="settings-left-menu">
                    <div
                        className={`menu-item ${selectedCategory === 'Chart Behavior' ? 'active' : ''}`}
                        onClick={() => setSelectedCategory('Chart Behavior')}
                    >
                        Chart Behavior
                    </div>
                    <div
                        className={`menu-item ${selectedCategory === 'Chart Type' ? 'active' : ''}`}
                        onClick={() => setSelectedCategory('Chart Type')}
                    >
                        Chart Type
                    </div>
                    <div
                        className={`menu-item ${selectedCategory === 'Appearance' ? 'active' : ''}`}
                        onClick={() => setSelectedCategory('Appearance')}
                    >
                        Appearance
                    </div>
                </div>
                <div className="settings-content">
                    <div className="settings-right-content">
                        <h2 className="category-title">{selectedCategory}</h2>
                        {selectedCategory === 'Chart Behavior' && renderChartBehaviorContent()}
                        {selectedCategory === 'Chart Type' && renderChartTypeContent()}
                        {selectedCategory === 'Appearance' && renderAppearanceContent()}
                    </div>
                    <div className="settings-footer">
                        <button className="apply-button" onClick={handleApply}>
                            Apply
                        </button>
                        <button className="apply-button" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;