# Quatrain Dynamic User Studies System - Implementation Guide

## Overview

This document provides step-by-step instructions for implementing a completely separate, dynamic User Studies system for Quatrain. This system will be entirely independent from the existing "Indicators and Studies" panel and internal studies, ensuring zero interference with working code.

## Key Architectural Decisions

### Complete Separation Strategy
- **NO conversion** of existing internal studies - they remain untouched
- **Separate "User Studies" panel** - distinct from "Indicators and Studies" 
- **New menu option** under Strategy menu to launch User Studies panel
- **Minimal changes** to existing large files (App.js, etc.)
- **Drop-in functionality** for user-created studies
- **Zero interference** with existing study code

### Architecture Summary

The new system consists of:
- **UserStudyRegistry**: Central registration system for user studies only
- **UserStudiesPanel**: Separate UI panel for user studies management
- **UserStudyLoader**: Auto-discovery of user studies in designated folder
- **UserStudyInterface**: Standardized API for user-created studies
- **Dynamic UI Generation**: Automatic settings UI from study schemas
- **Settings Management**: Handles nested UI settings vs flat study settings
- **Minimal App.js Integration**: Single import and menu item addition

## Directory Structure

```
src/
├── userstudies/
│   ├── core/
│   │   ├── UserStudyRegistry.js
│   │   ├── UserStudyLoader.js
│   │   ├── UserStudyInterface.js
│   │   └── UserStudyLifecycle.js
│   ├── components/
│   │   ├── UserStudiesPanel.js
│   │   ├── UserStudyUI.js
│   │   └── UserStudyControls.js
│   ├── examples/
│   │   ├── ExampleVWAP.js
│   │   ├── ExampleSupport.js
│   │   └── README.md
│   ├── library/
│   │   └── [user-created studies go here]
│   └── README.md
```

## Implementation Steps

### Step 1: Create User Study Registry System

**File: `src/userstudies/core/UserStudyRegistry.js`**

Central registry for user studies only - completely separate from internal studies.

### Step 2: Create User Study Interface Standard

**File: `src/userstudies/core/UserStudyInterface.js`**

Defines the required interface that all user studies must implement:

```javascript
// Required methods for all user studies:
// - getUIConfig() - Returns UI schema for dynamic generation
// - initialize(sciChartSurface, settings) - Initialize study
// - updateData(candles) - Process new candle data
// - updateSettings(newSettings) - Handle settings changes
// - getSettings() - Return current settings
// - destroy() - Cleanup when study is removed
```

### Step 3: Create Auto-Discovery System

**File: `src/userstudies/core/UserStudyLoader.js`**

Automatically discovers and loads user studies from the `library/` folder using Webpack's require.context.

### Step 4: Create User Studies Panel

**File: `src/userstudies/components/UserStudiesPanel.js`**

Completely separate panel for user studies management:
- Study discovery and loading
- Dynamic UI generation from study schemas
- Settings management
- Study enable/disable controls
- Import/export functionality

### Step 5: Create Dynamic UI Generation

**File: `src/userstudies/components/UserStudyUI.js`**

Generates settings UI dynamically from study schemas:
- Checkbox controls
- Color pickers
- Number inputs
- Time pickers
- Dropdown selects
- Range sliders
- Help tooltips

### Step 6: Create Lifecycle Management

**File: `src/userstudies/core/UserStudyLifecycle.js`**

Manages user study lifecycle:
- Initialization with SciChart surface
- Data updates from candle feed
- Settings synchronization
- Cleanup and memory management

### Step 7: Minimal App.js Integration

**Only changes needed in App.js:**

1. **Single import** for User Studies system:
```javascript
import { UserStudyManager } from './userstudies/UserStudyManager';
```

2. **One state variable** for User Studies panel:
```javascript
const [showUserStudies, setShowUserStudies] = useState(false);
```

3. **One menu item** under Strategy menu:
```xml
<div className="menu-item" onClick={() => setShowUserStudies(true)}>
    User Studies
</div>
```

4. **One component render** conditional:
```xml
{showUserStudies && (
    <UserStudiesPanel 
        onClose={() => setShowUserStudies(false)}
        sciChartSurface={sciChartSurfaceRef.current}
        candles={candles}
    />
)}
```

5. **One lifecycle hook** in useEffect for candle updates:
```javascript
// In existing candle update useEffect
UserStudyManager.updateAllStudies(candles);
```

**Total App.js additions: ~8 lines of code**

### Step 8: Create Example User Studies

