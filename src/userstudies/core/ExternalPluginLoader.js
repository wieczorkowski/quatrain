/**
 * ExternalPluginLoader - Loads user studies from external directories
 * Replaces webpack require.context with Node.js file system loading
 * Enables plugin architecture with hot reload capabilities
 */

// Browser-compatible imports
// These will be provided by Electron's main process
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
const path = window.require ? window.require('path') : null;
const fs = window.require ? window.require('fs') : null;
const chokidar = window.require ? window.require('chokidar') : null;
import { 
    // All SciChart Annotation Classes for plugin access
    HorizontalLineAnnotation, 
    VerticalLineAnnotation,
    LineAnnotation,
    BoxAnnotation, 
    TextAnnotation,
    CustomAnnotation,
    AxisMarkerAnnotation,
    NativeTextAnnotation,
    
    // SciChart Enums for annotation configuration
    ELabelPlacement,
    EHorizontalAnchorPoint,
    EVerticalAnchorPoint,
    EAnnotationLayer,
    ECoordinateMode,
    
    // SciChart Utilities
    NumberRange,
    Point
} from 'scichart';

class ExternalPluginLoader {
    constructor() {
        this.pluginDirectory = this.getPluginDirectory();
        this.fileWatcher = null;
        this.loadedPlugins = new Map();
        this.loadErrors = new Map();
        this.isLoaded = false;
        
        // Dependency injection sandbox
        this.sandbox = this.createSandbox();
        
        console.log('[PLUGIN-LOADER] 🚀 ExternalPluginLoader initialized');
        console.log('[PLUGIN-LOADER] 📁 Plugin directory:', this.pluginDirectory);
        console.log('[PLUGIN-LOADER] 🎨 Available annotation classes:', [
            'HorizontalLineAnnotation', 'VerticalLineAnnotation', 'LineAnnotation',
            'BoxAnnotation', 'TextAnnotation', 'CustomAnnotation', 
            'AxisMarkerAnnotation', 'NativeTextAnnotation'
        ].join(', '));
    }

    /**
     * Get the external plugin directory path
     * Uses workspace root + studies folder
     */
    getPluginDirectory() {
        if (!path) {
            return './studies'; // Fallback for browser environment
        }
        
        // In Electron, use app.getAppPath() or current working directory
        let workspaceRoot;
        
        if (typeof process !== 'undefined' && process.cwd) {
            // Use current working directory in Electron
            workspaceRoot = process.cwd();
        } else {
            // Fallback: calculate from current script location
            workspaceRoot = path.resolve(__dirname, '../../../');
        }
        
        return path.join(workspaceRoot, 'studies');
    }

    /**
     * Create dependency injection sandbox for plugins
     * Provides SciChart classes and safe globals
     */
    createSandbox() {
        return {
            // SciChart Annotation Classes - Complete set for plugin development
            HorizontalLineAnnotation,
            VerticalLineAnnotation,
            LineAnnotation,
            BoxAnnotation,
            TextAnnotation,
            CustomAnnotation,
            AxisMarkerAnnotation,
            NativeTextAnnotation,
            
            // SciChart Enums for annotation configuration
            ELabelPlacement,
            EHorizontalAnchorPoint,
            EVerticalAnchorPoint,
            EAnnotationLayer,
            ECoordinateMode,
            
            // SciChart Utilities
            NumberRange,
            Point,
            
            // Safe globals
            console,
            Math,
            Date,
            Object,
            Array,
            JSON,
            parseInt,
            parseFloat,
            isNaN,
            isFinite,
            
            // Plugin helpers
            setTimeout: (fn, delay) => setTimeout(fn, delay),
            clearTimeout: (id) => clearTimeout(id),
            setInterval: (fn, delay) => setInterval(fn, delay),
            clearInterval: (id) => clearInterval(id)
        };
    }

