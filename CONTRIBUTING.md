# Contributing to Quatrain

Thank you for your interest in contributing to Quatrain! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Development Environment Setup

1. **Prerequisites**
   - Node.js v14 or higher
   - npm v6 or higher
   - Git
   - Code editor (VS Code recommended)
   - Windows 10/11 (for NinjaTrader integration testing)

2. **Fork and Clone**
   ```bash
   # Fork the repository on GitHub
   git clone https://github.com/your-username/quatrain.git
   cd quatrain
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📋 Development Guidelines

### Code Style

- **JavaScript**: Follow ES6+ standards
- **React**: Use functional components with hooks
- **File Naming**: Use PascalCase for components, camelCase for utilities
- **Comments**: Document complex logic and public APIs
- **Formatting**: Use consistent indentation (2 spaces)

### Project Structure

```
src/
├── components/          # Reusable UI components
├── services/           # Data services and API clients
├── userstudies/        # User Studies system
│   ├── core/          # Core study management
│   ├── components/    # UI components
│   ├── examples/      # Example studies
│   └── library/       # User-created studies
├── utils/             # Utility functions
├── hooks/             # Custom React hooks
├── constants/         # Application constants
└── features/          # Feature-specific modules
```

### Commit Guidelines

Use conventional commit format:
```
type(scope): description

feat(studies): add new MACD indicator
fix(trading): resolve order placement bug
docs(readme): update installation instructions
style(ui): improve chart styling
refactor(data): optimize WebSocket handling
test(studies): add unit tests for VWAP
```

## 🧪 User Studies Development

### Creating a New Study

1. **Create Study File**
   ```bash
   # Create in src/userstudies/examples/ for review
   touch src/userstudies/examples/MyNewStudy.js
   ```

2. **Implement Study Interface**
   ```javascript
   class MyNewStudy {
       constructor() {
           this.id = 'my-new-study';
           this.name = 'My New Study';
           this.description = 'Description of what this study does';
           this.version = '1.0.0';
           this.author = 'Your Name';
           
           // Define configurable settings
           this.settings = {
               period: {
                   type: 'number',
                   default: 14,
                   min: 1,
                   max: 100,
                   label: 'Period'
               },
               color: {
                   type: 'color',
                   default: '#FF6B35',
                   label: 'Line Color'
               }
           };
           
           // Internal state
           this.annotations = new Map();
           this.lastDataLength = {};
       }

       updateData(chartData, sessions) {
           // Implement your analysis logic
           // Access data: chartData['1m'], chartData['5m'], etc.
           // Create annotations on charts
       }

       updateSettings(newSettings) {
           // Handle settings changes
           Object.assign(this.settings, newSettings);
           // Recalculate if needed
       }

       destroy() {
           // Cleanup resources
           this.annotations.clear();
       }
   }

   module.exports = MyNewStudy;
   ```

3. **Test Your Study**
   - Place file in `src/userstudies/library/` for testing
   - Access via Strategy menu → User Studies
   - Test with different timeframes and settings
   - Verify performance with large datasets

### Study Development Best Practices

#### Performance Optimization
```javascript
updateData(chartData, sessions) {
    const timeframe = '1m';
    const data = chartData[timeframe];
    
    // Check if new data is available
    if (!data || data.length === this.lastDataLength[timeframe]) {
        return; // No new data, skip calculation
    }
    
    // Only process new candles
    const newCandles = data.slice(this.lastDataLength[timeframe] || 0);
    this.processNewCandles(newCandles, timeframe);
    
    this.lastDataLength[timeframe] = data.length;
}
```

#### Efficient Annotation Management
```javascript
// Avoid creating excessive annotations
createAnnotation(timeframe, id, config) {
    const key = `${timeframe}-${id}`;
    
    // Remove existing annotation if it exists
    if (this.annotations.has(key)) {
        this.removeAnnotation(key);
    }
    
    // Create new annotation
    const annotation = this.createChartAnnotation(config);
    this.annotations.set(key, annotation);
}
```

#### Error Handling
```javascript
updateData(chartData, sessions) {
    try {
        // Your calculation logic
    } catch (error) {
        console.error(`[${this.id}] Error in updateData:`, error);
        // Graceful degradation
    }
}
```

## 🔧 Core Development

### Adding New Features

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/new-feature-name
   ```

2. **Implement Feature**
   - Follow existing patterns and architecture
   - Add appropriate error handling
   - Include unit tests where applicable
   - Update documentation

3. **Test Thoroughly**
   - Test in development mode
   - Test production build
   - Test with different data scenarios
   - Verify no regressions in existing features

### WebSocket Integration

When working with data services:

```javascript
// Subscribe to data updates
const handleDataUpdate = (message) => {
    if (message.mtyp === 'data') {
        // Process incoming data
        updateChartData(message);
    }
};

// Proper cleanup
useEffect(() => {
    websocket.addEventListener('message', handleDataUpdate);
    
    return () => {
        websocket.removeEventListener('message', handleDataUpdate);
    };
}, []);
```

### Shared Data Service

For multi-window features:

```javascript
import SharedDataClient from '../services/SharedDataClient';

// Subscribe to shared data
useEffect(() => {
    const unsubscribe = SharedDataClient.subscribe('chartData', (data) => {
        setChartData(data);
    });
    
    return unsubscribe;
}, []);

// Publish data updates
const updateSharedData = (newData) => {
    SharedDataClient.publish('chartData', newData);
};
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Application starts without errors
- [ ] WebSocket connection establishes successfully
- [ ] Charts render correctly across all timeframes
- [ ] User Studies load and function properly
- [ ] Settings persist correctly
- [ ] NinjaTrader integration works (if applicable)
- [ ] Multi-window functionality operates correctly
- [ ] Performance is acceptable with large datasets

### User Studies Testing

- [ ] Study loads without errors
- [ ] Settings UI generates correctly
- [ ] Calculations produce expected results
- [ ] Annotations display properly
- [ ] Performance is acceptable
- [ ] Settings changes update correctly
- [ ] Study cleans up resources properly

## 📝 Documentation

### Code Documentation

- Document public APIs and complex algorithms
- Include JSDoc comments for functions and classes
- Provide usage examples for new features
- Update README.md for significant changes

### User Studies Documentation

- Include comprehensive comments in study code
- Provide usage examples and expected outputs
- Document any external dependencies
- Explain calculation methodology

## 🚀 Submission Process

### Pull Request Guidelines

1. **Before Submitting**
   - Ensure all tests pass
   - Update documentation
   - Rebase on latest main branch
   - Verify no merge conflicts

2. **PR Description Template**
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Manual testing completed
   - [ ] No regressions identified
   - [ ] Performance impact assessed

   ## Screenshots (if applicable)
   Include screenshots for UI changes
   ```

3. **Review Process**
   - Code review by maintainers
   - Testing verification
   - Documentation review
   - Approval and merge

### User Studies Contributions

1. **Submit to Examples**
   - Place new studies in `src/userstudies/examples/`
   - Include comprehensive documentation
   - Provide test data or scenarios

2. **Review Criteria**
   - Code quality and performance
   - Documentation completeness
   - Usefulness to community
   - Adherence to study interface

## 🆘 Getting Help

### Resources

- **Documentation**: Check `reference/` directory
- **Examples**: Review `src/userstudies/examples/`
- **Issues**: Search existing GitHub issues
- **Discussions**: Use GitHub Discussions for questions

### Contact

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Code Review**: Submit PRs for feedback

## 📄 License

By contributing to Quatrain, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing to Quatrain! Your efforts help make this a better tool for the trading and development community. 