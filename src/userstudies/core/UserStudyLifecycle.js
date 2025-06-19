/**
 * UserStudyLifecycle - Manages user study lifecycle
 * Coordinates initialization, data updates, settings synchronization, and cleanup
 */

import UserStudyRegistry from './UserStudyRegistry';
import UserStudyLoader from './UserStudyLoader';
import ExternalPluginLoader from './ExternalPluginLoader';

class UserStudyLifecycle {
    constructor() {
        this.initialized = false;
        this.sciChartSurfaceRefs = null;
        this.timeframes = [];
        this.currentChartData = {};
        this.currentSessions = [];
        this.updateQueue = [];
        this.isProcessingUpdates = false;
    }

    /**
     * Get current chart context for hot reload integration
     */
    getCurrentContext() {
        return {
            initialized: this.initialized,
            sciChartSurfaceRefs: this.sciChartSurfaceRefs,
            timeframes: this.timeframes,
            currentChartData: this.currentChartData,
            currentSessions: this.currentSessions
        };
    }

    /**
     * Initialize the user study system
     * @param {Object} sciChartSurfaceRefs - Chart surface references
     * @param {Array} timeframes - Active timeframes
     * @param {Object} chartData - Initial chart data
     * @param {Array} sessions - Initial sessions
     */
    async initialize(sciChartSurfaceRefs, timeframes, chartData, sessions = []) {
        console.log('[USER-STUDIES] 🚀 Initializing User Study Lifecycle...');
        
        try {
            // Store references
            this.sciChartSurfaceRefs = sciChartSurfaceRefs;
            this.timeframes = timeframes;
            this.currentChartData = chartData;
            this.currentSessions = sessions;

            // Load user studies from library
            await UserStudyLoader.loadUserStudies();

            // Initialize all registered studies
            UserStudyRegistry.initializeStudies(
                sciChartSurfaceRefs, 
                timeframes, 
                chartData, 
                sessions
            );

            this.initialized = true;
            console.log('[USER-STUDIES] ✅ User Study Lifecycle initialized successfully');
            
            // Log status
            this.logStatus();

        } catch (error) {
            console.error('[USER-STUDIES] ❌ Error initializing User Study Lifecycle:', error);
            throw error;
        }
    }

    /**
     * Update all user studies with new data
     * @param {Object} chartData - Updated chart data
     * @param {Array} sessions - Updated sessions
     */
    updateData(chartData, sessions = []) {
        console.log('[USER-STUDIES] 🔄 UserStudyLifecycle.updateData called');
        console.log('[USER-STUDIES] 📊 Initialized:', this.initialized);
        
        if (!this.initialized) {
            console.warn('[USER-STUDIES] User Study Lifecycle not initialized - skipping data update');
            return;
        }

        console.log('[USER-STUDIES] 📊 Chart data keys:', Object.keys(chartData || {}));
        console.log('[USER-STUDIES] 📊 Queue length before:', this.updateQueue.length);

        // Queue the update to prevent overlapping calls
        this.updateQueue.push({ chartData, sessions, timestamp: Date.now() });
        
        console.log('[USER-STUDIES] 📊 Queue length after:', this.updateQueue.length);
        console.log('[USER-STUDIES] 📊 Is processing updates:', this.isProcessingUpdates);
        
        if (!this.isProcessingUpdates) {
            console.log('[USER-STUDIES] ✅ Starting processUpdateQueue');
            this.processUpdateQueue();
        } else {
            console.log('[USER-STUDIES] ⏳ Already processing updates, queued for later');
        }
    }

