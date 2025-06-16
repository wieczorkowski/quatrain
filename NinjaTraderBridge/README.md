# NinjaTrader Bridge for Quatrain

This bridge provides connectivity between Quatrain's Trade Manager and NinjaTrader trading platform.

## Overview

There are two ways to connect Quatrain to NinjaTrader:

1. **NinjaTrader Bridge** (Current Implementation) - Uses NinjaTrader's Automated Trading Interface (ATI) to query account, position, and order information. Data updates are polled at regular intervals (currently every 5 seconds).

2. **Quatrain Trade Manager Add-On** (New Implementation) - A NinjaScript Add-On that runs inside NinjaTrader and provides real-time account, position, and execution updates through WebSockets.

## NinjaTrader Bridge

The NinjaTrader Bridge is a standalone .NET application that:
- Creates a WebSocket server on port 8079
- Connects to NinjaTrader using the ATI
- Polls for account and position data at regular intervals
- Provides account and position data to Quatrain's Trade Manager

### Files:
- `NinjaTraderBridge.cs` - Main bridge class
- `NTDirectWrapper.cs` - Wrapper for NinjaTrader ATI functions
- `Models.cs` - Data models for accounts and positions
- `NinjaTraderBridge.csproj` - Project file

### Limitations:
- Updates are polled every 5 seconds, not real-time
- Limited to functionality provided by the ATI
- Limited to account and position data provided by ATI
- Cannot receive real-time execution updates

## Quatrain Trade Manager Add-On (Recommended)

The Quatrain Trade Manager Add-On is a NinjaScript Add-On that:
- Runs directly inside NinjaTrader
- Receives real-time account, position, and execution updates through event handlers
- Provides a WebSocket server on port 8079 (configurable)
- Sends real-time updates to Quatrain's Trade Manager

### Files:
- `QuatrainTradeManagerAddOn.cs` - NinjaScript Add-On

### Advantages:
- Real-time updates triggered by actual events in NinjaTrader
- Full access to NinjaTrader's object model
- Richer data available (executions, orders, positions)
- Much more responsive updates

## Installation

### NinjaTrader Bridge (Current Implementation)
1. Build the project
2. Run the executable `NinjaTraderBridge.exe`
3. Connect to it from Quatrain's Trade Manager

### Quatrain Trade Manager Add-On (Recommended)
1. In NinjaTrader, select `Tools > Import > NinjaScript Add-On...`
2. Browse to the `QuatrainTradeManagerAddOn.cs` file
3. Restart NinjaTrader
4. In NinjaTrader, select `Tools > Options` and make sure `Enable automated trading` is checked
5. Find the "Quatrain Trade Manager" menu in the Tools menu
6. Connect to it from Quatrain's Trade Manager using the same WebSocket URL

## Usage

The Trade Manager in Quatrain connects to either implementation using WebSockets at `ws://localhost:8079`.

The data format and API are identical between both implementations, so no changes are needed in the Trade Manager code.

## Requirements

- NinjaTrader 8 installed and running
- Automated Trading Interface (ATI) enabled in NinjaTrader
- .NET 6.0 SDK or later

## Setting up NinjaTrader

Before using the bridge, you need to enable the Automated Trading Interface (ATI) in NinjaTrader:

1. Open NinjaTrader 8
2. Select the **Tools** menu
3. Select **Options**
4. Go to the **ATI** tab
5. Check the box for **Enable ATI**
6. Click **OK**

## Building the Bridge

To build the bridge:

1. Open a command prompt in the NinjaTraderBridge directory
2. Run the following command:

```
dotnet build
```

## Running the Bridge

To run the bridge:

1. Ensure NinjaTrader is running with ATI enabled
2. Open a command prompt in the NinjaTraderBridge directory
3. Run the following command:

```
dotnet run
```

The bridge will start and listen on port 8079 for connections from Quatrain.

## Troubleshooting

If you encounter issues connecting to NinjaTrader:

1. Ensure NinjaTrader is running
2. Verify that the ATI is enabled in NinjaTrader options
3. Check that you have the correct version of NinjaTrader installed (version 8)
4. Make sure the NTDirect.dll is accessible in the Windows System32 or SysWOW64 directory

## Architecture

The bridge uses the NinjaTrader ATI (Automated Trading Interface) through the NTDirect.dll file. This DLL provides functions to:

- Connect to NinjaTrader
- Get account information
- Get positions
- Get market data
- Place and manage orders (future functionality)

The bridge exposes a WebSocket server that the Quatrain Trade Manager connects to, providing real-time updates of account information and positions.

## Security Note

This bridge is designed for local use only. It does not implement authentication or encryption mechanisms and should not be exposed to the internet. 