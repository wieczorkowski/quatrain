import React, { useState, useEffect } from 'react';
import './Settings.css';

const Settings = ({ onClose, onApply, settings, ws, clientId }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [selectedCategory, setSelectedCategory] = useState('Chart Behavior');

    // Sync localSettings with props.settings when it changes
    useEffect(() => {
        setLocalSettings(settings);
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

    const handleApply = () => {
        // Update local settings in the client
        onApply(localSettings);

        // Construct the save_client_settings request
        const saveRequest = {
            action: 'save_client_settings',
            client_id: clientId,
            new_values: {
                chart_behavior: {
                    default_range: {
                        chart1: [
                            localSettings.chartBehavior['1h'].numCandles,
                            localSettings.chartBehavior['1h'].numSpace,
                            localSettings.chartBehavior['1h'].yPercentSpace,
                        ],
                        chart2: [
                            localSettings.chartBehavior['15m'].numCandles,
                            localSettings.chartBehavior['15m'].numSpace,
                            localSettings.chartBehavior['15m'].yPercentSpace,
                        ],
                        chart3: [
                            localSettings.chartBehavior['5m'].numCandles,
                            localSettings.chartBehavior['5m'].numSpace,
                            localSettings.chartBehavior['5m'].yPercentSpace,
                        ],
                        chart4: [
                            localSettings.chartBehavior['1m'].numCandles,
                            localSettings.chartBehavior['1m'].numSpace,
                            localSettings.chartBehavior['1m'].yPercentSpace,
                        ],
                    },
                },
                appearance: {
                    colors: {
                        upcandle_stroke: localSettings.colors.upCandleStroke,
                        upcandle_fill: localSettings.colors.upCandleFill,
                        downcandle_stroke: localSettings.colors.downCandleStroke,
                        downcandle_fill: localSettings.colors.downCandleFill,
                        chart_background: localSettings.colors.chartBackground,
                        axis_labels: localSettings.colors.axisText,
                    },
                    grid_and_shading: {
                        x_axis_shading: localSettings.gridOptions.xAxisShading,
                        y_axis_shading: localSettings.gridOptions.yAxisShading,
                        gridlines: localSettings.gridOptions.gridlines,
                    },
                },
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

    return (
        <div className="settings-overlay">
            <div className="settings-panel">
                <div className="settings-left-menu">
                    <div
                        className={`menu-item ${selectedCategory === 'Chart Behavior' ? 'active' : ''}`}
                        onClick={() => setSelectedCategory('Chart Behavior')}
                    >
                        Chart Behavior
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
                        {selectedCategory === 'Chart Behavior' && (
                            <div>
                                <h2>Chart Behavior</h2>
                                <div className="settings-section">
                                    <h3 className="settings-header">Default Range for Double-Click</h3>
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
                        )}
                        {selectedCategory === 'Appearance' && (
                            <div>
                                <h2>Appearance</h2>
                                <div className="settings-section">
                                    <h3 className="settings-header">Colors</h3>
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
                                </div>
                                <hr className="settings-divider" />
                                <div className="settings-section">
                                    <h3 className="settings-header">Grid and Shading Visibility</h3>
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
                            </div>
                        )}
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