    /**
     * Load all plugins from the external directory
     */
    async loadExternalPlugins() {
        console.log('[PLUGIN-LOADER] 🔍 Starting external plugin discovery...');
        
        // Check if Node.js APIs are available (Electron environment)
        if (!fs || !path) {
            console.log('[PLUGIN-LOADER] ⚠️ Node.js APIs not available - running in browser mode');
            console.log('[PLUGIN-LOADER] 💡 Plugin system requires Electron environment for file system access');
            return;
        }
        
        try {
            // Check if plugin directory exists
            if (!fs.existsSync(this.pluginDirectory)) {
                console.log('[PLUGIN-LOADER] 📁 Plugin directory does not exist:', this.pluginDirectory);
                console.log('[PLUGIN-LOADER] 💡 Create the "studies" folder in your workspace root to add plugins');
                return;
            }

            // Discover plugin files
            const pluginFiles = await this.discoverPluginFiles();
            console.log('[PLUGIN-LOADER] 📋 Found plugin files:', pluginFiles);

            // Load each plugin
            for (const filePath of pluginFiles) {
                await this.loadPluginFromFile(filePath);
            }

            this.isLoaded = true;
            console.log('[PLUGIN-LOADER] ✅ Plugin loading complete');
            console.log('[PLUGIN-LOADER] 📊 Loaded:', this.loadedPlugins.size, 'Errors:', this.loadErrors.size);
            
            this.logLoadingSummary();

        } catch (error) {
            console.error('[PLUGIN-LOADER] ❌ Error during plugin discovery:', error);
        }
    }

