/**
 * UserStudyLoader - Auto-discovery system for user studies
 * Automatically discovers and loads user studies from the library/ folder
 */

import UserStudyRegistry from './UserStudyRegistry';

class UserStudyLoader {
    constructor() {
        this.loadedStudies = new Map();
        this.loadErrors = new Map();
        this.isLoaded = false;
    }

    /**
     * Auto-discover and load all user studies from library folder
     * Uses Webpack's require.context for dynamic imports
     */
    async loadUserStudies() {
        console.log('Starting user study auto-discovery...');
        
        try {
            // Use require.context to dynamically discover study files
            // This creates a context for all .js files in the library directory
            const studyContext = this.createStudyContext();
            
            if (!studyContext) {
                console.log('No user studies found in library directory');
                return;
            }

            const studyPaths = studyContext.keys();
            console.log(`Found ${studyPaths.length} potential user studies:`, studyPaths);

            // Load each discovered study
            for (const studyPath of studyPaths) {
                await this.loadStudyFromPath(studyContext, studyPath);
            }

            this.isLoaded = true;
            console.log(`User study loading complete. Loaded: ${this.loadedStudies.size}, Errors: ${this.loadErrors.size}`);
            
            // Log summary
            this.logLoadingSummary();

        } catch (error) {
            console.error('Error during user study auto-discovery:', error);
        }
    }

    /**
     * Create the require.context for study discovery
     * Handles the case where the library directory doesn't exist
     */
    createStudyContext() {
        try {
            // Try to create context for user study library
            // This will include all .js files in the library directory and subdirectories
            return require.context('../library', true, /\.js$/);
        } catch (error) {
            // Library directory doesn't exist or is empty
            console.log('User studies library directory not found or empty');
            return null;
        }
    }

    /**
     * Load a single study from a discovered path
     * @param {Function} studyContext - Webpack require.context function
     * @param {string} studyPath - Path to the study file
     */
    async loadStudyFromPath(studyContext, studyPath) {
        try {
            console.log(`Loading user study: ${studyPath}`);
            
            // Extract study ID from path
            const studyId = this.extractStudyId(studyPath);
            
            // Import the study module
            const studyModule = studyContext(studyPath);
            
            // Handle different export patterns
            const study = this.extractStudyFromModule(studyModule, studyId);
            
            if (study) {
                // Validate and register the study
                if (this.validateAndRegisterStudy(studyId, study)) {
                    this.loadedStudies.set(studyId, {
                        path: studyPath,
                        study: study,
                        loadedAt: new Date()
                    });
                    console.log(`✓ Successfully loaded user study: ${studyId}`);
                } else {
                    this.loadErrors.set(studyId, 'Failed validation');
                }
            } else {
                this.loadErrors.set(studyId, 'No valid study export found');
            }

        } catch (error) {
            const studyId = this.extractStudyId(studyPath);
            console.error(`✗ Error loading user study ${studyId}:`, error);
            this.loadErrors.set(studyId, error.message);
        }
    }

