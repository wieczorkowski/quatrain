/**
 * UserStudyRegistry - Central registration system for user studies
 * Manages study discovery, registration, and lifecycle
 */

class UserStudyRegistry {
    constructor() {
        this.registeredStudies = new Map();
        this.loadedStudies = new Map();
        this.studyInstances = new Map();
        this.initialized = false;
    }

    /**
     * Register a user study
     * @param {string} id - Unique study ID
     * @param {Object} studyModule - Study module with required interface
     */
    registerStudy(id, studyModule) {
        // Validate required interface
        if (!this.validateStudyInterface(studyModule)) {
            console.error(`Study ${id} does not implement required interface`);
            return false;
        }

        console.log(`Registering user study: ${id}`);
        this.registeredStudies.set(id, studyModule);
        return true;
    }

    /**
     * Validate that a study implements the required interface
     * @param {Object} studyModule - Study module to validate
     */
    validateStudyInterface(studyModule) {
        const requiredMethods = [
            'initialize',
            'updateData', 
            'destroy',
            'getSettings',
            'updateSettings',
            'getUIConfig'
        ];

        return requiredMethods.every(method => {
            if (typeof studyModule[method] !== 'function') {
                console.error(`Missing required method: ${method}`);
                return false;
            }
            return true;
        });
    }

    /**
     * Get all registered studies
     */
    getRegisteredStudies() {
        return Array.from(this.registeredStudies.entries()).map(([id, study]) => ({
            id,
            config: study.getUIConfig(),
            instance: study
        }));
    }

    /**
     * Get a specific study by ID
     * @param {string} id - Study ID
     */
    getStudy(id) {
        return this.registeredStudies.get(id);
    }

    /**
     * Initialize all registered studies
     * @param {Object} sciChartSurfaceRefs - Chart surface references
     * @param {Array} timeframes - Active timeframes
     * @param {Object} chartData - Chart data by timeframe
     * @param {Array} sessions - Trading sessions
     */
    initializeStudies(sciChartSurfaceRefs, timeframes, chartData, sessions) {
        console.log('Initializing all user studies...');
        
        this.registeredStudies.forEach((study, id) => {
            try {
                const settings = study.getSettings();
                if (settings.enabled) {
                    study.initialize(sciChartSurfaceRefs, timeframes, chartData, sessions);
                    console.log(`Initialized user study: ${id}`);
                }
            } catch (error) {
                console.error(`Error initializing study ${id}:`, error);
            }
        });

        this.initialized = true;
    }

    /**
     * Update data for all initialized studies
     * @param {Object} chartData - Updated chart data
     * @param {Array} sessions - Updated sessions
     */
    updateAllStudies(chartData, sessions) {
        console.log('[USER-STUDIES] 🔄 UserStudyRegistry.updateAllStudies called');
        console.log('[USER-STUDIES] 📊 Initialized:', this.initialized);
        console.log('[USER-STUDIES] 📊 Registered studies count:', this.registeredStudies.size);
        
        if (!this.initialized) {
            console.log('[USER-STUDIES] ❌ Registry not initialized, skipping update');
            return;
        }

        this.registeredStudies.forEach((study, id) => {
            try {
                const settings = study.getSettings();
                console.log(`[USER-STUDIES] 📊 Study ${id} - enabled:`, settings.enabled);
                
                if (settings.enabled) {
                    console.log(`[USER-STUDIES] ✅ Calling updateData for study: ${id}`);
                    study.updateData(chartData, sessions);
                } else {
                    console.log(`[USER-STUDIES] ⏭️ Skipping disabled study: ${id}`);
                }
            } catch (error) {
                console.error(`[USER-STUDIES] Error updating study ${id}:`, error);
            }
        });
    }

    /**
     * Update settings for a specific study
     * @param {string} id - Study ID
     * @param {Object} newSettings - New settings
     */
    updateStudySettings(id, newSettings) {
        const study = this.registeredStudies.get(id);
        if (study) {
            // Note: This method is now primarily for direct registry access
            // The UserStudyLifecycle handles the actual updateSettings() call
            // to avoid duplication
            console.log(`Registry: Settings update requested for study: ${id}`);
            return study; // Return study for lifecycle manager to handle
        }
        return null;
    }

    /**
     * Get settings for a specific study
     * @param {string} id - Study ID
     */
    getStudySettings(id) {
        const study = this.registeredStudies.get(id);
        return study ? study.getSettings() : null;
    }

    /**
     * Destroy all studies and clean up
     */
    destroyAllStudies() {
        console.log('Destroying all user studies...');
        
        this.registeredStudies.forEach((study, id) => {
            try {
                study.destroy();
                console.log(`Destroyed user study: ${id}`);
            } catch (error) {
                console.error(`Error destroying study ${id}:`, error);
            }
        });

        this.initialized = false;
    }

    /**
     * Remove a study from registry
     * @param {string} id - Study ID to remove
     */
    unregisterStudy(id) {
        const study = this.registeredStudies.get(id);
        if (study) {
            try {
                study.destroy();
            } catch (error) {
                console.error(`Error destroying study ${id} during unregistration:`, error);
            }
            this.registeredStudies.delete(id);
            console.log(`Unregistered user study: ${id}`);
        }
    }

    /**
     * Clear all studies
     */
    clear() {
        this.destroyAllStudies();
        this.registeredStudies.clear();
        this.loadedStudies.clear();
        this.studyInstances.clear();
    }

    /**
     * Get registry statistics
     */
    getStats() {
        return {
            totalRegistered: this.registeredStudies.size,
            initialized: this.initialized,
            enabledCount: Array.from(this.registeredStudies.values())
                .filter(study => study.getSettings().enabled).length
        };
    }
}

// Export singleton instance
export default new UserStudyRegistry(); 