import React from 'react';

/**
 * ConnectionScreen component - displays the initial connection screen with inputs for connection settings
 */
const ConnectionScreen = ({
  clientId,
  setClientId,
  instrument,
  setInstrument,
  historicalDays,
  setHistoricalDays,
  dataMode,
  setDataMode,
  chartLayout,
  setChartLayout,
  historyStart,
  setHistoryStart,
  liveStart,
  setLiveStart,
  liveEnd,
  setLiveEnd,
  replayInterval,
  setReplayInterval,
  connect,
  backgroundImage,
  showExternalClientSyncNotification
}) => {
  return (
    <div style={{ 
      textAlign: 'center', 
      marginTop: '0', 
      color: 'white', 
      height: '100vh', 
      backgroundColor: 'black',
      backgroundImage: `url(${backgroundImage})`, 
      backgroundSize: 'contain',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: '30px',
        borderRadius: '10px',
        width: '400px'
      }}>
        <h1>Custom Multi-Way Charting Client</h1>
        <label>
          Client ID:
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            style={{ marginLeft: '10px', background: 'black', color: 'white' }}
          />
        </label>
        <br />
        <label>
          Instrument:
          <input
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            style={{ marginLeft: '10px', background: 'black', color: 'white' }}
          />
        </label>
        <br />
        {dataMode !== 'Replay' ? (
          <label>
            Days of Historical Data:
            <input
              type="number"
              value={historicalDays}
              onChange={(e) => setHistoricalDays(e.target.value)}
              style={{ marginLeft: '10px', background: 'black', color: 'white' }}
            />
          </label>
        ) : (
          <>
            <label>
              History Start:
              <input
                type="datetime-local"
                value={historyStart}
                onChange={(e) => setHistoryStart(e.target.value)}
                style={{ marginLeft: '10px', background: 'black', color: 'white' }}
              />
            </label>
            <br />
            <label>
              Live Start:
              <input
                type="datetime-local"
                value={liveStart}
                onChange={(e) => setLiveStart(e.target.value)}
                style={{ marginLeft: '10px', background: 'black', color: 'white' }}
              />
            </label>
            <br />
            <label>
              Live End:
              <input
                type="datetime-local"
                value={liveEnd}
                onChange={(e) => setLiveEnd(e.target.value)}
                style={{ marginLeft: '10px', background: 'black', color: 'white' }}
              />
            </label>
            <br />
            <label>
              Replay Interval (ms):
              <input
                type="number"
                value={replayInterval}
                onChange={(e) => setReplayInterval(parseInt(e.target.value))}
                style={{ marginLeft: '10px', background: 'black', color: 'white' }}
              />
            </label>
          </>
        )}
        <br />
        <label>
          Data Mode:
          <select
            value={dataMode}
            onChange={(e) => setDataMode(e.target.value)}
            style={{ marginLeft: '10px', background: 'black', color: 'white', padding: '3px' }}
          >
            <option value="Live">Live</option>
            <option value="History Only">History Only</option>
            <option value="Replay">Replay</option>
          </select>
        </label>
        <br />
        <label>
          Chart Layout:
          <select
            value={chartLayout}
            onChange={(e) => setChartLayout(e.target.value)}
            style={{ marginLeft: '10px', background: 'black', color: 'white', padding: '3px' }}
          >
            <option value="4-way">4-way (1h, 15m, 5m, 1m)</option>
            <option value="6-way">6-way (1h, 30m, 15m, 10m, 5m, 1m)</option>
            <option value="6-way-long">6-way Long (1d, 4h, 1h, 15m, 5m, 1m)</option>
          </select>
        </label>
        <br />
        <button 
          onClick={() => connect()} 
          style={{ 
            marginTop: '20px', 
            background: 'rgba(0, 0, 0, 0.7)', 
            color: 'white', 
            padding: '8px 16px', 
            border: '1px solid white', 
            borderRadius: '4px' 
          }}
        >
          Connect
        </button>
      </div>
      
      {/* External Client Sync Notification on Title Screen */}
      {showExternalClientSyncNotification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: 'rgba(0, 128, 0, 0.9)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '5px',
          fontSize: '14px',
          zIndex: 10000,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          animation: 'fadeIn 0.3s ease-in'
        }}>
          External client sync'd
        </div>
      )}
    </div>
  );
};

export default ConnectionScreen; 