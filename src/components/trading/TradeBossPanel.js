import React from 'react';
import {
  SmartStopPanel,
  SmartStopContainer,
  SmartStopHeader,
  SmartStopSection,
  Button,
  ButtonGroup,
  QtyInput,
  Input,
  Label,
  Select
} from './TradeWindowStyles';

/**
 * Trade Boss Panel Component
 * 
 * Contains the UI for Trade Boss automated trading functionality.
 * Extracted from TradeWindow.js for better code organization.
 */
const TradeBossPanel = ({
  // Trade Boss state
  tradePlan,
  setTradePlan,
  stopLossPoints,
  setStopLossPoints,
  scaleOutQty,
  setScaleOutQty,
  scaleOutPoints,
  setScaleOutPoints,
  scaleOutUnit,
  setScaleOutUnit,
  tradeBossQuantity,
  setTradeBossQuantity,
  
  // Connection and trading state
  isConnected,
  symbol,
  accountName,
  
  // Event handlers
  onGoLong,
  onGoShort
}) => {
  
  // Handle quantity input change with validation
  const handleQuantityChange = (e) => {
    const value = e.target.value;
    // Allow empty string or numbers only
    if (value === '' || /^\d+$/.test(value)) {
      setTradeBossQuantity(value);
    }
  };

  return (
    <SmartStopPanel>
      <SmartStopContainer>
        <SmartStopHeader>
          <span>Trade Boss</span>
        </SmartStopHeader>
        
        {/* Trade Plan Selection */}
        <SmartStopSection>
          <Select 
            value={tradePlan} 
            onChange={(e) => setTradePlan(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          >
            <option value="" style={{ fontStyle: 'italic' }}>Select Trade Plan</option>
            <option value="simple-price">Simple Price</option>
          </Select>
        </SmartStopSection>
        
        {/* Simple Price Plan Settings */}
        {tradePlan === 'simple-price' && (
          <>
            {/* Stop Loss Setting */}
            <SmartStopSection>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ marginRight: '8px' }}>Set stop loss at</span>
                <Input
                  type="number"
                  value={stopLossPoints}
                  onChange={(e) => setStopLossPoints(e.target.value)}
                  style={{ width: '60px', padding: '4px 8px', marginRight: '8px' }}
                />
                <span>points</span>
              </div>
            </SmartStopSection>
            
            {/* Scale Out Setting */}
            <SmartStopSection>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <span>Scale out for</span>
                <Input
                  type="number"
                  value={scaleOutQty}
                  onChange={(e) => setScaleOutQty(e.target.value)}
                  style={{ width: '50px', padding: '4px 8px' }}
                />
                <span>at each</span>
                <Input
                  type="number"
                  value={scaleOutPoints}
                  onChange={(e) => setScaleOutPoints(e.target.value)}
                  style={{ width: '50px', padding: '4px 8px' }}
                />
                <Select 
                  value={scaleOutUnit} 
                  onChange={(e) => setScaleOutUnit(e.target.value)}
                  style={{ width: '80px', padding: '4px 8px' }}
                >
                  <option value="points">points</option>
                  <option value="R">R</option>
                </Select>
              </div>
            </SmartStopSection>
            
            {/* Go Long/Go Short Buttons */}
            <SmartStopSection>
              <ButtonGroup>
                <Button
                  color="#4CAF50"
                  onClick={onGoLong}
                  disabled={!isConnected || !symbol || !accountName}
                >
                  Go Long
                </Button>

                <QtyInput
                  type="text"
                  value={tradeBossQuantity}
                  onChange={handleQuantityChange}
                  placeholder="QTY"
                />

                <Button
                  color="#F44336"
                  onClick={onGoShort}
                  disabled={!isConnected || !symbol || !accountName}
                >
                  Go Short
                </Button>
              </ButtonGroup>
            </SmartStopSection>
          </>
        )}
      </SmartStopContainer>
    </SmartStopPanel>
  );
};

export default TradeBossPanel; 