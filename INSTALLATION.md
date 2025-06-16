# Quatrain Installation Guide

This guide provides detailed instructions for setting up Quatrain for development and production use.

## 📋 System Requirements

### Minimum Requirements
- **Operating System**: Windows 10/11 (recommended), macOS 10.15+, or Linux Ubuntu 18.04+
- **Node.js**: v14.0.0 or higher
- **npm**: v6.0.0 or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space for dependencies and build files

### For Trading Features
- **NinjaTrader 8**: Required for live trading integration
- **.NET 6.0 SDK**: Required for NinjaTrader Bridge
- **Windows 10/11**: Required for NinjaTrader integration

## 🚀 Quick Start

### 1. Install Prerequisites

#### Node.js and npm
Download and install from [nodejs.org](https://nodejs.org/):
- Choose the LTS (Long Term Support) version
- Verify installation:
  ```bash
  node --version  # Should show v14.0.0 or higher
  npm --version   # Should show v6.0.0 or higher
  ```

#### Git
Download and install from [git-scm.com](https://git-scm.com/):
- Verify installation:
  ```bash
  git --version
  ```

### 2. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/[your-username]/quatrain.git
cd quatrain

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will start with:
- React development server on `http://localhost:3000`
- Electron desktop application window

## 🔧 Detailed Setup

### Development Environment

#### 1. Clone Repository
```bash
git clone https://github.com/[your-username]/quatrain.git
cd quatrain
```

#### 2. Install Dependencies
```bash
# Install all project dependencies
npm install

# Verify critical dependencies
npm list scichart electron react
```

#### 3. Environment Configuration
Create a `.env` file in the project root (optional):
```env
# WebSocket server configuration
REACT_APP_WS_URL=ws://localhost:8080
REACT_APP_WS_RECONNECT_INTERVAL=5000

# Development settings
REACT_APP_DEBUG_MODE=true
REACT_APP_LOG_LEVEL=debug
```

#### 4. Start Development
```bash
# Start both React and Electron in development mode
npm run dev

# Alternative: Start components separately
npm start          # React development server only
npm run electron    # Electron app only (after React is running)
```

### Production Build

#### 1. Build Application
```bash
# Create production build
npm run build

# Start production Electron app
npm run electron-start
```

#### 2. Package for Distribution
```bash
# Install electron-builder (if not already installed)
npm install --save-dev electron-builder

# Package for current platform
npm run dist

# Package for specific platforms
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist:linux  # Linux
```

## 🔌 Backend Integration

### Chronicle Server Setup

Quatrain requires a Chronicle backend server for data feeds.

#### Option 1: Use Existing Chronicle Instance
Configure the WebSocket URL in your application settings or `.env` file:
```env
REACT_APP_WS_URL=ws://your-chronicle-server:8080
```

#### Option 2: Set Up Chronicle Locally
1. Clone the Chronicle repository:
   ```bash
   git clone https://github.com/[your-username]/chronicle.git
   ```
2. Follow Chronicle's installation instructions
3. Start Chronicle server before launching Quatrain

### WebSocket Connection Testing
```javascript
// Test WebSocket connection in browser console
const ws = new WebSocket('ws://localhost:8080');
ws.onopen = () => console.log('Connected to Chronicle');
ws.onerror = (error) => console.error('Connection failed:', error);
```

## 💼 Trading Integration

### NinjaTrader Setup (Windows Only)

#### 1. Install NinjaTrader 8
- Download from [ninjatrader.com](https://ninjatrader.com/)
- Complete installation and initial setup
- Ensure at least one data connection is configured

#### 2. Install .NET 6.0 SDK
- Download from [dotnet.microsoft.com](https://dotnet.microsoft.com/download)
- Verify installation:
  ```bash
  dotnet --version  # Should show 6.0.x or higher
  ```

#### 3. Build NinjaTrader Bridge
```bash
# Navigate to bridge directory
cd NinjaTraderBridge

# Restore dependencies
dotnet restore

# Build the bridge
dotnet build

# Run the bridge
dotnet run
```

#### 4. Configure NinjaTrader Connection
1. Start NinjaTrader 8
2. Start the NinjaTrader Bridge
3. Launch Quatrain
4. Navigate to Trading → Trade Manager
5. Select "NinjaTrader" platform
6. Click "Connect"

### Testing Trading Integration
1. Verify NinjaTrader is running with active data connection
2. Confirm bridge is running on port 8079
3. Test connection in Quatrain Trade Manager
4. Verify account information displays correctly

## 🧪 User Studies Development

### Setting Up Study Development Environment

#### 1. Understand Directory Structure
```
src/userstudies/
├── core/           # Core study management system
├── components/     # UI components for study management
├── examples/       # Example studies for reference
└── library/        # User-created studies (auto-loaded)
```

#### 2. Create Your First Study
```bash
# Create a new study file
touch src/userstudies/library/MyFirstStudy.js
```

#### 3. Implement Study Interface
```javascript
class MyFirstStudy {
    constructor() {
        this.id = 'my-first-study';
        this.name = 'My First Study';
        this.description = 'A simple example study';
        
        this.settings = {
            period: { type: 'number', default: 20, min: 1, max: 100 }
        };
    }

    updateData(chartData, sessions) {
        // Your analysis logic here
        console.log('Processing data for', this.name);
    }
}

module.exports = MyFirstStudy;
```

#### 4. Test Your Study
1. Restart Quatrain (studies are loaded at startup)
2. Navigate to Strategy → User Studies
3. Find your study in the list
4. Enable and configure settings
5. Monitor browser console for debug output

### Study Development Resources
- **Examples**: Check `src/userstudies/examples/` for reference implementations
- **Documentation**: See `reference/Quatrain Study Development Guide.md`
- **API Reference**: Review existing studies for patterns and best practices

## 🐛 Troubleshooting

### Common Installation Issues

#### Node.js/npm Issues
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Use specific Node.js version with nvm
nvm install 16.20.0
nvm use 16.20.0
```

#### Electron Issues
```bash
# Rebuild Electron
npm run electron-rebuild

# Clear Electron cache
npm run electron-clean

# Reinstall Electron
npm uninstall electron
npm install electron --save-dev
```

#### SciChart License Issues
- Ensure SciChart license is properly configured
- Check for license expiration
- Verify license key in application settings

### Runtime Issues

#### WebSocket Connection Failed
1. **Check Chronicle Server**:
   - Verify Chronicle is running
   - Check server logs for errors
   - Confirm WebSocket port (default: 8080)

2. **Network Issues**:
   - Check firewall settings
   - Verify network connectivity
   - Test with different WebSocket URL

3. **Configuration Issues**:
   - Verify `.env` file settings
   - Check application WebSocket configuration
   - Confirm URL format: `ws://hostname:port`

#### NinjaTrader Bridge Issues
1. **Bridge Won't Start**:
   ```bash
   # Check .NET installation
   dotnet --version
   
   # Rebuild bridge
   cd NinjaTraderBridge
   dotnet clean
   dotnet build
   ```

2. **Connection Failed**:
   - Ensure NinjaTrader 8 is running
   - Check bridge is running on port 8079
   - Verify Windows firewall settings
   - Test with telnet: `telnet localhost 8079`

3. **No Account Data**:
   - Verify NinjaTrader has active connections
   - Check NinjaTrader account configuration
   - Review bridge logs for errors

#### User Studies Not Loading
1. **File Location**: Ensure studies are in `src/userstudies/library/`
2. **Syntax Errors**: Check browser console for JavaScript errors
3. **Interface Implementation**: Verify study implements required methods
4. **Module Export**: Ensure `module.exports = YourStudyClass;`

### Performance Issues

#### Slow Chart Rendering
- Reduce number of visible annotations
- Optimize study calculations
- Check for memory leaks in custom studies
- Monitor browser performance tools

#### High Memory Usage
- Review custom studies for memory leaks
- Clear annotation caches periodically
- Monitor data retention policies
- Use browser memory profiling tools

## 📞 Getting Help

### Resources
- **Documentation**: `reference/` directory
- **Examples**: `src/userstudies/examples/`
- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions and share ideas

### Debug Information
When reporting issues, include:
- Operating system and version
- Node.js and npm versions
- Quatrain version/commit hash
- Browser console errors
- Steps to reproduce the issue

### Log Files
Check these locations for additional debug information:
- Browser console (F12 → Console)
- Electron main process logs
- NinjaTrader Bridge console output
- Chronicle server logs

---

**Need additional help?** Open an issue on GitHub with detailed information about your setup and the problem you're experiencing. 