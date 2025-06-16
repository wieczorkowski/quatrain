import React from 'react';
import { sendToNTBridge } from '../services/nt-bridge-service';
import { convertNinjaTraderToCme } from '../utils/symbolMapping';

// Renders the positions table
export const PositionsTable = ({ 
  accountDetails, 
  marketData, 
  selectedAccount, 
  isConnected,
  setPopupContent,
  setShowPopup,
  smartStopSettings
}) => {
  if (!accountDetails) return null;
  
  if (!accountDetails.positions || accountDetails.positions.length === 0) {
    return <div className="message">No positions</div>;
  }
  
  // Helper to format price or show placeholder
  const formatPrice = (price) => {
    return (price !== null && price !== undefined) ? `$${Number(price).toFixed(2)}` : 'n/l';
  };

  // Get market data from DataClient
  const symbol = marketData.currentSymbol;
  const price = marketData.latestPrice;

  // Function to handle flatten position
  const handleFlattenPosition = (instrumentSymbol) => {
    if (!selectedAccount || !isConnected) {
      console.error("Cannot flatten: No selected account or not connected.");
      setPopupContent({
        title: 'Error',
        message: 'Cannot flatten position: No account selected or connection lost.'
      });
      setShowPopup(true);
      return;
    }

    const accountId = selectedAccount.accountId || selectedAccount.id;
    if (!accountId || !instrumentSymbol) {
      console.error("Cannot flatten: Missing accountId or instrumentSymbol.");
      setPopupContent({
        title: 'Error',
        message: 'Cannot flatten position: Missing account or instrument identifier.'
      });
      setShowPopup(true);
      return;
    }
    
    console.log(`Sending flatten request for Account: ${accountId}, Instrument: ${instrumentSymbol}`);
    sendToNTBridge({
      type: 'flattenPosition',
      accountId: accountId,
      instrumentSymbol: instrumentSymbol // Send the NinjaTrader symbol
    });
  };

  return (
    <div className="scrollable-table-container">
      <table className="positions-table">
        <thead className="positions-header">
          <tr>
            <th>Instrument (CME / NT)</th>
            <th>Quantity</th>
            <th>Avg. Price</th>
            <th>Market Price</th>
            <th>P/L</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody className="positions-body">
          {accountDetails.positions.map((position, index) => {
            // Determine display based on marketPosition
            let quantityDisplay;
            if (position.marketPosition === "Long") {
              quantityDisplay = <span className="positive-value">Long {position.quantity}</span>;
            } else if (position.marketPosition === "Short") {
              quantityDisplay = <span className="negative-value">Short {position.quantity}</span>; 
            } else {
              quantityDisplay = <span className="neutral-value">Flat</span>;
            }
            
            // Check if position matches current instrument
            const positionCmeSymbol = position.cmeSymbol;
            const isCurrentInstrument = positionCmeSymbol === symbol;
            console.log(`Pos #${index}: CME Symbol: ${positionCmeSymbol}, DataClient Symbol: ${symbol}, Match: ${isCurrentInstrument}, DataClient Price: ${price}`);

            // For positions that match the current instrument, calculate P/L
            let marketPriceDisplay, pnlDisplay, pnlValue;
            
            if (isCurrentInstrument && price !== null && price !== undefined) {
              // Format market price
              marketPriceDisplay = formatPrice(price);
              
              // Calculate P/L
              const averagePrice = position.averagePrice || 0;
              const quantity = position.quantity || 0;
              const contractMultiplier = marketData.instrumentProperties?.pointValue || 1;
              
              if (position.marketPosition === "Long") {
                // For long positions: (current price - average price) * quantity * multiplier
                pnlValue = (price - averagePrice) * quantity * contractMultiplier;
              } else if (position.marketPosition === "Short") {
                // For short positions: (average price - current price) * quantity * multiplier
                pnlValue = (averagePrice - price) * quantity * contractMultiplier;
              } else {
                pnlValue = 0;
              }
              
              // Format P/L with color based on value
              if (pnlValue > 0) {
                pnlDisplay = <span className="positive-value">${pnlValue.toFixed(2)}</span>;
              } else if (pnlValue < 0) {
                pnlDisplay = <span className="negative-value">${Math.abs(pnlValue).toFixed(2)}</span>;
              } else {
                pnlDisplay = <span className="neutral-value">$0.00</span>;
              }
            } else {
              // For positions that don't match the current instrument, show placeholder
              marketPriceDisplay = "-";
              pnlDisplay = "-";
            }
            
            return (
              <tr key={index}>
                <td>
                  {position.cmeSymbol}
                  <br />
                  <span style={{ fontSize: '0.9em', color: '#aaa' }}>{position.ninjaTraderSymbol}</span>
                </td>
                <td>{quantityDisplay}</td>
                <td>{formatPrice(position.averagePrice)}</td>
                <td>{marketPriceDisplay}</td>
                <td>{pnlDisplay}</td>
                <td>
                  <button 
                    className="action-button button danger"
                    onClick={() => handleFlattenPosition(position.ninjaTraderSymbol)}
                    disabled={!accountDetails?.accountId}
                  >
                    Flatten
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {/* SmartStop indicator with enhanced display */}
      {(smartStopSettings.stopQtyFollowsPosition || 
        smartStopSettings.trailStopEnabled || 
        smartStopSettings.candleStopEnabled) && (
        <div className="smart-stop-indicator">
          SmartStop: {[
            smartStopSettings.stopQtyFollowsPosition ? 'Qty' : null,
            smartStopSettings.trailStopEnabled ? `Trail ${smartStopSettings.trailStopPoints}` : null,
            smartStopSettings.candleStopEnabled ? `Candle ${smartStopSettings.candleTimeframe} ${
              smartStopSettings.candleType === 'favorable' ? 'Fav' : 
              smartStopSettings.candleType === 'unfavorable' ? 'Unf' : 'Any'
            }` : null
          ].filter(Boolean).join(', ')}
        </div>
      )}
    </div>
  );
};

// Renders the orders table
export const OrdersTable = ({ 
  selectedAccount, 
  isConnected, 
  ordersRef, 
  setPopupContent, 
  setShowPopup,
  smartStopSettings,
  handleModifyOrderClick
}) => {
  // Get orders for the selected account
  const accountOrders = Object.values(ordersRef.current).filter(
    order => order.accountId === selectedAccount?.id || order.accountId === selectedAccount?.accountId
  );

  // Sort orders, e.g., by submission time descending
  accountOrders.sort((a, b) => new Date(b.submissionTime) - new Date(a.submissionTime));

  if (accountOrders.length === 0) {
    return <div className="message">No orders for this account</div>;
  }

  // Function to handle order cancellation request
  const handleCancelOrder = (orderId) => {
    if (!selectedAccount || !isConnected) {
      console.error("Cannot cancel order: No selected account or not connected.");
      setPopupContent({
        title: 'Error',
        message: 'Cannot cancel order: No account selected or connection lost.'
      });
      setShowPopup(true);
      return;
    }

    const accountId = selectedAccount.accountId || selectedAccount.id;
    if (!accountId || !orderId) {
      console.error("Cannot cancel order: Missing accountId or orderId.");
      setPopupContent({
        title: 'Error',
        message: 'Cannot cancel order: Missing account or order identifier.'
      });
      setShowPopup(true);
      return;
    }

    console.log(`Sending cancel request for Account: ${accountId}, OrderID: ${orderId}`);
    sendToNTBridge({
      type: 'cancel_order',
      accountId: accountId,
      orderId: orderId
    });
  };

  const formatOrderPrice = (price) => {
    return price && price !== 0 ? `$${Number(price).toFixed(2)}` : '-';
  };

  const formatOrderId = (orderId) => {
    if (!orderId || orderId.length < 6) {
      return orderId || 'N/A';
    }
    return `${orderId.substring(0, 3)}__${orderId.substring(orderId.length - 3)}`;
  };

  const formatOrderTime = (timeString) => {
    try {
      const date = new Date(timeString);
      // Options for 24-hour format H:mm:ss
      const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
      return date.toLocaleTimeString('en-US', options);
    } catch (e) {
      console.error("Error formatting time:", timeString, e);
      return 'Invalid Time';
    }
  };

  // Helper function to determine if an order can be modified
  const canModifyOrder = (order) => {
    // Only allow modification of working orders
    const modifiableStates = ['Working', 'Accepted', 'Submitted'];
    
    // Only support specific order types that we can modify correctly
    const modifiableTypes = ['Limit', 'StopMarket', 'StopLimit', 'MIT'];
    
    return modifiableStates.includes(order.state) && 
           modifiableTypes.some(type => order.type === type);
  };

  return (
    <div className="scrollable-table-container">
      <table className="orders-table">
        <thead className="orders-header">
          <tr>
            <th>ID</th>
            <th>Time</th>
            <th>Instrument</th>
            <th>Action</th>
            <th>Type</th>
            <th>Qty</th>
            <th>Filled</th>
            <th>Avg Price</th>
            <th>Limit Price</th>
            <th>Stop Price</th>
            <th>Status</th>
            <th>Actions</th> 
          </tr>
        </thead>
        <tbody className="orders-body">
          {accountOrders.map((order) => {
            // Determine status color
            let statusColor = '#FFFFFF'; // Default white
            // Check state string for working status
            if (order.state === 'Working' || order.state === 'Accepted' || order.state === 'PendingSubmit' || order.state === 'Submitted') statusColor = '#03A9F4';
            if (order.state === 'Filled') statusColor = '#4CAF50'; // Green for filled
            if (order.state === 'Cancelled') statusColor = '#9E9E9E'; // Grey for cancelled
            if (order.state === 'Rejected') statusColor = '#F44336'; // Red for rejected

            return (
              <tr key={order.orderId}>
                <td title={order.orderId}>{formatOrderId(order.orderId)}</td>
                <td>{formatOrderTime(order.submissionTime)}</td>
                <td>{order.instrument}</td>
                <td>{order.action}</td>
                <td>{order.type}</td>
                <td>{order.quantity}</td>
                <td>{order.filledQuantity}</td>
                <td>{formatOrderPrice(order.averageFillPrice)}</td>
                <td>{formatOrderPrice(order.limitPrice)}</td>
                <td>{formatOrderPrice(order.stopPrice)}</td>
                <td style={{ color: statusColor }}>{order.state}</td>
                <td>
                  {/* Show Modify button for orders that can be modified */}
                  {canModifyOrder(order) && (
                    <button className="modify-button" onClick={() => handleModifyOrderClick(order)}>
                      Modify
                    </button>
                  )}
                  {/* Add Cancel button for working orders (checking state) */} 
                  {(order.state === 'Working' || order.state === 'Accepted' || order.state === 'PendingSubmit' || order.state === 'Submitted') && (
                    <button className="cancel-button" onClick={() => handleCancelOrder(order.orderId)}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {/* SmartStop indicator */}
      {smartStopSettings.stopQtyFollowsPosition && (
        <div className="smart-stop-indicator">
          SmartStop: Qty
        </div>
      )}
    </div>
  );
}; 