    /**
     * Extract study ID from file path
     * @param {string} studyPath - Path to study file
     * @returns {string} - Extracted study ID
     */
    extractStudyId(studyPath) {
        // Remove leading ./ and file extension
        let id = studyPath.replace(/^\.\//, '').replace(/\.js$/, '');
        
        // Replace path separators with underscores for nested files
        id = id.replace(/[\/\\]/g, '_');
        
        // Ensure ID is valid (alphanumeric + underscores)
        id = id.replace(/[^a-zA-Z0-9_]/g, '_');
        
        return id;
    }

    /**
     * Extract study instance from module exports
     * Handles various export patterns (default export, named export, etc.)
     * @param {Object} studyModule - Imported module
     * @param {string} studyId - Study ID for logging
     * @returns {Object|null} - Study instance or null
     */
    extractStudyFromModule(studyModule, studyId) {
        // Try default export first
        if (studyModule.default) {
            console.log(`Found default export for ${studyId}`);
            return studyModule.default;
        }
        
        // Try named export matching study ID
        if (studyModule[studyId]) {
            console.log(`Found named export '${studyId}' for ${studyId}`);
            return studyModule[studyId];
        }
        
        // Try common named exports
        const commonNames = ['study', 'userStudy', 'StudyClass'];
        for (const name of commonNames) {
            if (studyModule[name]) {
                console.log(`Found named export '${name}' for ${studyId}`);
                return studyModule[name];
            }
        }
        
        // If module is a class/function itself (edge case)
        if (typeof studyModule === 'function' || typeof studyModule === 'object') {
            const requiredMethods = ['initialize', 'updateData', 'destroy', 'getSettings', 'updateSettings', 'getUIConfig'];
            const hasAllMethods = requiredMethods.every(method => typeof studyModule[method] === 'function');
            
            if (hasAllMethods) {
                console.log(`Found study interface directly on module for ${studyId}`);
                return studyModule;
            }
        }
        
        console.warn(`No valid study export found in ${studyId}. Expected default export or named export.`);
        return null;
    }

    /**
     * Validate and register a study with the registry
     * @param {string} studyId - Study ID
     * @param {Object} study - Study instance
     * @returns {boolean} - Success status
     */
    validateAndRegisterStudy(studyId, study) {
        try {
            // Register with the registry (this validates the interface)
            return UserStudyRegistry.registerStudy(studyId, study);
        } catch (error) {
            console.error(`Validation failed for study ${studyId}:`, error);
            return false;
        }
    }

    /**
     * Log loading summary
     */
    logLoadingSummary() {
        console.group('📊 User Study Loading Summary');
        
        if (this.loadedStudies.size > 0) {
            console.log('✅ Successfully Loaded Studies:');
            this.loadedStudies.forEach((info, id) => {
                console.log(`  • ${id} (${info.path})`);
            });
        }
        
        if (this.loadErrors.size > 0) {
            console.log('❌ Failed to Load:');
            this.loadErrors.forEach((error, id) => {
                console.log(`  • ${id}: ${error}`);
            });
        }
        
        console.log(`📈 Total: ${this.loadedStudies.size} loaded, ${this.loadErrors.size} failed`);
        console.groupEnd();
    }

    /**
     * Reload all user studies
     * Useful for development or when studies are updated
     */
    async reloadUserStudies() {
        console.log('Reloading all user studies...');
        
        // Clear existing studies
        UserStudyRegistry.clear();
        this.loadedStudies.clear();
        this.loadErrors.clear();
        this.isLoaded = false;
        
        // Reload
        await this.loadUserStudies();
    }

    /**
     * Get loading status
     * @returns {Object} - Loading status information
     */
    getLoadingStatus() {
        return {
            isLoaded: this.isLoaded,
            loadedCount: this.loadedStudies.size,
            errorCount: this.loadErrors.size,
            loadedStudies: Array.from(this.loadedStudies.keys()),
            errors: Object.fromEntries(this.loadErrors)
        };
    }

    /**
     * Check if studies directory exists and create instructions if not
     */
    checkStudiesDirectory() {
        try {
            this.createStudyContext();
            return true;
        } catch (error) {
            console.log('📁 User Studies Directory Setup');
            console.log('To use user studies, create the following directory structure:');
            console.log('src/userstudies/library/');
            console.log('');
            console.log('Then place your .js study files in the library directory.');
            console.log('Studies will be auto-discovered on next Quatrain restart.');
            return false;
        }
    }

    /**
     * Hot reload a specific study (development helper)
     * @param {string} studyId - Study ID to reload
     */
    async hotReloadStudy(studyId) {
        console.log(`Hot reloading study: ${studyId}`);
        
        // Remove existing study
        UserStudyRegistry.unregisterStudy(studyId);
        this.loadedStudies.delete(studyId);
        this.loadErrors.delete(studyId);
        
        // Try to reload
        const studyContext = this.createStudyContext();
        if (studyContext) {
            const studyPaths = studyContext.keys();
            const matchingPath = studyPaths.find(path => this.extractStudyId(path) === studyId);
            
            if (matchingPath) {
                await this.loadStudyFromPath(studyContext, matchingPath);
                console.log(`Hot reload complete for: ${studyId}`);
            } else {
                console.warn(`Study file not found for hot reload: ${studyId}`);
            }
        }
    }
}

// Export singleton instance
export default new UserStudyLoader(); 