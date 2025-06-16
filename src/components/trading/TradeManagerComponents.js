import React from 'react';

// Available trading platforms
const PLATFORMS = [
  { id: 'ninjatrader', name: 'NinjaTrader' },
  { id: 'demo', name: 'Demo Account' }
];

// Platform Selection Component
export const PlatformSelection = ({ 
  selectedPlatform, 
  isConnected, 
  isConnecting, 
  handlePlatformChange, 
  handleConnect, 
  handleDisconnect 
}) => {
  return (
    <div className="platform-selector">
      <label className="label" htmlFor="platform">Trading Platform:</label>
      <select 
        className="select" 
        id="platform" 
        value={selectedPlatform} 
        onChange={handlePlatformChange}
      >
        <option value="">Select a Platform</option>
        {PLATFORMS.map(platform => (
          <option key={platform.id} value={platform.id}>
            {platform.name}
          </option>
        ))}
      </select>
      
      <div className="button-group">
        <button 
          className={`button ${isConnected || isConnecting ? '' : 'primary'}`}
          disabled={!selectedPlatform || isConnected || isConnecting} 
          onClick={handleConnect}
        >
          {isConnecting ? (
            <>
              <div className="loading-spinner" /> Connecting...
            </>
          ) : 'Connect'}
        </button>
        
        <button 
          className={`button ${!isConnected ? '' : 'danger'}`}
          disabled={!isConnected} 
          onClick={handleDisconnect}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
};

// Account List Component
export const AccountList = ({ 
  isConnected, 
  ntAccounts, 
  selectedAccount, 
  handleAccountSelect 
}) => {
  if (!isConnected) {
    return <div className="message">Not connected to any platform</div>;
  }
  
  if (ntAccounts.length === 0) {
    return <div className="message">No accounts available</div>;
  }
  
  return (
    <div className="accounts-list">
      {ntAccounts.map(account => (
        <div 
          key={account.id} 
          className={`account-item ${selectedAccount && selectedAccount.id === account.id ? 'selected' : ''}`}
          onClick={() => handleAccountSelect(account)}
        >
          <div className="account-name">{account.name}</div>
        </div>
      ))}
    </div>
  );
};

// Account Overview Component
export const AccountOverview = ({ accountDetails }) => {
  console.log("Rendering Account Overview. Details:", accountDetails); // Log re-render and state

  if (!accountDetails) return null;
  
  // Helper function to safely format numeric values
  const safeFormat = (value) => {
    return (value !== null && value !== undefined) 
      ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '0.00';
  };
  
  return (
    <table className="stats-table">
      <tbody>
        <tr className="table-row">
          <td className="table-cell">Account ID</td>
          <td className="table-cell">{accountDetails.accountId}</td>
        </tr>
        <tr className="table-row">
          <td className="table-cell">Connection</td>
          <td className="table-cell">{accountDetails.connectionName}</td>
        </tr>
        <tr className="table-row">
          <td className="table-cell">Account Type</td>
          <td className="table-cell">{accountDetails.accountType}</td>
        </tr>
        <tr className="table-row">
          <td className="table-cell">Cash Value</td>
          <td className="table-cell">
            ${safeFormat(accountDetails.cashValue)}
          </td>
        </tr>
        <tr className="table-row">
          <td className="table-cell">Buying Power</td>
          <td className="table-cell">
            ${safeFormat(accountDetails.buyingPower)}
          </td>
        </tr>
        <tr className="table-row">
          <td className="table-cell">Realized P/L</td>
          <td className="table-cell">
            <span className={`profit-loss-display ${accountDetails.realizedProfitLoss > 0 ? 'positive' : accountDetails.realizedProfitLoss < 0 ? 'negative' : 'neutral'}`}>
              {Math.abs(accountDetails.realizedProfitLoss || 0).toFixed(2)}
            </span>
          </td>
        </tr>
        <tr className="table-row">
          <td className="table-cell">Unrealized P/L</td>
          <td className="table-cell">
            <span className={`profit-loss-display ${accountDetails.unrealizedProfitLoss > 0 ? 'positive' : accountDetails.unrealizedProfitLoss < 0 ? 'negative' : 'neutral'}`}>
              {Math.abs(accountDetails.unrealizedProfitLoss || 0).toFixed(2)}
            </span>
          </td>
        </tr>
        <tr className="table-row">
          <td className="table-cell">Net Liquidation Value</td>
          <td className="table-cell">
            ${safeFormat(accountDetails.netLiquidationValue)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}; 