import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

// Styled components for the overlay
const OverlayContainer = styled.div`
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  border: 1px solid ${props => props.action === 'BUY' ? '#4CAF50' : '#FF5252'};
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 9999;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.5);
  max-width: 80%;
  font-family: 'Arial', sans-serif;
`;

const OverlayMessage = styled.div`
  color: white;
  font-size: 13px;
  margin-bottom: 8px;
  text-align: center;
`;

const OrderDetails = styled.div`
  color: #aaa;
  font-size: 12px;
  margin-bottom: 6px;
  text-align: center;
`;

const ActionText = styled.span`
  color: ${props => props.action === 'BUY' ? '#4CAF50' : '#FF5252'};
  font-weight: bold;
`;

const CancelButton = styled.button`
  background-color: #444;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  
  &:hover {
    background-color: #555;
  }
`;

/**
 * Overlay component that appears when a user wants to place an order by clicking on the chart
 */
function ChartClickOrderOverlay({ orderData, onCancel }) {
  const [visible, setVisible] = useState(true);

  // Automatically hide overlay after 30 seconds for safety
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onCancel();
    }, 30000);

    return () => clearTimeout(timer);
  }, [onCancel]);

  if (!visible || !orderData) return null;

  const { action, quantity, symbol, accountId, orderType } = orderData;
  
  // Determine the display order type based on orderType property
  const getDisplayOrderType = () => {
    if (!orderType) return 'LIMIT'; // Default to LIMIT if not specified
    
    if (orderType === 'LIMITSTOP') return 'STOP LIMIT';
    if (orderType === 'MARKETSTOP') return 'STOP MARKET';
    return orderType; // For any other order types
  };

  return (
    <OverlayContainer action={action}>
      <OverlayMessage>
        Click to place <ActionText action={action}>{action} {getDisplayOrderType()}</ActionText>
      </OverlayMessage>
      <OrderDetails>
        {quantity} {symbol} on {accountId || 'Unknown'}
      </OrderDetails>
      <CancelButton onClick={onCancel}>
        Cancel
      </CancelButton>
    </OverlayContainer>
  );
}

export default ChartClickOrderOverlay; 