**File: `src/userstudies/examples/ExampleVWAP.js`**

Complete example showing:
- Required interface implementation
- UI schema definition
- SciChart annotation creation
- Settings management
- Data processing

**File: `src/userstudies/examples/ExampleSupport.js`**

Simple example showing:
- Horizontal line annotation
- Color and style settings
- Price level calculation

### Step 9: Create User Documentation

**File: `src/userstudies/README.md`**

Comprehensive guide for users creating studies:
- Interface requirements
- UI schema format
- SciChart integration patterns
- Example code
- Best practices
- Troubleshooting guide

## Critical Settings System Implementation

### Settings Architecture Overview

The User Studies system uses a **dual-layer settings architecture** to bridge the gap between the structured UI requirements and the simple flat settings that studies expect:

1. **UI Layer**: Uses nested, sectioned settings schema for organized user interface
2. **Study Layer**: Uses flat settings object for simple study implementation
3. **Translation Layer**: Automatically converts between the two formats

### UI Schema Structure

Studies define their settings using a structured schema that organizes controls into logical sections:

```javascript
getUIConfig() {
    return {
        id: 'myStudy',
        displayName: 'My Study',
        settingsSchema: [
            {
                type: 'section',
                title: 'Main Settings',
                key: 'main',  // This creates nested structure
                controls: [
                    {
                        key: 'enabled',
                        type: 'checkbox',
                        label: 'Enable Study',
                        default: true
                    },
                    {
                        key: 'lookbackPeriod',
                        type: 'number',
                        label: 'Lookback Period',
                        min: 1,
                        max: 100,
                        default: 10
                    }
                ]
            },
            {
                type: 'section',
                title: 'Appearance',
                key: 'appearance',  // This creates nested structure
                controls: [
                    {
                        key: 'lineColor',
                        type: 'color',
                        label: 'Line Color',
                        default: '#00FF00'
                    },
                    {
                        key: 'showLabels',
                        type: 'checkbox',
                        label: 'Show Labels',
                        default: true
                    }
                ]
            }
        ]
    };
}
```

### Settings Data Flow

#### From UI to Study (updateSettings)

When the UI sends settings to the study, they come in **nested format**:

```javascript
// Settings from UI (nested)
{
    "main": {
        "enabled": true,
        "lookbackPeriod": 15
    },
    "appearance": {
        "lineColor": "#FF0000",
        "showLabels": false
    }
}
```

The study's `updateSettings()` method **MUST flatten** these settings:

```javascript
updateSettings(newSettings) {
    // Flatten nested settings from UI schema to flat structure
    const flattenedSettings = { ...newSettings };
    
    // Handle main section settings
    if (newSettings.main) {
        Object.assign(flattenedSettings, newSettings.main);
        delete flattenedSettings.main;
    }
    
    // Handle appearance section settings  
    if (newSettings.appearance) {
        Object.assign(flattenedSettings, newSettings.appearance);
        delete flattenedSettings.appearance;
    }
    
    // Merge with existing settings
    this.settings = { ...this.settings, ...flattenedSettings };
    
    // Result is flat settings:
    // {
    //   enabled: true,
    //   lookbackPeriod: 15,
    //   lineColor: "#FF0000",
    //   showLabels: false
    // }
}
```

#### From Study to UI (getSettings)

When the UI reads settings from the study, they come in **flat format**:

```javascript
// Settings from study (flat)
{
    "enabled": true,
    "lookbackPeriod": 15,
    "lineColor": "#FF0000",
    "showLabels": false
}
```

The UI component automatically handles this by checking **both nested and flat paths**:

```javascript
// UI automatically tries both:
// 1. First tries nested: settings.main.enabled
// 2. If not found, tries flat: settings.enabled
const getNestedValue = (obj, path) => {
    // First try nested path (e.g., "main.enabled")
    const nestedValue = path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
    
    // If nested path didn't work, try flat key (e.g., "enabled")
    if (nestedValue === undefined && path.includes('.')) {
        const flatKey = path.split('.').pop();
        return obj[flatKey];
    }
    
    return nestedValue;
};
```

### Control Types and Properties

#### Checkbox Control
```javascript
{
    key: 'enabled',
    type: 'checkbox',
    label: 'Enable Feature',
    tooltip: 'Show/hide this feature',  // Optional
    default: true
}
```

#### Color Control
```javascript
{
    key: 'lineColor',
    type: 'color',
    label: 'Line Color',
    tooltip: 'Color of the line',  // Optional
    default: '#00FF00'
}
```

