import React from 'react';

const TestImage = () => {
  return (
    <div style={{ 
      position: 'absolute', 
      top: '10px', 
      right: '10px', 
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      <div>Testing Image Display:</div>
      <div style={{ 
        width: '50px', 
        height: '50px', 
        border: '1px solid red',
        backgroundImage: 'url(./images/button-drawing-lock.png)',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}></div>
      <div style={{ 
        width: '50px', 
        height: '50px', 
        border: '1px solid blue',
        backgroundImage: 'url(./images/plus-sign.png)',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}></div>
    </div>
  );
};

export default TestImage; 