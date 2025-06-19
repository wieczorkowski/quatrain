/**
 * UserStudiesPanel - Main UI panel for user studies management
 * Completely separate from the existing "Indicators and Studies" panel
 */

import React, { useState, useEffect } from 'react';
import UserStudyRegistry from '../core/UserStudyRegistry';
import UserStudyLoader from '../core/UserStudyLoader';
import UserStudyLifecycle from '../core/UserStudyLifecycle';
import UserStudyUI from './UserStudyUI';
import './UserStudiesPanel.css';

const UserStudiesPanel = ({ onClose, sciChartSurface, candles, sessions = [] }) => {
    const [studies, setStudies] = useState([]);
    const [loadingStatus, setLoadingStatus] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedStudies, setExpandedStudies] = useState(new Set());
    const [forceUpdateCounter, setForceUpdateCounter] = useState(0);
    const [showErrorLog, setShowErrorLog] = useState(false);

    useEffect(() => {
        refreshStudies();
    }, []);

    const refreshStudies = () => {
        const registeredStudies = UserStudyRegistry.getRegisteredStudies();
        setStudies(registeredStudies);
        setLoadingStatus(UserStudyLoader.getLoadingStatus());
    };

    const handleStudySettingChange = (studyId, settingKey, value) => {
        console.log(`🔧 [DEBUG] handleStudySettingChange called:`, { studyId, settingKey, value });
        
        const currentSettings = UserStudyRegistry.getStudySettings(studyId);
        console.log(`📋 [DEBUG] Current settings from registry:`, currentSettings);
        
        const newSettings = { ...currentSettings };
        
        // Handle nested settings (e.g., "sessions.asian.color")
        if (settingKey.includes('.')) {
            const keys = settingKey.split('.');
            let current = newSettings;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
        } else {
            newSettings[settingKey] = value;
        }

        console.log(`📝 [DEBUG] New settings to apply:`, newSettings);

        // Use UserStudyLifecycle to handle settings updates properly
        console.log(`⚙️ [DEBUG] Calling UserStudyLifecycle.updateStudySettings...`);
        UserStudyLifecycle.updateStudySettings(studyId, newSettings);
        
        // FIXED: Force immediate UI refresh for all setting changes
        // This ensures the UI reflects changes immediately rather than waiting for data updates
        setTimeout(() => {
            refreshStudies();
            setForceUpdateCounter(prev => prev + 1);
        }, 10); // Very short delay to ensure the study has processed the update
        
        // Verify the settings were actually updated
        setTimeout(() => {
            const verifySettings = UserStudyRegistry.getStudySettings(studyId);
            console.log(`✅ [DEBUG] Settings after update:`, verifySettings);
            console.log(`🔍 [DEBUG] Setting '${settingKey}' is now:`, settingKey.includes('.') ? 
                settingKey.split('.').reduce((obj, key) => obj?.[key], verifySettings) : 
                verifySettings?.[settingKey]);
        }, 50);
    };

    const toggleStudyExpanded = (studyId) => {
        const newExpanded = new Set(expandedStudies);
        if (newExpanded.has(studyId)) {
            newExpanded.delete(studyId);
        } else {
            newExpanded.add(studyId);
        }
        setExpandedStudies(newExpanded);
    };

    const getCategories = () => {
        const categories = new Set();
        studies.forEach(study => {
            const category = study.config.category || 'uncategorized';
            categories.add(category);
        });
        return ['all', ...Array.from(categories).sort()];
    };

    const getFilteredStudies = () => {
        return studies.filter(study => {
            // Category filter
            if (selectedCategory !== 'all') {
                const category = study.config.category || 'uncategorized';
                if (category !== selectedCategory) return false;
            }

            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const nameMatch = study.config.displayName?.toLowerCase().includes(searchLower);
                const descMatch = study.config.description?.toLowerCase().includes(searchLower);
                const idMatch = study.id.toLowerCase().includes(searchLower);
                
                if (!nameMatch && !descMatch && !idMatch) return false;
            }

            return true;
        });
    };

    const reloadUserStudies = async () => {
        console.log('Reloading user studies...');
        await UserStudyLoader.reloadUserStudies();
        refreshStudies();
    };

    const showErrorLogModal = () => {
        setShowErrorLog(true);
    };

    const closeErrorLog = () => {
        setShowErrorLog(false);
    };

    const exportStudySettings = () => {
        const allSettings = {};
        studies.forEach(study => {
            allSettings[study.id] = UserStudyRegistry.getStudySettings(study.id);
        });

        const dataStr = JSON.stringify(allSettings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'quatrain-user-studies-settings.json';
        link.click();
        
        URL.revokeObjectURL(url);
    };

    const importStudySettings = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                
                Object.entries(settings).forEach(([studyId, studySettings]) => {
                    if (UserStudyRegistry.getStudy(studyId)) {
                        UserStudyRegistry.updateStudySettings(studyId, studySettings);
                    }
                });
                
                refreshStudies();
                console.log('User study settings imported successfully');
            } catch (error) {
                console.error('Error importing settings:', error);
                alert('Error importing settings: Invalid file format');
            }
        };
        reader.readAsText(file);
        
        // Reset input
        event.target.value = '';
    };

    const filteredStudies = getFilteredStudies();
    const categories = getCategories();

    // Handle click on overlay background to close panel
    const handleOverlayClick = (e) => {
        if (e.target.className === 'user-studies-overlay') {
            onClose();
        }
    };

    return (
        <div className="user-studies-overlay" onClick={handleOverlayClick}>
            <div className="user-studies-panel">
                <div className="user-studies-header">
                    <div className="user-studies-title">
                        <h3>User Studies</h3>
                        <span className="study-count">
                            {loadingStatus && `${loadingStatus.loadedCount} loaded`}
                        </span>
                    </div>
                    <button className="close-button" onClick={onClose}>
                        ×
                    </button>
                </div>

            <div className="user-studies-toolbar">
                <div className="search-section">
                    <input
                        type="text"
                        placeholder="Search studies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="category-section">
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="category-select"
                    >
                        {categories.map(category => (
                            <option key={category} value={category}>
                                {category === 'all' ? 'All Categories' : 
                                 category.charAt(0).toUpperCase() + category.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="action-section">
                    <button 
                        onClick={reloadUserStudies}
                        className="action-button reload-button"
                        title="Reload user studies"
                    >
                        🔄
                    </button>
                    {loadingStatus && loadingStatus.errorCount > 0 && (
                        <button 
                            onClick={showErrorLogModal}
                            className="action-button error-log-button"
                            title={`View error log (${loadingStatus.errorCount} errors)`}
                        >
                            ⚠️
                        </button>
                    )}
                    <button 
                        onClick={exportStudySettings}
                        className="action-button export-button"
                        title="Export settings"
                    >
                        📤
                    </button>
                    <label className="action-button import-button" title="Import settings">
                        📥
                        <input
                            type="file"
                            accept=".json"
                            onChange={importStudySettings}
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>
            </div>

            {loadingStatus && loadingStatus.errorCount > 0 && (
                <div className="loading-errors">
                    <div className="error-header">
                        ⚠️ {loadingStatus.errorCount} studies failed to load
                    </div>
                    <div className="error-details">
                        {Object.entries(loadingStatus.errors).map(([studyId, error]) => (
                            <div key={studyId} className="error-item">
                                <strong>{studyId}:</strong> {error}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="user-studies-content">
                {filteredStudies.length === 0 ? (
                    <div className="no-studies">
                        {studies.length === 0 ? (
                            <div className="no-studies-message">
                                <h4>No User Studies Found</h4>
                                <p>To add user studies:</p>
                                <ol>
                                    <li>Create the directory: <code>studies/</code> in your workspace root</li>
                                    <li>Add your .js study files to this directory</li>
                                    <li>Click the reload button (🔄) or restart Quatrain</li>
                                </ol>
                                {loadingStatus && loadingStatus.external && (
                                    <div className="plugin-status">
                                        <p><strong>Plugin Directory:</strong> {loadingStatus.external.pluginDirectory}</p>
                                        <p><strong>Status:</strong> Looking for plugins in external directory...</p>
                                    </div>
                                )}
                                <p>See the development guide for creating studies.</p>
                            </div>
                        ) : (
                            <div className="no-results">
                                No studies match your current filters.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="studies-list">
                        {filteredStudies.map(study => (
                            <div key={study.id} className="study-item">
                                <div 
                                    className="study-header"
                                    onClick={() => toggleStudyExpanded(study.id)}
                                >
                                    <div className="study-info">
                                        <h4 className="study-name">
                                            {study.config.displayName || study.id}
                                        </h4>
                                        <p className="study-description">
                                            {study.config.description || 'No description provided'}
                                        </p>
                                        {study.config.category && (
                                            <span className="study-category">
                                                {study.config.category}
                                            </span>
                                        )}
                                    </div>
                                    <div className="study-controls">
                                        <div className="expand-icon">
                                            {expandedStudies.has(study.id) ? '▼' : '▶'}
                                        </div>
                                    </div>
                                </div>

                                {expandedStudies.has(study.id) && (
                                    <div className="study-settings">
                                        <UserStudyUI
                                            key={study.id}
                                            studyId={study.id}
                                            config={study.config}
                                            settings={UserStudyRegistry.getStudySettings(study.id)}
                                            onSettingChange={handleStudySettingChange}
                                            forceUpdateTrigger={forceUpdateCounter}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="user-studies-footer">
                <div className="status-info">
                    Studies: {filteredStudies.length} shown, {studies.length} total
                    {loadingStatus && loadingStatus.external && (
                        <span className="plugin-info">
                            {' | '}Plugin Dir: {loadingStatus.external.pluginDirectory}
                            {loadingStatus.external.externalLoadedCount > 0 && 
                                ` | ${loadingStatus.external.externalLoadedCount} external plugins`}
                            {loadingStatus.external.externalErrorCount > 0 && 
                                ` | ${loadingStatus.external.externalErrorCount} errors`}
                        </span>
                    )}
                </div>
                <div className="help-info">
                    Plugin System: Drop .js files in /studies folder for hot reload
                </div>
            </div>

            {/* Error Log Modal */}
            {showErrorLog && (
                <div className="error-log-modal-overlay" onClick={closeErrorLog}>
                    <div className="error-log-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="error-log-header">
                            <h3>Plugin Loading Error Log</h3>
                            <button className="close-button" onClick={closeErrorLog}>×</button>
                        </div>
                        <div className="error-log-content">
                            {loadingStatus && loadingStatus.errors && Object.keys(loadingStatus.errors).length > 0 ? (
                                <div className="error-list">
                                    {Object.entries(loadingStatus.errors).map(([pluginId, error]) => (
                                        <div key={pluginId} className="error-entry">
                                            <div className="error-plugin-name">{pluginId}</div>
                                            <div className="error-message">{error}</div>
                                            <div className="error-timestamp">{new Date().toLocaleTimeString()}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="no-errors">No errors to display</div>
                            )}
                        </div>
                        <div className="error-log-footer">
                            <div className="error-log-help">
                                <strong>Common Issues:</strong>
                                <ul>
                                    <li>Missing export statement: Add `export default ClassName;` at end of file</li>
                                    <li>Invalid plugin interface: Ensure all required methods are implemented</li>
                                    <li>Syntax errors: Check console for detailed JavaScript errors</li>
                                    <li>Import issues: Remove ES6 imports - dependencies are injected</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default UserStudiesPanel; 