#### Number Control
```javascript
{
    key: 'lookbackPeriod',
    type: 'number',
    label: 'Lookback Period',
    suffix: 'candles',  // Optional unit display
    min: 1,            // Optional minimum
    max: 100,          // Optional maximum
    tooltip: 'Number of candles to analyze',  // Optional
    default: 10
}
```

#### Select Control
```javascript
{
    key: 'lineStyle',
    type: 'select',
    label: 'Line Style',
    options: [
        { value: 'solid', label: 'Solid' },
        { value: 'dashed', label: 'Dashed' },
        { value: 'dotted', label: 'Dotted' }
    ],
    tooltip: 'Style of the line',  // Optional
    default: 'solid'
}
```

#### Range Control
```javascript
{
    key: 'opacity',
    type: 'range',
    label: 'Opacity',
    min: 0,
    max: 1,
    step: 0.1,
    showPercentage: true,  // Display as percentage
    tooltip: 'Transparency level',  // Optional
    default: 0.8
}
```

#### Time Control
```javascript
{
    key: 'startTime',
    type: 'time',
    label: 'Start Time',
    tooltip: 'Session start time',  // Optional
    default: '09:30'
}
```

### Required Study Methods Implementation

#### Constructor
```javascript
constructor() {
    // Initialize with flat settings structure
    this.settings = {
        enabled: true,
        lookbackPeriod: 10,
        lineColor: '#00FF00',
        showLabels: true
        // All settings must be flat (no nested objects)
    };
    
    // Initialize other properties...
}
```

#### getUIConfig()
```javascript
getUIConfig() {
    return {
        id: 'uniqueStudyId',
        displayName: 'Human Readable Name',
        description: 'Brief description of what this study does',
        category: 'examples',  // Used for grouping
        settingsSchema: [
            // Array of sections with controls
        ]
    };
}
```

#### getSettings()
```javascript
getSettings() {
    // Return flat settings object
    return { ...this.settings };
}
```

#### updateSettings(newSettings)
```javascript
updateSettings(newSettings) {
    // CRITICAL: Must flatten nested settings from UI
    const flattenedSettings = { ...newSettings };
    
    // Handle each section defined in your UI schema
    if (newSettings.main) {
        Object.assign(flattenedSettings, newSettings.main);
        delete flattenedSettings.main;
    }
    
    if (newSettings.appearance) {
        Object.assign(flattenedSettings, newSettings.appearance);
        delete flattenedSettings.appearance;
    }
    
    // Add more sections as needed...
    
    // Merge with existing settings
    this.settings = { ...this.settings, ...flattenedSettings };
    
    // Refresh the study display
    if (this.sciChartSurfaceRefs && this.settings.enabled) {
        this.removeAllAnnotations();
        this.calculateAndDraw();
    }
}
```

#### initialize(sciChartSurfaceRefs, timeframes, chartData, sessions)
```javascript
initialize(sciChartSurfaceRefs, timeframes, chartData, sessions) {
    this.sciChartSurfaceRefs = sciChartSurfaceRefs;
    this.timeframes = timeframes;
    this.chartData = chartData;
    this.sessions = sessions;
    
    if (this.settings.enabled) {
        this.calculateAndDraw();
    }
}
```

#### updateData(chartData, sessions)
```javascript
updateData(chartData, sessions) {
    this.chartData = chartData;
    this.sessions = sessions;
    
    if (this.settings.enabled && this.sciChartSurfaceRefs) {
        this.calculateAndDraw();
    }
}
```

#### destroy()
```javascript
destroy() {
    this.removeAllAnnotations();
    this.chartData = null;
    this.sessions = null;
    this.sciChartSurfaceRefs = null;
}
```

### Common Settings Patterns

#### Enable/Disable Pattern
```javascript
// Always include an enabled checkbox in main section
{
    type: 'section',
    title: 'Main Settings',
    key: 'main',
    controls: [
        {
            key: 'enabled',
            type: 'checkbox',
            label: 'Enable Study',
            default: true
        }
        // Other main controls...
    ]
}
```

#### Appearance Section Pattern
```javascript
// Group visual settings in appearance section
{
    type: 'section',
    title: 'Appearance',
    key: 'appearance',
    controls: [
        {
            key: 'color',
            type: 'color',
            label: 'Color',
            default: '#00FF00'
        },
        {
            key: 'thickness',
            type: 'number',
            label: 'Thickness',
            min: 1,
            max: 5,
            default: 2
        }
        // Other appearance controls...
    ]
}
```

### Debugging Settings Issues

