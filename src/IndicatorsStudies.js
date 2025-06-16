import React, { useState } from 'react';
import './IndicatorsStudies.css';
import internalStrategyAnnotations from './InternalStrategyAnnotations';
import sessionLabelsAnnotations from './SessionLabelsAnnotations';
import killzonesAnnotations from './KillzonesAnnotations';
import ictPriceLinesAnnotations from './IctPriceLinesAnnotations';
// import openingGapsAnnotations from './OpeningGapsAnnotations'; // DISABLED - Converted to User Study
import { FaQuestionCircle } from 'react-icons/fa';

const IndicatorsStudies = ({ onClose, sessions = [] }) => {
    const [selectedItem, setSelectedItem] = useState('sessionTracker');
    
    // Get current internal strategy annotation settings
    const [internalSettings, setInternalSettings] = useState(internalStrategyAnnotations.getSettings());
    
    // Get current session labels annotation settings
    const [sessionSettings, setSessionSettings] = useState(sessionLabelsAnnotations.getSettings());
    
    // Get current killzones annotation settings
    const [killzonesSettings, setKillzonesSettings] = useState(killzonesAnnotations.getSettings());
    
    // Get current ICT price lines annotation settings
    const [ictSettings, setIctSettings] = useState(ictPriceLinesAnnotations.getSettings());
    
    // Get current opening gaps annotation settings - DISABLED - Converted to User Study
    // const [openingGapsSettings, setOpeningGapsSettings] = useState(openingGapsAnnotations.getSettings());
    
    // Handle Previous Day High/Low settings changes
    const handlePDHLEnabledChange = (enabled) => {
        const newSettings = {
            previousDayHighLow: {
                ...internalSettings.previousDayHighLow,
                enabled: enabled
            }
        };
        setInternalSettings({ ...internalSettings, ...newSettings });
        internalStrategyAnnotations.updateSettings(newSettings);
    };
    
    const handlePDHLColorChange = (color) => {
        const newSettings = {
            previousDayHighLow: {
                ...internalSettings.previousDayHighLow,
                color: color
            }
        };
        setInternalSettings({ ...internalSettings, ...newSettings });
        internalStrategyAnnotations.updateSettings(newSettings);
    };

    // Handle Pre-Market High/Low settings changes
    const handlePMHLEnabledChange = (enabled) => {
        const newSettings = {
            preMarketHighLow: {
                ...internalSettings.preMarketHighLow,
                enabled: enabled
            }
        };
        setInternalSettings({ ...internalSettings, ...newSettings });
        internalStrategyAnnotations.updateSettings(newSettings);
    };
    
    const handlePMHLColorChange = (color) => {
        const newSettings = {
            preMarketHighLow: {
                ...internalSettings.preMarketHighLow,
                color: color
            }
        };
        setInternalSettings({ ...internalSettings, ...newSettings });
        internalStrategyAnnotations.updateSettings(newSettings);
    };

    const handlePMHLBeginTimeChange = (time) => {
        const newSettings = {
            preMarketHighLow: {
                ...internalSettings.preMarketHighLow,
                beginTime: time
            }
        };
        setInternalSettings({ ...internalSettings, ...newSettings });
        internalStrategyAnnotations.updateSettings(newSettings);
    };

    const handlePMHLEndTimeChange = (time) => {
        const newSettings = {
            preMarketHighLow: {
                ...internalSettings.preMarketHighLow,
                endTime: time
            }
        };
        setInternalSettings({ ...internalSettings, ...newSettings });
        internalStrategyAnnotations.updateSettings(newSettings);
    };

    // Handle 30-minute ORB settings changes
    const handleOrb30EnabledChange = (enabled) => {
        const newSettings = {
            orb30: {
                ...internalSettings.orb30,
                enabled: enabled
            }
        };
        setInternalSettings({ ...internalSettings, ...newSettings });
        internalStrategyAnnotations.updateSettings(newSettings);
    };
    
    const handleOrb30ColorChange = (color) => {
        const newSettings = {
            orb30: {
                ...internalSettings.orb30,
                color: color
            }
        };
        setInternalSettings({ ...internalSettings, ...newSettings });
        internalStrategyAnnotations.updateSettings(newSettings);
    };

    const handleOrb30BeginTimeChange = (time) => {
        const newSettings = {
            orb30: {
                ...internalSettings.orb30,
                beginTime: time
            }
        };
        setInternalSettings({ ...internalSettings, ...newSettings });
        internalStrategyAnnotations.updateSettings(newSettings);
    };

    // Handle London High/Low settings changes
    const handleLondonEnabledChange = (enabled) => {
        const newSettings = {
            londonHighLow: {
                ...internalSettings.londonHighLow,
                enabled: enabled
            }
        };
        setInternalSettings({ ...internalSettings, ...newSettings });
        internalStrategyAnnotations.updateSettings(newSettings);
    };
    
    const handleLondonColorChange = (color) => {
        const newSettings = {
            londonHighLow: {
                ...internalSettings.londonHighLow,
                color: color
            }
        };
        setInternalSettings({ ...internalSettings, ...newSettings });
        internalStrategyAnnotations.updateSettings(newSettings);
    };

    const handleLondonBeginTimeChange = (time) => {
        const newSettings = {
            londonHighLow: {
                ...internalSettings.londonHighLow,
                beginTime: time
            }
        };
        setInternalSettings({ ...internalSettings, ...newSettings });
        internalStrategyAnnotations.updateSettings(newSettings);
    };

    const handleLondonEndTimeChange = (time) => {
        const newSettings = {
            londonHighLow: {
                ...internalSettings.londonHighLow,
                endTime: time
            }
        };
        setInternalSettings({ ...internalSettings, ...newSettings });
        internalStrategyAnnotations.updateSettings(newSettings);
    };

    // Handle Session Labels settings changes
    const handleSessionSettingChange = (sessionType, setting, value) => {
        const newSettings = {
            [sessionType]: {
                ...sessionSettings[sessionType],
                [setting]: value
            }
        };
        setSessionSettings({ ...sessionSettings, ...newSettings });
        sessionLabelsAnnotations.updateSettings(newSettings);
    };

    const handleDaysBackChange = (value) => {
        const newSettings = {
            daysBack: parseInt(value)
        };
        setSessionSettings({ ...sessionSettings, ...newSettings });
        sessionLabelsAnnotations.updateSettings(newSettings);
    };

    const handleShowLabelsChange = (value) => {
        const newSettings = {
            showLabels: value
        };
        setSessionSettings({ ...sessionSettings, ...newSettings });
        sessionLabelsAnnotations.updateSettings(newSettings);
    };

    // Handle Killzones settings changes
    const handleKillzonesDaysBackChange = (value) => {
        const newSettings = {
            daysBack: parseInt(value)
        };
        setKillzonesSettings({ ...killzonesSettings, ...newSettings });
        killzonesAnnotations.updateSettings(newSettings);
    };

    const handleKillzoneSettingChange = (killzoneKey, setting, value) => {
        const newSettings = {
            [killzoneKey]: {
                ...killzonesSettings[killzoneKey],
                [setting]: value
            }
        };
        setKillzonesSettings({ ...killzonesSettings, ...newSettings });
        killzonesAnnotations.updateSettings(newSettings);
    };

    // Handle ICT Price Lines settings changes
    const handleIctDaysBackChange = (value) => {
        const newSettings = {
            daysBack: parseInt(value)
        };
        setIctSettings({ ...ictSettings, ...newSettings });
        ictPriceLinesAnnotations.updateSettings(newSettings);
    };

    const handleIctLondonTimeRangeChange = (setting, value) => {
        const newSettings = {
            londonTimeRange: {
                ...ictSettings.londonTimeRange,
                [setting]: value
            }
        };
        setIctSettings({ ...ictSettings, ...newSettings });
        ictPriceLinesAnnotations.updateSettings(newSettings);
    };

    const handleIctSettingChange = (lineType, setting, value) => {
        const newSettings = {
            [lineType]: {
                ...ictSettings[lineType],
                [setting]: value
            }
        };
        setIctSettings({ ...ictSettings, ...newSettings });
        ictPriceLinesAnnotations.updateSettings(newSettings);
    };

    const handleIctTextColorChange = (color) => {
        const newSettings = {
            textColor: color
        };
        setIctSettings({ ...ictSettings, ...newSettings });
        ictPriceLinesAnnotations.updateSettings(newSettings);
    };

    // Handle Opening Gaps settings changes
    // Opening gaps settings handler - DISABLED - Converted to User Study
    // const handleOpeningGapsSettingChange = (setting, value) => {
    //     const newSettings = {
    //         [setting]: value
    //     };
    //     setOpeningGapsSettings({ ...openingGapsSettings, ...newSettings });
    //     openingGapsAnnotations.updateSettings(newSettings);
    // };

    // Helper function to format timestamps
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Active';
        
        const date = new Date(timestamp);
        
        // Format as MM/DD HH:MM
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${month}/${day} ${hours}:${minutes}`;
    };

    const renderContent = () => {
        switch (selectedItem) {
            case 'sessionTracker':
                return (
                    <div className="content-section">
                        <h3>Session Tracker</h3>
                        <div className="scrollable-content">
                            {sessions.length > 0 ? (
                                <table className="sessions-table">
                                    <thead>
                                        <tr>
                                            <th>Session</th>
                                            <th>Start Time</th>
                                            <th>End Time</th>
                                            <th>Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sessions.map((session, index) => {
                                            // Calculate duration (in minutes)
                                            let duration = "Active";
                                            if (session.endTime) {
                                                const durationMs = session.endTime - session.startTime;
                                                const durationMinutes = Math.round(durationMs / (60 * 1000));
                                                duration = `${durationMinutes} min`;
                                            }
                                            
                                            return (
                                                <tr key={index} className={session.relativeNumber === 0 ? 'current-session' : ''}>
                                                    <td>{session.relativeNumber}</td>
                                                    <td>{formatTimestamp(session.startTime)}</td>
                                                    <td>{formatTimestamp(session.endTime)}</td>
                                                    <td>{duration}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="no-data-message">No session data available. Connect to a data source to track trading sessions.</p>
                            )}
                        </div>
                    </div>
                );
            case 'priceLevels':
                return (
                    <div className="content-section">
                        <h3>Price Levels</h3>
                        <div className="scrollable-content">
                            <div className="price-level-indicator">
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={internalSettings.previousDayHighLow.enabled}
                                                onChange={(e) => handlePDHLEnabledChange(e.target.checked)}
                                            />
                                            Enable Previous Day High/Low
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays horizontal lines marking the highest and lowest prices from the previous trading session. Lines are labeled as 'PDH' (Previous Day High) and 'PDL' (Previous Day Low)."
                                            />
                                        </label>
                                        <label className="color-label">
                                            Color:
                                            <input
                                                type="color"
                                                value={internalSettings.previousDayHighLow.color}
                                                onChange={(e) => handlePDHLColorChange(e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="price-level-indicator">
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={internalSettings.preMarketHighLow.enabled}
                                                onChange={(e) => handlePMHLEnabledChange(e.target.checked)}
                                            />
                                            Enable Pre-Market High/Low
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays horizontal lines marking the highest and lowest prices during the pre-market session of the current trading day. Lines are labeled as 'PMH' (Pre-Market High) and 'PML' (Pre-Market Low). The pre-market session is defined by the Begin and End times below."
                                            />
                                        </label>
                                        <label className="color-label">
                                            Color:
                                            <input
                                                type="color"
                                                value={internalSettings.preMarketHighLow.color}
                                                onChange={(e) => handlePMHLColorChange(e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="time-label">
                                            Begin:
                                            <input
                                                type="time"
                                                value={internalSettings.preMarketHighLow.beginTime}
                                                onChange={(e) => handlePMHLBeginTimeChange(e.target.value)}
                                                className="time-picker"
                                            />
                                        </label>
                                        <label className="time-label">
                                            End:
                                            <input
                                                type="time"
                                                value={internalSettings.preMarketHighLow.endTime}
                                                onChange={(e) => handlePMHLEndTimeChange(e.target.value)}
                                                className="time-picker"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="price-level-indicator">
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={internalSettings.orb30.enabled}
                                                onChange={(e) => handleOrb30EnabledChange(e.target.checked)}
                                            />
                                            Enable 30-minute ORB
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays dashed horizontal lines marking the highest and lowest prices during the first 30 minutes of the trading session. Lines are labeled as 'orb30 H' (Opening Range Block High) and 'orb30 L' (Opening Range Block Low). The 30-minute range starts at the Begin time specified below."
                                            />
                                        </label>
                                        <label className="color-label">
                                            Color:
                                            <input
                                                type="color"
                                                value={internalSettings.orb30.color}
                                                onChange={(e) => handleOrb30ColorChange(e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="time-label">
                                            Begin:
                                            <input
                                                type="time"
                                                value={internalSettings.orb30.beginTime}
                                                onChange={(e) => handleOrb30BeginTimeChange(e.target.value)}
                                                className="time-picker"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="price-level-indicator">
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={internalSettings.londonHighLow.enabled}
                                                onChange={(e) => handleLondonEnabledChange(e.target.checked)}
                                            />
                                            Enable London High/Low
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays solid horizontal lines marking the highest and lowest prices during the London trading session. Lines are labeled as 'Lon H' (London High) and 'Lon L' (London Low). The London session is defined by the Begin and End times specified below."
                                            />
                                        </label>
                                        <label className="color-label">
                                            Color:
                                            <input
                                                type="color"
                                                value={internalSettings.londonHighLow.color}
                                                onChange={(e) => handleLondonColorChange(e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="time-label">
                                            Begin:
                                            <input
                                                type="time"
                                                value={internalSettings.londonHighLow.beginTime}
                                                onChange={(e) => handleLondonBeginTimeChange(e.target.value)}
                                                className="time-picker"
                                            />
                                        </label>
                                        <label className="time-label">
                                            End:
                                            <input
                                                type="time"
                                                value={internalSettings.londonHighLow.endTime}
                                                onChange={(e) => handleLondonEndTimeChange(e.target.value)}
                                                className="time-picker"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'sessionLabels':
                return (
                    <div className="content-section">
                        <h3>Session Labels</h3>
                        <div className="scrollable-content">
                            {/* Global Settings */}
                            <div className="session-global-settings">
                                <div className="control-row">
                                    <label className="number-label">
                                        Display Only
                                        <input
                                            type="number"
                                            min="1"
                                            max="30"
                                            value={sessionSettings.daysBack}
                                            onChange={(e) => handleDaysBackChange(e.target.value)}
                                            className="number-picker"
                                        />
                                        Days Back
                                    </label>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={sessionSettings.showLabels}
                                            onChange={(e) => handleShowLabelsChange(e.target.checked)}
                                        />
                                        Show Labels
                                    </label>
                                </div>
                            </div>

                            {/* Asian Session */}
                            <div className="session-indicator">
                                <h4>Asian Session (19:00 - 03:00 ET)</h4>
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={sessionSettings.asianSession.enabled}
                                                onChange={(e) => handleSessionSettingChange('asianSession', 'enabled', e.target.checked)}
                                            />
                                            Enable Asian Session
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays colored boxes marking the Asian trading session from 19:00 to 03:00 Eastern Time. Boxes show the high and low price range during the session."
                                            />
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="color-label">
                                            Box Color:
                                            <input
                                                type="color"
                                                value={sessionSettings.asianSession.boxColor}
                                                onChange={(e) => handleSessionSettingChange('asianSession', 'boxColor', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Box Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={sessionSettings.asianSession.boxOpacity}
                                                onChange={(e) => handleSessionSettingChange('asianSession', 'boxOpacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(sessionSettings.asianSession.boxOpacity * 100)}%</span>
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="color-label">
                                            Border Color:
                                            <input
                                                type="color"
                                                value={sessionSettings.asianSession.borderColor}
                                                onChange={(e) => handleSessionSettingChange('asianSession', 'borderColor', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Border Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={sessionSettings.asianSession.borderOpacity}
                                                onChange={(e) => handleSessionSettingChange('asianSession', 'borderOpacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(sessionSettings.asianSession.borderOpacity * 100)}%</span>
                                        </label>
                                        <label className="number-label">
                                            Border Thickness:
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={sessionSettings.asianSession.borderThickness}
                                                onChange={(e) => handleSessionSettingChange('asianSession', 'borderThickness', parseInt(e.target.value))}
                                                className="number-picker"
                                            />
                                        </label>
                                        <label className="select-label">
                                            Border Style:
                                            <select
                                                value={sessionSettings.asianSession.borderStyle}
                                                onChange={(e) => handleSessionSettingChange('asianSession', 'borderStyle', e.target.value)}
                                                className="style-picker"
                                            >
                                                <option value="solid">Solid</option>
                                                <option value="dashed">Dashed</option>
                                                <option value="dotted">Dotted</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* London Session */}
                            <div className="session-indicator">
                                <h4>London Session (03:00 - 11:30 ET)</h4>
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={sessionSettings.londonSession.enabled}
                                                onChange={(e) => handleSessionSettingChange('londonSession', 'enabled', e.target.checked)}
                                            />
                                            Enable London Session
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays colored boxes marking the London trading session from 03:00 to 11:30 Eastern Time. Boxes show the high and low price range during the session."
                                            />
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="color-label">
                                            Box Color:
                                            <input
                                                type="color"
                                                value={sessionSettings.londonSession.boxColor}
                                                onChange={(e) => handleSessionSettingChange('londonSession', 'boxColor', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Box Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={sessionSettings.londonSession.boxOpacity}
                                                onChange={(e) => handleSessionSettingChange('londonSession', 'boxOpacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(sessionSettings.londonSession.boxOpacity * 100)}%</span>
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="color-label">
                                            Border Color:
                                            <input
                                                type="color"
                                                value={sessionSettings.londonSession.borderColor}
                                                onChange={(e) => handleSessionSettingChange('londonSession', 'borderColor', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Border Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={sessionSettings.londonSession.borderOpacity}
                                                onChange={(e) => handleSessionSettingChange('londonSession', 'borderOpacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(sessionSettings.londonSession.borderOpacity * 100)}%</span>
                                        </label>
                                        <label className="number-label">
                                            Border Thickness:
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={sessionSettings.londonSession.borderThickness}
                                                onChange={(e) => handleSessionSettingChange('londonSession', 'borderThickness', parseInt(e.target.value))}
                                                className="number-picker"
                                            />
                                        </label>
                                        <label className="select-label">
                                            Border Style:
                                            <select
                                                value={sessionSettings.londonSession.borderStyle}
                                                onChange={(e) => handleSessionSettingChange('londonSession', 'borderStyle', e.target.value)}
                                                className="style-picker"
                                            >
                                                <option value="solid">Solid</option>
                                                <option value="dashed">Dashed</option>
                                                <option value="dotted">Dotted</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* NY Session */}
                            <div className="session-indicator">
                                <h4>New York Session (09:30 - 16:00 ET)</h4>
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={sessionSettings.nySession.enabled}
                                                onChange={(e) => handleSessionSettingChange('nySession', 'enabled', e.target.checked)}
                                            />
                                            Enable New York Session
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays colored boxes marking the New York trading session from 09:30 to 16:00 Eastern Time. Boxes show the high and low price range during the session."
                                            />
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="color-label">
                                            Box Color:
                                            <input
                                                type="color"
                                                value={sessionSettings.nySession.boxColor}
                                                onChange={(e) => handleSessionSettingChange('nySession', 'boxColor', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Box Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={sessionSettings.nySession.boxOpacity}
                                                onChange={(e) => handleSessionSettingChange('nySession', 'boxOpacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(sessionSettings.nySession.boxOpacity * 100)}%</span>
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="color-label">
                                            Border Color:
                                            <input
                                                type="color"
                                                value={sessionSettings.nySession.borderColor}
                                                onChange={(e) => handleSessionSettingChange('nySession', 'borderColor', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Border Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={sessionSettings.nySession.borderOpacity}
                                                onChange={(e) => handleSessionSettingChange('nySession', 'borderOpacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(sessionSettings.nySession.borderOpacity * 100)}%</span>
                                        </label>
                                        <label className="number-label">
                                            Border Thickness:
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={sessionSettings.nySession.borderThickness}
                                                onChange={(e) => handleSessionSettingChange('nySession', 'borderThickness', parseInt(e.target.value))}
                                                className="number-picker"
                                            />
                                        </label>
                                        <label className="select-label">
                                            Border Style:
                                            <select
                                                value={sessionSettings.nySession.borderStyle}
                                                onChange={(e) => handleSessionSettingChange('nySession', 'borderStyle', e.target.value)}
                                                className="style-picker"
                                            >
                                                <option value="solid">Solid</option>
                                                <option value="dashed">Dashed</option>
                                                <option value="dotted">Dotted</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'killzones':
                return (
                    <div className="content-section">
                        <h3>Killzones</h3>
                        <div className="scrollable-content">
                            {/* Global Settings */}
                            <div className="session-global-settings">
                                <div className="control-row">
                                    <label className="number-label">
                                        Display Only
                                        <input
                                            type="number"
                                            min="1"
                                            max="30"
                                            value={killzonesSettings.daysBack}
                                            onChange={(e) => handleKillzonesDaysBackChange(e.target.value)}
                                            className="number-picker"
                                        />
                                        Days Back
                                    </label>
                                </div>
                            </div>

                            {/* Killzone 1 */}
                            <div className="session-indicator">
                                <h4>Killzone 1 (08:30 - 09:31 ET)</h4>
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={killzonesSettings.killzone1.enabled}
                                                onChange={(e) => handleKillzoneSettingChange('killzone1', 'enabled', e.target.checked)}
                                            />
                                            Enable Killzone 1
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays colored boxes marking the first ICT killzone from 08:30 to 09:31 Eastern Time. This represents the pre-market to market open transition period."
                                            />
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="time-label">
                                            Start Time:
                                            <input
                                                type="time"
                                                value={killzonesSettings.killzone1.startTime}
                                                onChange={(e) => handleKillzoneSettingChange('killzone1', 'startTime', e.target.value)}
                                                className="time-picker"
                                            />
                                        </label>
                                        <label className="time-label">
                                            End Time:
                                            <input
                                                type="time"
                                                value={killzonesSettings.killzone1.endTime}
                                                onChange={(e) => handleKillzoneSettingChange('killzone1', 'endTime', e.target.value)}
                                                className="time-picker"
                                            />
                                        </label>
                                        <label className="color-label">
                                            Color:
                                            <input
                                                type="color"
                                                value={killzonesSettings.killzone1.color}
                                                onChange={(e) => handleKillzoneSettingChange('killzone1', 'color', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={killzonesSettings.killzone1.opacity}
                                                onChange={(e) => handleKillzoneSettingChange('killzone1', 'opacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(killzonesSettings.killzone1.opacity * 100)}%</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Killzone 2 */}
                            <div className="session-indicator">
                                <h4>Killzone 2 (09:30 - 11:31 ET)</h4>
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={killzonesSettings.killzone2.enabled}
                                                onChange={(e) => handleKillzoneSettingChange('killzone2', 'enabled', e.target.checked)}
                                            />
                                            Enable Killzone 2
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays colored boxes marking the second ICT killzone from 09:30 to 11:31 Eastern Time. This represents the market open and early morning trading period."
                                            />
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="time-label">
                                            Start Time:
                                            <input
                                                type="time"
                                                value={killzonesSettings.killzone2.startTime}
                                                onChange={(e) => handleKillzoneSettingChange('killzone2', 'startTime', e.target.value)}
                                                className="time-picker"
                                            />
                                        </label>
                                        <label className="time-label">
                                            End Time:
                                            <input
                                                type="time"
                                                value={killzonesSettings.killzone2.endTime}
                                                onChange={(e) => handleKillzoneSettingChange('killzone2', 'endTime', e.target.value)}
                                                className="time-picker"
                                            />
                                        </label>
                                        <label className="color-label">
                                            Color:
                                            <input
                                                type="color"
                                                value={killzonesSettings.killzone2.color}
                                                onChange={(e) => handleKillzoneSettingChange('killzone2', 'color', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={killzonesSettings.killzone2.opacity}
                                                onChange={(e) => handleKillzoneSettingChange('killzone2', 'opacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(killzonesSettings.killzone2.opacity * 100)}%</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Killzone 3 */}
                            <div className="session-indicator">
                                <h4>Killzone 3 (13:30 - 15:01 ET)</h4>
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={killzonesSettings.killzone3.enabled}
                                                onChange={(e) => handleKillzoneSettingChange('killzone3', 'enabled', e.target.checked)}
                                            />
                                            Enable Killzone 3
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays colored boxes marking the third ICT killzone from 13:30 to 15:01 Eastern Time. This represents the afternoon trading session and London close overlap."
                                            />
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="time-label">
                                            Start Time:
                                            <input
                                                type="time"
                                                value={killzonesSettings.killzone3.startTime}
                                                onChange={(e) => handleKillzoneSettingChange('killzone3', 'startTime', e.target.value)}
                                                className="time-picker"
                                            />
                                        </label>
                                        <label className="time-label">
                                            End Time:
                                            <input
                                                type="time"
                                                value={killzonesSettings.killzone3.endTime}
                                                onChange={(e) => handleKillzoneSettingChange('killzone3', 'endTime', e.target.value)}
                                                className="time-picker"
                                            />
                                        </label>
                                        <label className="color-label">
                                            Color:
                                            <input
                                                type="color"
                                                value={killzonesSettings.killzone3.color}
                                                onChange={(e) => handleKillzoneSettingChange('killzone3', 'color', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={killzonesSettings.killzone3.opacity}
                                                onChange={(e) => handleKillzoneSettingChange('killzone3', 'opacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(killzonesSettings.killzone3.opacity * 100)}%</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Killzone 4 */}
                            <div className="session-indicator">
                                <h4>Killzone 4 (15:00 - 16:01 ET)</h4>
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={killzonesSettings.killzone4.enabled}
                                                onChange={(e) => handleKillzoneSettingChange('killzone4', 'enabled', e.target.checked)}
                                            />
                                            Enable Killzone 4
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays colored boxes marking the fourth ICT killzone from 15:00 to 16:01 Eastern Time. This represents the market close period with high institutional activity."
                                            />
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="time-label">
                                            Start Time:
                                            <input
                                                type="time"
                                                value={killzonesSettings.killzone4.startTime}
                                                onChange={(e) => handleKillzoneSettingChange('killzone4', 'startTime', e.target.value)}
                                                className="time-picker"
                                            />
                                        </label>
                                        <label className="time-label">
                                            End Time:
                                            <input
                                                type="time"
                                                value={killzonesSettings.killzone4.endTime}
                                                onChange={(e) => handleKillzoneSettingChange('killzone4', 'endTime', e.target.value)}
                                                className="time-picker"
                                            />
                                        </label>
                                        <label className="color-label">
                                            Color:
                                            <input
                                                type="color"
                                                value={killzonesSettings.killzone4.color}
                                                onChange={(e) => handleKillzoneSettingChange('killzone4', 'color', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={killzonesSettings.killzone4.opacity}
                                                onChange={(e) => handleKillzoneSettingChange('killzone4', 'opacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(killzonesSettings.killzone4.opacity * 100)}%</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'ictPriceLines':
                return (
                    <div className="content-section">
                        <h3>ICT Price Lines</h3>
                        <div className="scrollable-content">
                            {/* Global Settings */}
                            <div className="session-global-settings">
                                <div className="control-row">
                                    <label className="number-label">
                                        Display Only
                                        <input
                                            type="number"
                                            min="1"
                                            max="30"
                                            value={ictSettings.daysBack}
                                            onChange={(e) => handleIctDaysBackChange(e.target.value)}
                                            className="number-picker"
                                        />
                                        Days Back
                                    </label>
                                    <label className="color-label">
                                        Text Color:
                                        <input
                                            type="color"
                                            value={ictSettings.textColor}
                                            onChange={(e) => handleIctTextColorChange(e.target.value)}
                                            className="color-picker"
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* London Time Range */}
                            <div className="session-global-settings">
                                <h4>London Session Time Range (ET)</h4>
                                <div className="control-row">
                                    <label className="time-label">
                                        Begin Time:
                                        <input
                                            type="time"
                                            value={ictSettings.londonTimeRange.beginTime}
                                            onChange={(e) => handleIctLondonTimeRangeChange('beginTime', e.target.value)}
                                            className="time-picker"
                                        />
                                    </label>
                                    <label className="time-label">
                                        End Time:
                                        <input
                                            type="time"
                                            value={ictSettings.londonTimeRange.endTime}
                                            onChange={(e) => handleIctLondonTimeRangeChange('endTime', e.target.value)}
                                            className="time-picker"
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* NY 00:00 */}
                            <div className="session-indicator">
                                <h4>NY 00:00 - Midnight Opening Price</h4>
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={ictSettings.ny0000.enabled}
                                                onChange={(e) => handleIctSettingChange('ny0000', 'enabled', e.target.checked)}
                                            />
                                            Enable NY 00:00
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays a horizontal line at the opening price of the midnight (00:00) candle. Default style is dashed red line."
                                            />
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="color-label">
                                            Color:
                                            <input
                                                type="color"
                                                value={ictSettings.ny0000.color}
                                                onChange={(e) => handleIctSettingChange('ny0000', 'color', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={ictSettings.ny0000.opacity}
                                                onChange={(e) => handleIctSettingChange('ny0000', 'opacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(ictSettings.ny0000.opacity * 100)}%</span>
                                        </label>
                                        <label className="select-label">
                                            Line Type:
                                            <select
                                                value={ictSettings.ny0000.lineType}
                                                onChange={(e) => handleIctSettingChange('ny0000', 'lineType', e.target.value)}
                                                className="style-picker"
                                            >
                                                <option value="solid">Solid</option>
                                                <option value="dashed">Dashed</option>
                                                <option value="dotted">Dotted</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* NY 08:30 */}
                            <div className="session-indicator">
                                <h4>NY 08:30 - Pre-Market Opening Price</h4>
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={ictSettings.ny0830.enabled}
                                                onChange={(e) => handleIctSettingChange('ny0830', 'enabled', e.target.checked)}
                                            />
                                            Enable NY 08:30
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays a horizontal line at the opening price of the 08:30 candle. Default style is solid yellow line."
                                            />
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="color-label">
                                            Color:
                                            <input
                                                type="color"
                                                value={ictSettings.ny0830.color}
                                                onChange={(e) => handleIctSettingChange('ny0830', 'color', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={ictSettings.ny0830.opacity}
                                                onChange={(e) => handleIctSettingChange('ny0830', 'opacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(ictSettings.ny0830.opacity * 100)}%</span>
                                        </label>
                                        <label className="select-label">
                                            Line Type:
                                            <select
                                                value={ictSettings.ny0830.lineType}
                                                onChange={(e) => handleIctSettingChange('ny0830', 'lineType', e.target.value)}
                                                className="style-picker"
                                            >
                                                <option value="solid">Solid</option>
                                                <option value="dashed">Dashed</option>
                                                <option value="dotted">Dotted</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* NY 09:30 */}
                            <div className="session-indicator">
                                <h4>NY 09:30 - Market Opening Price</h4>
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={ictSettings.ny0930.enabled}
                                                onChange={(e) => handleIctSettingChange('ny0930', 'enabled', e.target.checked)}
                                            />
                                            Enable NY 09:30
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays a horizontal line at the opening price of the 09:30 candle (market open). Default style is solid green line."
                                            />
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="color-label">
                                            Color:
                                            <input
                                                type="color"
                                                value={ictSettings.ny0930.color}
                                                onChange={(e) => handleIctSettingChange('ny0930', 'color', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={ictSettings.ny0930.opacity}
                                                onChange={(e) => handleIctSettingChange('ny0930', 'opacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(ictSettings.ny0930.opacity * 100)}%</span>
                                        </label>
                                        <label className="select-label">
                                            Line Type:
                                            <select
                                                value={ictSettings.ny0930.lineType}
                                                onChange={(e) => handleIctSettingChange('ny0930', 'lineType', e.target.value)}
                                                className="style-picker"
                                            >
                                                <option value="solid">Solid</option>
                                                <option value="dashed">Dashed</option>
                                                <option value="dotted">Dotted</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* London Open */}
                            <div className="session-indicator">
                                <h4>London Open - 03:00 ET Opening Price</h4>
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={ictSettings.londonOpen.enabled}
                                                onChange={(e) => handleIctSettingChange('londonOpen', 'enabled', e.target.checked)}
                                            />
                                            Enable London Open
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays a horizontal line at the opening price of the 03:00 candle (London session open). Default style is solid blue line."
                                            />
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="color-label">
                                            Color:
                                            <input
                                                type="color"
                                                value={ictSettings.londonOpen.color}
                                                onChange={(e) => handleIctSettingChange('londonOpen', 'color', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={ictSettings.londonOpen.opacity}
                                                onChange={(e) => handleIctSettingChange('londonOpen', 'opacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(ictSettings.londonOpen.opacity * 100)}%</span>
                                        </label>
                                        <label className="select-label">
                                            Line Type:
                                            <select
                                                value={ictSettings.londonOpen.lineType}
                                                onChange={(e) => handleIctSettingChange('londonOpen', 'lineType', e.target.value)}
                                                className="style-picker"
                                            >
                                                <option value="solid">Solid</option>
                                                <option value="dashed">Dashed</option>
                                                <option value="dotted">Dotted</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* London High/Low */}
                            <div className="session-indicator">
                                <h4>London High/Low - Session Range</h4>
                                <div className="indicator-controls">
                                    <div className="control-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={ictSettings.londonHighLow.enabled}
                                                onChange={(e) => handleIctSettingChange('londonHighLow', 'enabled', e.target.checked)}
                                            />
                                            Enable London High/Low
                                            <FaQuestionCircle 
                                                className="help-icon"
                                                title="Displays horizontal lines at the highest and lowest prices during the London session time range. Default style is solid gray lines."
                                            />
                                        </label>
                                    </div>
                                    <div className="control-row">
                                        <label className="color-label">
                                            Color:
                                            <input
                                                type="color"
                                                value={ictSettings.londonHighLow.color}
                                                onChange={(e) => handleIctSettingChange('londonHighLow', 'color', e.target.value)}
                                                className="color-picker"
                                            />
                                        </label>
                                        <label className="opacity-label">
                                            Opacity:
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={ictSettings.londonHighLow.opacity}
                                                onChange={(e) => handleIctSettingChange('londonHighLow', 'opacity', parseFloat(e.target.value))}
                                                className="opacity-slider"
                                            />
                                            <span className="opacity-value">{Math.round(ictSettings.londonHighLow.opacity * 100)}%</span>
                                        </label>
                                        <label className="select-label">
                                            Line Type:
                                            <select
                                                value={ictSettings.londonHighLow.lineType}
                                                onChange={(e) => handleIctSettingChange('londonHighLow', 'lineType', e.target.value)}
                                                className="style-picker"
                                            >
                                                <option value="solid">Solid</option>
                                                <option value="dashed">Dashed</option>
                                                <option value="dotted">Dotted</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            // DISABLED - Opening Gaps converted to User Study
            // case 'openingGaps':
            //     return (
            //         <div className="content-section">
            //             <h3>Opening Gaps and Event Horizon</h3>
            //             <div className="scrollable-content">
            //                 <p style={{color: '#FFD700', fontWeight: 'bold', padding: '20px'}}>
            //                     Opening Gaps functionality has been converted to a User Study.<br/>
            //                     Access it through the "User Studies" panel instead.
            //                 </p>
            //             </div>
            //         </div>
            //     );
            default:
                return (
                    <div className="content-section">
                        <h3>Please select an item from the menu</h3>
                    </div>
                );
        }
    };

    return (
        <div className="indicators-studies-overlay">
            <div className="indicators-studies-panel">
                <div className="indicators-studies-header">
                    <div className="header-title">
                        <h2>Indicators and Studies</h2>
                    </div>
                    <button className="close-button" onClick={onClose}>
                        X
                    </button>
                </div>
                <div className="indicators-studies-container">
                    <div className="indicators-studies-sidebar">
                        <ul className="sidebar-menu">
                            <li 
                                className={selectedItem === 'sessionTracker' ? 'active' : ''}
                                onClick={() => setSelectedItem('sessionTracker')}
                            >
                                Session Tracker
                            </li>
                            <li 
                                className={selectedItem === 'priceLevels' ? 'active' : ''}
                                onClick={() => setSelectedItem('priceLevels')}
                            >
                                Price Levels
                            </li>
                            <li 
                                className={selectedItem === 'sessionLabels' ? 'active' : ''}
                                onClick={() => setSelectedItem('sessionLabels')}
                            >
                                Session Labels
                            </li>
                            <li 
                                className={selectedItem === 'killzones' ? 'active' : ''}
                                onClick={() => setSelectedItem('killzones')}
                            >
                                Killzones
                            </li>
                            <li 
                                className={selectedItem === 'ictPriceLines' ? 'active' : ''}
                                onClick={() => setSelectedItem('ictPriceLines')}
                            >
                                ICT PriceLines
                            </li>
                            {/* Opening Gaps menu item - DISABLED - Converted to User Study */}
                            {/* <li 
                                className={selectedItem === 'openingGaps' ? 'active' : ''}
                                onClick={() => setSelectedItem('openingGaps')}
                            >
                                Opening Gaps
                            </li> */}
                        </ul>
                    </div>
                    <div className="indicators-studies-content">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IndicatorsStudies; 