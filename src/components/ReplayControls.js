import React from 'react';

/**
 * ReplayControls component - displays replay control UI when in replay mode
 */
const ReplayControls = ({
  replayEnded,
  latestTimestamp,
  formatTimestamp,
  resetQuatrain,
  intervalInputValue,
  handleIntervalChange,
  handleIntervalSubmit,
  replayPaused,
  handleReplayPauseToggle,
  handleReplayStop
}) => {
  return (
    <div style={{
      position: 'absolute',
      bottom: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'black',
      color: 'white',
      padding: '5px 15px',
      borderRadius: '4px',
      fontWeight: 'bold',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div>
        {replayEnded ? 'REPLAY ENDED' : `REPLAY ${latestTimestamp ? `- ${formatTimestamp(latestTimestamp)}` : ''}`}
      </div>
      {replayEnded ? (
        /* When replay has ended, show Reset Quatrain button */
        <div style={{
          display: 'flex',
          width: '100%',
          marginTop: '5px',
          justifyContent: 'center'
        }}>
          <button
            onClick={resetQuatrain}
            style={{
              backgroundColor: '#333',
              border: '1px solid #777',
              color: 'white',
              padding: '5px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold'
            }}
          >
            Reset Quatrain
          </button>
        </div>
      ) : (
        /* When replay is active or paused, show controls */
        <div style={{
          display: 'flex',
          width: '100%',
          gap: '5px',
          marginTop: '5px',
          alignItems: 'center'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: '10px',
            alignItems: 'center',
            marginRight: '5px'
          }}>
            <label htmlFor="replayInterval" style={{ 
              marginBottom: '2px',
              color: 'white'
            }}>
              Interval
            </label>
            <input
              id="replayInterval"
              type="text"
              value={intervalInputValue}
              onChange={handleIntervalChange}
              onKeyDown={handleIntervalSubmit}
              style={{
                width: '50px',
                backgroundColor: 'transparent',
                border: '1px solid #555',
                color: 'white',
                borderRadius: '3px',
                padding: '2px 5px',
                fontSize: '12px',
                textAlign: 'center'
              }}
            />
          </div>
          <button
            onClick={handleReplayPauseToggle}
            style={{
              backgroundColor: '#333',
              border: '1px solid #777',
              color: 'white',
              padding: '5px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold'
            }}
          >
            {replayPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={handleReplayStop}
            style={{
              backgroundColor: '#333',
              border: '1px solid #777',
              color: 'white',
              padding: '5px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold'
            }}
          >
            Stop
          </button>
        </div>
      )}
    </div>
  );
};

export default ReplayControls; 