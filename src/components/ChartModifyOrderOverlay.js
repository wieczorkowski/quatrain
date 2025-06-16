import React from 'react';
import styled from 'styled-components';

// Styled components for the overlay
const OverlayContainer = styled.div`
  position: fixed;
  bottom: 40px; /* Consistent with ChartClickOrderOverlay */
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.85); /* Slightly more opaque for distinction */
  border: 1px solid #FFA500; /* Orange border for modification mode */
  border-radius: 6px;
  padding: 10px 15px; /* Slightly larger padding */
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 9999; /* Ensure it's on top */
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.5);
  max-width: 80%;
  font-family: 'Arial', sans-serif;
`;

const OverlayMessage = styled.div`
  color: white;
  font-size: 14px; /* Slightly larger font */
  margin-bottom: 10px;
  text-align: center;
`;

const DoneButton = styled.button`
  background-color: #FFA500; /* Orange to match border */
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 12px; /* Slightly larger button */
  font-size: 13px; /* Slightly smaller font for button */
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #cc8400; /* Darker orange on hover */
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(255, 165, 0, 0.5); /* Focus ring */
  }
`;

function ChartModifyOrderOverlay() {
  const handleDoneClick = () => {
    try {
      const { ipcRenderer } = window.require('electron');
      console.log('ChartModifyOrderOverlay: Done button clicked, sending IPC message.');
      ipcRenderer.send('chart-modify-overlay-done-clicked');
    } catch (error) {
      console.error('ChartModifyOrderOverlay: Error sending IPC message:', error);
      // Optionally, display an error to the user within the overlay or app
    }
  };

  return (
    <OverlayContainer>
      <OverlayMessage>Click and Drag Order to Change Price</OverlayMessage>
      <DoneButton onClick={handleDoneClick}>Done</DoneButton>
    </OverlayContainer>
  );
}

export default ChartModifyOrderOverlay; 