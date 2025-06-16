/**
 * UserStudyManager - Central interface for User Studies system
 * Provides a single entry point for App.js integration
 */

import UserStudyRegistry from './core/UserStudyRegistry';
import UserStudyLoader from './core/UserStudyLoader';
import UserStudyLifecycle from './core/UserStudyLifecycle';

class UserStudyManager {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the entire User Studies system
     * This is the main entry point called from App.js
     * @param {Object} sciChartSurfaceRefs - Chart surface references
     * @param {Array} timeframes - Active timeframes
     * @param {Object} chartData - Chart data
     * @param {Array} sessions - Trading sessions
     */
    async initialize(sciChartSurfaceRefs, timeframes, chartData, sessions = []) {
        try {
            console.log('[USER-STUDIES] 🚀 Initializing User Study Manager...');
            
            await UserStudyLifecycle.initialize(
                sciChartSurfaceRefs,
                timeframes,
                chartData,
                sessions
            );
            
            this.initialized = true;
            console.log('[USER-STUDIES] ✅ User Study Manager initialized successfully');
            
        } catch (error) {
            console.error('[USER-STUDIES] ❌ Error initializing User Study Manager:', error);
            throw error;
        }
    }

    /**
     * Update all user studies with new data
     * Called from App.js when candle data updates
     * @param {Object} chartData - Updated chart data
     * @param {Array} sessions - Updated sessions
     */
    updateAllStudies(chartData, sessions = []) {
        console.log('[USER-STUDIES] 🔄 UserStudyManager.updateAllStudies called');
        console.log('[USER-STUDIES] 📊 Initialized:', this.initialized);
        console.log('[USER-STUDIES] 📊 Chart data keys:', Object.keys(chartData || {}));
        
        if (!this.initialized) {
            console.log('[USER-STUDIES] ❌ UserStudyManager not initialized, skipping update');
            return;
        }
        
        console.log('[USER-STUDIES] ✅ Calling UserStudyLifecycle.updateData');
        UserStudyLifecycle.updateData(chartData, sessions);
    }

    /**
     * Destroy all user studies
     * Called from App.js during cleanup/reset
     */
    destroyAllStudies() {
        console.log('[USER-STUDIES] 🧹 Destroying all user studies via UserStudyManager...');
        
        try {
            UserStudyLifecycle.destroy();
            this.initialized = false;
            console.log('[USER-STUDIES] ✅ All user studies destroyed');
        } catch (error) {
            console.error('[USER-STUDIES] ❌ Error destroying user studies:', error);
        }
    }

    /**
     * Get the registry for UI components
     * @returns {Object} - UserStudyRegistry singleton
     */
    getRegistry() {
        return UserStudyRegistry;
    }

    /**
     * Get the loader for UI components
     * @returns {Object} - UserStudyLoader singleton
     */
    getLoader() {
        return UserStudyLoader;
    }

    /**
     * Get the lifecycle manager for UI components
     * @returns {Object} - UserStudyLifecycle singleton
     */
    getLifecycle() {
        return UserStudyLifecycle;
    }

    /**
     * Check if the system is initialized
     * @returns {boolean} - Initialization status
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Get comprehensive status for debugging
     * @returns {Object} - Complete system status
     */
    getSystemStatus() {
        return {
            managerInitialized: this.initialized,
            lifecycle: UserStudyLifecycle.getStatus(),
            registry: UserStudyRegistry.getStats(),
            loader: UserStudyLoader.getLoadingStatus()
        };
    }

    /**
     * Reload all user studies
     * Useful for development or when studies are updated
     */
    async reloadStudies() {
        console.log('🔄 Reloading studies via UserStudyManager...');
        
        try {
            await UserStudyLifecycle.reloadStudies();
            console.log('✅ Studies reloaded successfully');
        } catch (error) {
            console.error('❌ Error reloading studies:', error);
        }
    }

    /**
     * Reset the entire system with new configuration
     * @param {Object} sciChartSurfaceRefs - New chart surface references
     * @param {Array} timeframes - New timeframes
     * @param {Object} chartData - New chart data
     * @param {Array} sessions - New sessions
     */
    async reset(sciChartSurfaceRefs, timeframes, chartData, sessions = []) {
        console.log('🔄 Resetting User Study Manager...');
        
        try {
            await UserStudyLifecycle.reset(
                sciChartSurfaceRefs,
                timeframes,
                chartData,
                sessions
            );
            
            this.initialized = true;
            console.log('✅ User Study Manager reset successfully');
            
        } catch (error) {
            console.error('❌ Error resetting User Study Manager:', error);
            this.initialized = false;
        }
    }

    /**
     * Force update all studies
     * For debugging or manual refresh
     */
    forceUpdate() {
        UserStudyLifecycle.forceUpdate();
    }

    /**
     * Log system status for debugging
     */
    logStatus() {
        const status = this.getSystemStatus();
        
        console.group('📊 User Study Manager Status');
        console.log('Manager Initialized:', status.managerInitialized);
        console.log('Lifecycle Status:', status.lifecycle);
        console.log('Registry Stats:', status.registry);
        console.log('Loader Status:', status.loader);
        console.groupEnd();
    }
}

// Export singleton instance
const userStudyManager = new UserStudyManager();

// Also export the components for direct access if needed
export {
    UserStudyRegistry,
    UserStudyLoader,
    UserStudyLifecycle
};

export default userStudyManager; 