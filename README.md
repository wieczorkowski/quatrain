# Quatrain - Financial Charting & Trading Platform

Quatrain is a powerful desktop application for charting, analyzing, and trading financial instruments. Built with React and Electron, it provides real-time candlestick charts across multiple timeframes with advanced annotation capabilities and trading integration.

## 🚀 Features

### Core Charting
- **Real-time Financial Data**: Live OHLCV candlestick charts with WebSocket data feeds
- **Multi-Timeframe Analysis**: Simultaneous viewing of 4 or 6 timeframes (1h, 30m, 15m, 10m, 5m, 1m)
- **SciChart Integration**: High-performance charting with professional-grade visualization
- **Multiple Operating Modes**: Live data, historical analysis, and replay simulation

### Trading Integration
- **NinjaTrader Bridge**: Direct integration with NinjaTrader 8 for live trading
- **Chart Trader**: Click-to-trade directly on charts for precise order placement
- **Smart Stop Management**: Intelligent stop-loss adjustment based on market conditions
- **Trade Manager**: Comprehensive position and order management interface

### Analysis Tools
- **Built-in Studies**: Comprehensive technical indicators and studies
- **User Studies System**: Drop-in JavaScript studies for custom analysis
- **Strategy Integration**: External strategy manager connectivity
- **Annotation System**: Drawing tools and persistent chart annotations

### Advanced Features
- **Multi-Window Support**: Multiple chart windows with shared data
- **Session Management**: Trading session visualization and analysis
- **User Settings**: Persistent configuration and preferences
- **Shared Data Service**: Efficient data sharing between application windows

## 📋 Prerequisites

- **Node.js**: v14 or higher
- **npm**: v6 or higher
- **Operating System**: Windows 10/11 (required for NinjaTrader integration)
- **For Trading**: NinjaTrader 8 and .NET 6.0 SDK (optional)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/[your-username]/quatrain.git
cd quatrain
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```

This will start both the React development server and Electron application.

### 4. Production Build
```bash
npm run build
npm run electron-start
```

## 🔧 Configuration

### Backend Connection (Chronicle Server)
Quatrain requires a Chronicle backend server for data feeds. Configure the connection in your application settings or see the [Chronicle repository](https://github.com/[your-username]/chronicle) for backend setup.

### NinjaTrader Integration (Optional)
For live trading capabilities:

1. Install NinjaTrader 8
2. Install .NET 6.0 SDK
3. Build the NinjaTrader Bridge:
   ```bash
   cd NinjaTraderBridge
   dotnet build
   dotnet run
   ```
4. Start NinjaTrader before launching Quatrain
5. Use the Trade Manager to connect and trade

## 📁 Project Structure

```
quatrain/
├── src/                          # React application source
│   ├── App.js                    # Main application component
│   ├── components/               # Reusable UI components
│   ├── services/                 # Data services and API clients
│   ├── userstudies/             # User Studies system
│   │   ├── core/                # Core study management
│   │   ├── components/          # UI components
│   │   ├── examples/            # Example studies
│   │   └── library/             # User-created studies
│   ├── utils/                   # Utility functions
│   └── constants/               # Application constants
├── main.js                      # Electron main process
├── NinjaTraderBridge/           # C# NinjaTrader integration
├── reference/                   # Developer documentation
└── public/                      # Static assets
```

## 🧪 Developing User Studies

Quatrain includes a powerful User Studies system that allows developers to create custom technical analysis tools using JavaScript.

### Quick Start
1. Create a new `.js` file in `src/userstudies/library/`
2. Implement the required interface (see examples)
3. Studies are automatically discovered and loaded
4. Access through Strategy menu → User Studies

### Example Study Structure
```javascript
class MyCustomStudy {
    constructor() {
        this.id = 'my-custom-study';
        this.name = 'My Custom Study';
        this.description = 'Custom analysis tool';
        this.settings = {
            period: { type: 'number', default: 14, min: 1, max: 100 }
        };
    }

    updateData(chartData, sessions) {
        // Implement your analysis logic
        // Access OHLCV data: chartData['1m'], chartData['5m'], etc.
        // Create annotations on charts
    }
}

module.exports = MyCustomStudy;
```

### Study Development Resources
- **[User Study Development Guide](reference/Quatrain%20Study%20Development%20Guide.md)**: Comprehensive development documentation
- **[Dynamic Studies Implementation](reference/Quatrain%20Dynamic%20Studies%20Implementation%20Guide.md)**: Architecture and implementation details
- **[Example Studies](src/userstudies/examples/)**: Reference implementations

## 🔌 API Integration

### WebSocket Communication
Quatrain communicates with the Chronicle backend via WebSocket using structured JSON messages:

```javascript
// Request data
{
    "mtyp": "request",
    "symbol": "ES",
    "timeframes": ["1m", "5m", "15m", "1h"]
}

// Receive data
{
    "mtyp": "data",
    "symbol": "ES",
    "timeframe": "1m",
    "data": [/* OHLCV candles */]
}
```

### Shared Data Service
For multi-window applications, use the Shared Data Service for efficient data sharing:

```javascript
import SharedDataClient from './services/SharedDataClient';

// Subscribe to data updates
SharedDataClient.subscribe('chartData', (data) => {
    // Handle data updates
});
```

## 🚀 Deployment

### Desktop Application
1. Build the application: `npm run build`
2. Package with Electron Builder (configuration in package.json)
3. Distribute the installer

### Development Distribution
- Share the repository for source code access
- Include all documentation and examples
- Provide setup instructions for development environment

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Standards
- Follow existing code style and patterns
- Add comments for complex logic
- Test new features thoroughly
- Update documentation as needed

### User Studies Contributions
- Place new studies in `src/userstudies/examples/` for review
- Include comprehensive documentation
- Follow the established study interface
- Test with multiple timeframes and data sets

## 📚 Documentation

- **[Project Bootstrap](QUATRAIN%20-%20Project%20Bootstrap.txt)**: Project overview and architecture
- **[Study Development Guide](reference/Quatrain%20Study%20Development%20Guide.md)**: Complete guide for creating custom studies
- **[Shared Data Architecture](reference/Quatrain%20Shared%20Data%20Service%20Usage.md)**: Multi-window data sharing
- **[Trade Boss Integration](reference/Trade%20Boss%20Candle%20Data%20Access%20Architecture.md)**: Advanced data access patterns

## 🐛 Troubleshooting

### Common Issues

**WebSocket Connection Failed**
- Verify Chronicle server is running
- Check network connectivity and firewall settings
- Confirm WebSocket URL in application settings

**NinjaTrader Bridge Connection**
- Ensure NinjaTrader 8 is running before starting the bridge
- Verify bridge is running on port 8079
- Check Windows firewall settings
- Confirm .NET 6.0 SDK is installed

**User Studies Not Loading**
- Check file placement in `src/userstudies/library/`
- Verify JavaScript syntax and required interface implementation
- Check browser console for error messages
- Ensure study files export the class correctly

**Performance Issues**
- Monitor annotation count (avoid creating excessive annotations)
- Use efficient data processing algorithms
- Consider data caching for complex calculations
- Check memory usage in large datasets

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **SciChart**: High-performance charting library
- **React & Electron**: Application framework
- **NinjaTrader**: Trading platform integration
- **Chronicle**: Backend data service

## 📞 Support

For questions, issues, or contributions:
- Open an issue on GitHub
- Check the documentation in the `reference/` directory
- Review example implementations in `src/userstudies/examples/`

---

**Quatrain** - Professional financial charting and trading platform for serious traders and developers.