    /**
     * Discover all .js files in the plugin directory
     */
    async discoverPluginFiles() {
        const files = [];
        
        const scanDirectory = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    // Recursively scan subdirectories
                    scanDirectory(fullPath);
                } else if (entry.isFile() && entry.name.endsWith('.js')) {
                    files.push(fullPath);
                }
            }
        };
        
        scanDirectory(this.pluginDirectory);
        return files;
    }

    /**
     * Load a single plugin from file path
     */
    async loadPluginFromFile(filePath) {
        const pluginId = this.extractPluginId(filePath);
        
        try {
            console.log('[PLUGIN-LOADER] 📦 Loading plugin:', pluginId, 'from', filePath);
            
            // Read plugin file
            const pluginCode = fs.readFileSync(filePath, 'utf8');
            
            // Evaluate plugin code in sandbox
            const plugin = this.evaluatePluginCode(pluginCode, pluginId);
            
            if (plugin && this.validatePluginInterface(plugin)) {
                this.loadedPlugins.set(pluginId, {
                    id: pluginId,
                    filePath: filePath,
                    plugin: plugin,
                    loadedAt: new Date()
                });
                
                console.log('[PLUGIN-LOADER] ✅ Successfully loaded plugin:', pluginId);
                return plugin;
            } else {
                this.loadErrors.set(pluginId, 'Invalid plugin interface');
                console.error('[PLUGIN-LOADER] ❌ Plugin validation failed:', pluginId);
            }

        } catch (error) {
            console.error('[PLUGIN-LOADER] ❌ Error loading plugin', pluginId, ':', error);
            this.loadErrors.set(pluginId, error.message);
        }
        
        return null;
    }

    /**
     * Evaluate plugin code in sandboxed environment
     */
    evaluatePluginCode(pluginCode, pluginId) {
        try {
            // Transform ES6 import statements to sandbox access
            const transformedCode = this.transformImports(pluginCode);
            
            // Create isolated execution context
            const executionContext = { ...this.sandbox };
            
            // Create a function that returns the plugin
            const pluginFactory = new Function(
                ...Object.keys(executionContext),
                `
                ${transformedCode}
                
                // If there's a default export, return it
                if (typeof exports !== 'undefined' && exports.default) {
                    return exports.default;
                }
                
                // If there's a named export, try common patterns
                if (typeof module !== 'undefined' && module.exports) {
                    return module.exports;
                }
                
                // Look for plugin class or object in global scope
                if (typeof ${pluginId}Plugin !== 'undefined') {
                    return ${pluginId}Plugin;
                }
                
                // Try base plugin name
                if (typeof ${pluginId} !== 'undefined') {
                    return ${pluginId};
                }
                
                // Check for any variable that contains "Plugin"
                for (let varName in this) {
                    if (varName.includes('Plugin') || varName.includes('plugin')) {
                        const obj = this[varName];
                        if (obj && typeof obj === 'object') {
                            const methods = ['initialize', 'updateData', 'destroy', 'getSettings', 'updateSettings', 'getUIConfig'];
                            if (methods.every(m => typeof obj[m] === 'function')) {
                                return obj;
                            }
                        }
                    }
                }
                
                // Fallback: look for any object with required methods
                const methods = ['initialize', 'updateData', 'destroy', 'getSettings', 'updateSettings', 'getUIConfig'];
                for (let varName in this) {
                    const obj = this[varName];
                    if (obj && typeof obj === 'object' && methods.every(m => typeof obj[m] === 'function')) {
                        return obj;
                    }
                }
                
                throw new Error('No valid plugin export found');
                `
            );
            
            // Execute plugin code
            const plugin = pluginFactory(...Object.values(executionContext));
            
            console.log('[PLUGIN-LOADER] ✅ Plugin code evaluated successfully:', pluginId);
            return plugin;
            
        } catch (error) {
            console.error('[PLUGIN-LOADER] ❌ Error evaluating plugin code:', error);
            throw error;
        }
    }

    /**
     * Transform ES6 import statements to sandbox variable access
     */
    transformImports(code) {
        // Replace import statements with sandbox variable assignments
        let transformed = code;
        
        // Handle: import { HorizontalLineAnnotation, ELabelPlacement } from 'scichart';
        const importRegex = /import\s*{([^}]+)}\s*from\s*['"]([^'"]+)['"];?/g;
        transformed = transformed.replace(importRegex, (match, imports, module) => {
            if (module === 'scichart') {
                // Extract individual imports
                const importList = imports.split(',').map(imp => imp.trim());
                const assignments = importList.map(imp => `const ${imp} = ${imp};`).join('\n');
                return assignments;
            }
            return ''; // Remove other imports
        });
        
        // Handle: import Something from 'module';
        const defaultImportRegex = /import\s+(\w+)\s+from\s*['"]([^'"]+)['"];?/g;
        transformed = transformed.replace(defaultImportRegex, '');
        
        // Handle: export default { ... }
        transformed = transformed.replace(/export\s+default\s+/, 'const exports = { default: ');
        transformed = transformed.replace(/export\s*{([^}]+)}\s*;?/, '');
        
        // Handle final return statement or variable assignment
        // Pattern: VariableName; at end of file should be returned
        const finalReturnMatch = transformed.match(/(\w+Plugin|\w+);?\s*$/);
        if (finalReturnMatch) {
            const varName = finalReturnMatch[1];
            transformed = transformed.replace(/(\w+Plugin|\w+);?\s*$/, `return ${varName};`);
        }
        
        return transformed;
    }

    /**
     * Extract plugin ID from file path
     */
    extractPluginId(filePath) {
        const fileName = path.basename(filePath, '.js');
        return fileName.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    /**
     * Validate that plugin implements required interface
     */
    validatePluginInterface(plugin) {
        const requiredMethods = [
            'initialize',
            'updateData', 
            'destroy',
            'getSettings',
            'updateSettings',
            'getUIConfig'
        ];

        return requiredMethods.every(method => {
            const hasMethod = typeof plugin[method] === 'function';
            if (!hasMethod) {
                console.error('[PLUGIN-LOADER] ❌ Missing required method:', method);
            }
            return hasMethod;
        });
    }

    /**
     * Setup file system watcher for hot reload
     */
    setupFileWatcher() {
        // Check if Node.js APIs are available
        if (!fs || !chokidar) {
            console.log('[PLUGIN-LOADER] ⚠️ File watching not available - requires Electron environment');
            return;
        }

        if (this.fileWatcher) {
            this.fileWatcher.close();
        }

        if (!fs.existsSync(this.pluginDirectory)) {
            console.log('[PLUGIN-LOADER] 🔍 Plugin directory does not exist, skipping file watcher setup');
            return;
        }

        console.log('[PLUGIN-LOADER] 👁️ Setting up file watcher for:', this.pluginDirectory);
        
        this.fileWatcher = chokidar.watch(this.pluginDirectory, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true
        });

        this.fileWatcher.on('change', (filePath) => {
            if (filePath.endsWith('.js')) {
                console.log('[PLUGIN-LOADER] 🔄 File changed:', filePath);
                this.hotReloadPlugin(filePath);
            }
        });

        this.fileWatcher.on('add', (filePath) => {
            if (filePath.endsWith('.js')) {
                console.log('[PLUGIN-LOADER] ➕ New file added:', filePath);
                this.loadPluginFromFile(filePath);
            }
        });

        this.fileWatcher.on('unlink', (filePath) => {
            if (filePath.endsWith('.js')) {
                console.log('[PLUGIN-LOADER] ➖ File removed:', filePath);
                const pluginId = this.extractPluginId(filePath);
                this.unloadPlugin(pluginId);
            }
        });
    }

    /**
     * Hot reload a specific plugin
     */
    async hotReloadPlugin(filePath) {
        const pluginId = this.extractPluginId(filePath);
        
        console.log('[PLUGIN-LOADER] 🔄 Hot reloading plugin:', pluginId);
        
        // Unload existing plugin
        this.unloadPlugin(pluginId);
        
        // Reload plugin
        const plugin = await this.loadPluginFromFile(filePath);
        
        if (plugin) {
            console.log('[PLUGIN-LOADER] ✅ Hot reload successful:', pluginId);
            
            // Notify that plugin was reloaded and needs re-integration
            this.notifyPluginReloaded(pluginId, plugin);
        }
    }

    /**
     * Unload a plugin
     */
    unloadPlugin(pluginId) {
        const pluginInfo = this.loadedPlugins.get(pluginId);
        
        if (pluginInfo) {
            try {
                // Call destroy method if plugin is loaded
                if (pluginInfo.plugin && typeof pluginInfo.plugin.destroy === 'function') {
                    pluginInfo.plugin.destroy();
                }
            } catch (error) {
                console.error('[PLUGIN-LOADER] ❌ Error destroying plugin:', pluginId, error);
            }
            
            this.loadedPlugins.delete(pluginId);
            console.log('[PLUGIN-LOADER] 🗑️ Plugin unloaded:', pluginId);
        }
        
        this.loadErrors.delete(pluginId);
    }

    /**
     * Notify that a plugin was reloaded (for UI updates and re-integration)
     */
    notifyPluginReloaded(pluginId, plugin = null) {
        console.log('[PLUGIN-LOADER] 📢 Notifying plugin reload:', pluginId);
        
        // Dispatch custom event that UI can listen to
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('pluginReloaded', { 
                detail: { pluginId, plugin } 
            }));
        }
        
        // If we have the plugin instance, trigger immediate re-integration
        if (plugin) {
            console.log('[PLUGIN-LOADER] 🔄 Triggering immediate plugin re-integration');
            this.triggerPluginReintegration(pluginId, plugin);
        }
    }

    /**
     * Trigger re-integration of a hot-reloaded plugin
     */
    triggerPluginReintegration(pluginId, plugin) {
        // Import UserStudyRegistry and UserStudyLifecycle dynamically to avoid circular imports
        // We'll use a callback system to notify the UserStudyLoader
        console.log('[PLUGIN-LOADER] 🔄 Re-integrating plugin:', pluginId);
        
        // Dispatch a custom event that UserStudyLoader can listen to
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('pluginReintegrationNeeded', { 
                detail: { pluginId, plugin } 
            }));
        }
    }

    /**
     * Get all loaded plugins for registration
     */
    getLoadedPlugins() {
        return Array.from(this.loadedPlugins.values()).map(info => ({
            id: info.id,
            plugin: info.plugin,
            filePath: info.filePath,
            loadedAt: info.loadedAt
        }));
    }

    /**
     * Get loading status
     */
    getLoadingStatus() {
        return {
            isLoaded: this.isLoaded,
            loadedCount: this.loadedPlugins.size,
            errorCount: this.loadErrors.size,
            loadedPlugins: Array.from(this.loadedPlugins.keys()),
            errors: Object.fromEntries(this.loadErrors),
            pluginDirectory: this.pluginDirectory
        };
    }

    /**
     * Log loading summary
     */
    logLoadingSummary() {
        console.group('[PLUGIN-LOADER] 📊 External Plugin Loading Summary');
        
        if (this.loadedPlugins.size > 0) {
            console.log('✅ Successfully Loaded Plugins:');
            this.loadedPlugins.forEach((info, id) => {
                console.log(`  • ${id} (${info.filePath})`);
            });
        }
        
        if (this.loadErrors.size > 0) {
            console.log('❌ Failed to Load:');
            this.loadErrors.forEach((error, id) => {
                console.log(`  • ${id}: ${error}`);
            });
        }
        
        console.groupEnd();
    }

    /**
     * Reload all plugins
     */
    async reloadAllPlugins() {
        console.log('[PLUGIN-LOADER] 🔄 Reloading all external plugins...');
        
        // Clear existing
        this.loadedPlugins.forEach((info, id) => {
            this.unloadPlugin(id);
        });
        
        this.loadedPlugins.clear();
        this.loadErrors.clear();
        this.isLoaded = false;
        
        // Reload
        await this.loadExternalPlugins();
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        console.log('[PLUGIN-LOADER] 🧹 Destroying ExternalPluginLoader...');
        
        // Close file watcher
        if (this.fileWatcher) {
            this.fileWatcher.close();
            this.fileWatcher = null;
        }
        
        // Unload all plugins
        this.loadedPlugins.forEach((info, id) => {
            this.unloadPlugin(id);
        });
        
        this.loadedPlugins.clear();
        this.loadErrors.clear();
        this.isLoaded = false;
    }
}

// Export singleton instance
export default new ExternalPluginLoader(); 