#### Enable Debug Logging
```javascript
updateSettings(newSettings) {
    console.log('[DEBUG] Old settings:', JSON.stringify(this.settings, null, 2));
    console.log('[DEBUG] New settings:', JSON.stringify(newSettings, null, 2));
    
    // ... flattening logic ...
    
    console.log('[DEBUG] Final settings:', JSON.stringify(this.settings, null, 2));
}
```

#### Common Issues and Solutions

**Issue**: Settings not updating in UI
- **Cause**: Study not returning flat settings from `getSettings()`
- **Solution**: Ensure `getSettings()` returns flat object with all settings

**Issue**: Study not receiving setting changes
- **Cause**: `updateSettings()` not flattening nested settings from UI
- **Solution**: Implement proper flattening logic for each section

**Issue**: Controls showing wrong values
- **Cause**: Mismatch between section keys and control paths
- **Solution**: Verify section `key` matches the nested structure being sent

**Issue**: Study not refreshing when settings change
- **Cause**: Not calling `calculateAndDraw()` after settings update
- **Solution**: Always refresh display when enabled and surfaces available

### Performance Considerations

#### Settings Caching
```javascript
updateSettings(newSettings) {
    const oldEnabled = this.settings.enabled;
    
    // ... update settings ...
    
    // Only refresh if enabled state changed or study is enabled
    if (this.settings.enabled !== oldEnabled || this.settings.enabled) {
        this.calculateAndDraw();
    }
}
```

#### Annotation Management
```javascript
calculateAndDraw() {
    // Remove old annotations before creating new ones
    this.removeAllAnnotations();
    
    // Create new annotations
    this.drawAnnotations();
}

removeAllAnnotations() {
    this.timeframes.forEach(timeframe => {
        const surface = this.sciChartSurfaceRefs[timeframe];
        if (!surface) return;
        
        // Remove by ID pattern to avoid removing other annotations
        const annotations = surface.annotations;
        for (let i = annotations.size() - 1; i >= 0; i--) {
            const annotation = annotations.get(i);
            if (annotation.id && annotation.id.startsWith('mystudy_')) {
                annotations.removeAt(i);
            }
        }
    });
}
```

## User Study Development Workflow

### For Study Creators:

1. **Create study file** in `src/userstudies/library/MyStudy.js`
2. **Implement required interface** (6 methods)
3. **Define UI schema** with proper sections and controls
4. **Implement settings flattening** in `updateSettings()`
5. **Test with example data** using provided tools
6. **Study auto-loads** on next Quatrain restart

### For Study Users:

1. **Open Strategy menu** → **User Studies**
2. **Available studies auto-discovered** and listed
3. **Enable studies** with checkbox controls
4. **Configure settings** with dynamic UI
5. **Studies appear on chart** immediately

## Benefits of This Architecture

### Complete Isolation
- **Zero risk** to existing working code
- **Independent development** of user studies
- **Separate testing** and debugging
- **No migration concerns** for current studies

### User-Friendly
- **Drop-in simplicity** for study creators
- **Auto-discovery** eliminates manual registration
- **Dynamic UI** eliminates custom panel coding
- **Immediate availability** after file creation

### Flexible Settings System
- **Organized UI** with logical sections
- **Simple study code** with flat settings
- **Automatic translation** between formats
- **Robust fallback** for mixed scenarios

### Minimal Overhead
- **8 lines total** added to App.js
- **No changes** to existing study files
- **No changes** to IndicatorsStudies.js
- **Clean separation** of concerns

### Extensible Design
- **Plugin architecture** for future expansion
- **Category organization** for study grouping
- **Import/export** for study sharing
- **Version management** for study updates

## Implementation Priority

1. **Phase 1**: Core registry and loader (1-2 days)
2. **Phase 2**: Basic User Studies panel (2-3 days)
3. **Phase 3**: Dynamic UI generation (2-3 days)
4. **Phase 4**: Settings system implementation (1-2 days)
5. **Phase 5**: Example studies and docs (1-2 days)
6. **Phase 6**: Advanced features (import/export, etc.)

**Total Estimated Time: 1-2 weeks**

## Future Enhancements

- **Study marketplace** for sharing studies
- **Visual study builder** for non-programmers
- **Study performance monitoring** and optimization
- **Cloud sync** for study settings
- **Study version control** and updates
- **Advanced control types** (multi-select, file upload, etc.)

This architecture ensures that User Studies become a powerful, separate feature while maintaining the stability and integrity of Quatrain's existing study system.
