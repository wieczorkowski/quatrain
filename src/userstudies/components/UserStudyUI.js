/**
 * UserStudyUI - Dynamic UI generation for user study settings
 * Generates settings UI dynamically from study schemas
 */

import React, { useState, useEffect } from 'react';
import './UserStudyUI.css';

const UserStudyUI = ({ studyId, config, settings, onSettingChange, forceUpdateTrigger }) => {
    // Use forceUpdateTrigger to ensure re-renders when needed
    const [, forceUpdate] = useState(0);
    
    // Re-render when forceUpdateTrigger changes
    useEffect(() => {
        if (forceUpdateTrigger !== undefined) {
            forceUpdate(prev => prev + 1);
        }
    }, [forceUpdateTrigger]);

    if (!config.settingsSchema) {
        return (
            <div className="no-settings">
                <p>No settings available for this study.</p>
            </div>
        );
    }

    const renderControl = (control, sectionKey = '') => {
        const fullKey = sectionKey ? `${sectionKey}.${control.key}` : control.key;
        const value = getNestedValue(settings, fullKey) ?? control.default;
        
        // Debug output for checkbox controls
        if (control.type === 'checkbox') {
            console.log(`[UI-DEBUG] Checkbox ${fullKey}:`, {
                fullKey,
                value,
                boolValue: Boolean(value),
                settings,
                studyId
            });
        }

        switch (control.type) {
            case 'checkbox':
                return renderCheckbox(control, fullKey, value);
            case 'color':
                return renderColor(control, fullKey, value);
            case 'range':
                return renderRange(control, fullKey, value);
            case 'number':
                return renderNumber(control, fullKey, value);
            case 'select':
                return renderSelect(control, fullKey, value);
            case 'time':
                return renderTime(control, fullKey, value);
            default:
                console.warn(`Unknown control type: ${control.type}`);
                return null;
        }
    };

    const renderCheckbox = (control, key, value) => (
        <div key={key} className="control-group checkbox-group">
            <label className="checkbox-label">
                <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => onSettingChange(studyId, key, e.target.checked)}
                    className="checkbox-input"
                />
                <span className="checkbox-custom"></span>
                <span className="control-label">{control.label}</span>
                {control.tooltip && (
                    <span className="tooltip-icon" title={control.tooltip}>
                        ❓
                    </span>
                )}
            </label>
        </div>
    );

    const renderColor = (control, key, value) => (
        <div key={key} className="control-group color-group">
            <label className="control-label-wrapper">
                <span className="control-label">{control.label}</span>
                {control.tooltip && (
                    <span className="tooltip-icon" title={control.tooltip}>
                        ❓
                    </span>
                )}
            </label>
            <div className="color-control">
                <input
                    type="color"
                    value={value || control.default || '#000000'}
                    onChange={(e) => onSettingChange(studyId, key, e.target.value)}
                    className="color-input"
                />
                <span className="color-value">{value || control.default}</span>
            </div>
        </div>
    );

    const renderRange = (control, key, value) => (
        <div key={key} className="control-group range-group">
            <label className="control-label-wrapper">
                <span className="control-label">{control.label}</span>
                {control.tooltip && (
                    <span className="tooltip-icon" title={control.tooltip}>
                        ❓
                    </span>
                )}
            </label>
            <div className="range-control">
                <input
                    type="range"
                    min={control.min || 0}
                    max={control.max || 100}
                    step={control.step || 1}
                    value={value ?? control.default}
                    onChange={(e) => onSettingChange(studyId, key, parseFloat(e.target.value))}
                    className="range-input"
                />
                <span className="range-value">
                    {control.showPercentage 
                        ? `${Math.round((value ?? control.default) * 100)}%`
                        : (value ?? control.default)
                    }
                </span>
            </div>
        </div>
    );

    const renderNumber = (control, key, value) => (
        <div key={key} className="control-group number-group">
            <label className="control-label-wrapper">
                <span className="control-label">{control.label}</span>
                {control.tooltip && (
                    <span className="tooltip-icon" title={control.tooltip}>
                        ❓
                    </span>
                )}
            </label>
            <div className="number-control">
                <input
                    type="number"
                    min={control.min}
                    max={control.max}
                    value={value ?? control.default}
                    onChange={(e) => onSettingChange(studyId, key, parseFloat(e.target.value) || 0)}
                    className="number-input"
                />
                {control.suffix && (
                    <span className="input-suffix">{control.suffix}</span>
                )}
            </div>
        </div>
    );

    const renderSelect = (control, key, value) => (
        <div key={key} className="control-group select-group">
            <label className="control-label-wrapper">
                <span className="control-label">{control.label}</span>
                {control.tooltip && (
                    <span className="tooltip-icon" title={control.tooltip}>
                        ❓
                    </span>
                )}
            </label>
            <select
                value={value ?? control.default}
                onChange={(e) => onSettingChange(studyId, key, e.target.value)}
                className="select-input"
            >
                {control.options.map(option => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );

    const renderTime = (control, key, value) => (
        <div key={key} className="control-group time-group">
            <label className="control-label-wrapper">
                <span className="control-label">{control.label}</span>
                {control.tooltip && (
                    <span className="tooltip-icon" title={control.tooltip}>
                        ❓
                    </span>
                )}
            </label>
            <input
                type="time"
                value={value || control.default || '09:30'}
                onChange={(e) => onSettingChange(studyId, key, e.target.value)}
                className="time-input"
            />
        </div>
    );

    const renderSection = (section) => {
        const controls = section.controls || [];
        
        return (
            <div key={section.key || section.title} className="settings-section">
                {section.title && (
                    <h4 className="section-title">{section.title}</h4>
                )}
                <div className="section-controls">
                    {controls.map(control => renderControl(control, section.key))}
                </div>
            </div>
        );
    };

    const getNestedValue = (obj, path) => {
        // First try the nested path (e.g., "main.enabled")
        const nestedValue = path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
        
        // If nested path didn't work, try the flat key (e.g., "enabled")
        if (nestedValue === undefined && path.includes('.')) {
            const flatKey = path.split('.').pop(); // Get last part (e.g., "enabled" from "main.enabled")
            const flatValue = obj[flatKey];
            
            console.log(`[UI-DEBUG] Nested key '${path}' not found, using flat key '${flatKey}':`, flatValue);
            return flatValue;
        }
        
        return nestedValue;
    };

    return (
        <div className="user-study-ui">
            <div className="study-ui-header">
                <h4 className="study-ui-title">{config.displayName} Settings</h4>
                {config.description && (
                    <p className="study-ui-description">{config.description}</p>
                )}
            </div>
            
            <div className="study-ui-content">
                {config.settingsSchema.map(section => {
                    if (section.type === 'section') {
                        return renderSection(section);
                    } else {
                        // Handle controls not wrapped in sections
                        return renderControl(section);
                    }
                })}
            </div>

            <div className="study-ui-footer">
                <div className="current-settings-preview">
                    <details className="settings-details">
                        <summary>View Raw Settings</summary>
                        <pre className="settings-json">
                            {JSON.stringify(settings, null, 2)}
                        </pre>
                    </details>
                </div>
            </div>
        </div>
    );
};

export default UserStudyUI; 