    /**
     * Process queued data updates
     */
    async processUpdateQueue() {
        this.isProcessingUpdates = true;

        try {
            while (this.updateQueue.length > 0) {
                const update = this.updateQueue.shift();
                await this.performDataUpdate(update.chartData, update.sessions);
                
                // Small delay to prevent overwhelming the system
                if (this.updateQueue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
        } catch (error) {
            console.error('Error processing user study updates:', error);
        } finally {
            this.isProcessingUpdates = false;
        }
    }

    /**
     * Perform actual data update
     * @param {Object} chartData - Chart data
     * @param {Array} sessions - Sessions
     */
    async performDataUpdate(chartData, sessions) {
        console.log('[USER-STUDIES] 🔄 UserStudyLifecycle.performDataUpdate called');
        
        try {
            this.currentChartData = chartData;
            this.currentSessions = sessions;

            console.log('[USER-STUDIES] ✅ Calling UserStudyRegistry.updateAllStudies');
            // Update all registered studies
            UserStudyRegistry.updateAllStudies(chartData, sessions);

        } catch (error) {
            console.error('[USER-STUDIES] Error in performDataUpdate:', error);
        }
    }

    /**
     * Update study settings and reinitialize if needed
     * @param {string} studyId - Study ID
     * @param {Object} newSettings - New settings
     */
    updateStudySettings(studyId, newSettings) {
        if (!this.initialized) return;

        try {
            const study = UserStudyRegistry.getStudy(studyId);
            if (!study) {
                console.warn(`Study ${studyId} not found for settings update`);
                return;
            }

            const oldSettings = study.getSettings();
            const wasEnabled = oldSettings.enabled;
            const willBeEnabled = newSettings.enabled;

            console.log(`🔧 Updating settings for study ${studyId}:`, newSettings);

            // Handle enable/disable state changes
            if (!wasEnabled && willBeEnabled) {
                // Study was disabled, now enabled - update settings then initialize
                console.log(`Enabling user study: ${studyId}`);
                study.updateSettings(newSettings); // Update settings first
                study.initialize(
                    this.sciChartSurfaceRefs,
                    this.timeframes,
                    this.currentChartData,
                    this.currentSessions
                );
            } else if (wasEnabled && !willBeEnabled) {
                // Study was enabled, now disabled - destroy it then update settings
                console.log(`Disabling user study: ${studyId}`);
                study.destroy();
                study.updateSettings(newSettings); // Update settings after destroying
            } else if (wasEnabled && willBeEnabled) {
                // Study remains enabled - update settings and refresh
                console.log(`Updating enabled study settings: ${studyId}`);
                study.updateSettings(newSettings); // Single call to updateSettings
            } else {
                // Study remains disabled - just update settings
                console.log(`Updating disabled study settings: ${studyId}`);
                study.updateSettings(newSettings);
            }

        } catch (error) {
            console.error(`Error updating settings for study ${studyId}:`, error);
        }
    }

    /**
     * Reload all user studies
     */
    async reloadStudies() {
        console.log('🔄 Reloading all user studies...');
        
        try {
            // Destroy existing studies
            this.destroy();

            // Reload studies from disk
            await UserStudyLoader.reloadUserStudies();

            // Re-initialize if we have chart references
            if (this.sciChartSurfaceRefs) {
                UserStudyRegistry.initializeStudies(
                    this.sciChartSurfaceRefs,
                    this.timeframes,
                    this.currentChartData,
                    this.currentSessions
                );
                this.initialized = true;
            }

            console.log('✅ User studies reloaded successfully');
            this.logStatus();

        } catch (error) {
            console.error('❌ Error reloading user studies:', error);
        }
    }

    /**
     * Destroy all user studies and clean up
     */
    destroy() {
        console.log('🧹 Destroying User Study Lifecycle...');
        
        try {
            // Clear update queue
            this.updateQueue = [];
            this.isProcessingUpdates = false;

            // Destroy all studies
            UserStudyRegistry.destroyAllStudies();

            // Cleanup external plugin system
            ExternalPluginLoader.destroy();

            // Clear references
            this.sciChartSurfaceRefs = null;
            this.timeframes = [];
            this.currentChartData = {};
            this.currentSessions = [];
            this.initialized = false;

            console.log('✅ User Study Lifecycle destroyed');

        } catch (error) {
            console.error('❌ Error destroying User Study Lifecycle:', error);
        }
    }

    /**
     * Reset and reinitialize with new chart configuration
     * @param {Object} sciChartSurfaceRefs - New chart surface references
     * @param {Array} timeframes - New timeframes
     * @param {Object} chartData - New chart data
     * @param {Array} sessions - New sessions
     */
    async reset(sciChartSurfaceRefs, timeframes, chartData, sessions = []) {
        console.log('🔄 Resetting User Study Lifecycle...');
        
        // Destroy current state
        this.destroy();
        
        // Re-initialize with new configuration
        await this.initialize(sciChartSurfaceRefs, timeframes, chartData, sessions);
    }

    /**
     * Get current status
     */
    getStatus() {
        const registryStats = UserStudyRegistry.getStats();
        const loaderStatus = UserStudyLoader.getLoadingStatus();

        return {
            initialized: this.initialized,
            chartReferencesAvailable: !!this.sciChartSurfaceRefs,
            timeframes: this.timeframes,
            dataAvailable: Object.keys(this.currentChartData).length > 0,
            sessionsAvailable: this.currentSessions.length > 0,
            updateQueueLength: this.updateQueue.length,
            isProcessingUpdates: this.isProcessingUpdates,
            registry: registryStats,
            loader: loaderStatus
        };
    }

    /**
     * Log current status for debugging
     */
    logStatus() {
        const status = this.getStatus();
        
        console.group('📊 User Study Lifecycle Status');
        console.log('Initialized:', status.initialized);
        console.log('Chart References:', status.chartReferencesAvailable);
        console.log('Timeframes:', status.timeframes);
        console.log('Data Available:', status.dataAvailable);
        console.log('Sessions Available:', status.sessionsAvailable);
        console.log('Registry Stats:', status.registry);
        console.log('Loader Status:', status.loader);
        console.groupEnd();
    }

    /**
     * Force an immediate update of all studies
     * Useful for debugging or manual refresh
     */
    forceUpdate() {
        if (!this.initialized) {
            console.warn('Cannot force update - User Study Lifecycle not initialized');
            return;
        }

        console.log('🔄 Forcing update of all user studies...');
        
        try {
            UserStudyRegistry.updateAllStudies(
                this.currentChartData,
                this.currentSessions
            );
            console.log('✅ Force update completed');
        } catch (error) {
            console.error('❌ Error during force update:', error);
        }
    }

    /**
     * Get detailed study information for debugging
     */
    getStudyDetails() {
        const studies = UserStudyRegistry.getRegisteredStudies();
        
        return studies.map(study => ({
            id: study.id,
            name: study.config.displayName,
            description: study.config.description,
            category: study.config.category,
            settings: UserStudyRegistry.getStudySettings(study.id),
            enabled: UserStudyRegistry.getStudySettings(study.id)?.enabled || false
        }));
    }

    /**
     * Export current state for backup/debugging
     */
    exportState() {
        return {
            initialized: this.initialized,
            timeframes: this.timeframes,
            studies: this.getStudyDetails(),
            status: this.getStatus(),
            timestamp: new Date().toISOString()
        };
    }
}

// Export singleton instance
export default new UserStudyLifecycle();