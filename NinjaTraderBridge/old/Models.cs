using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace NinjaTraderBridge
{
    /// <summary>
    /// Represents a trading account in NinjaTrader
    /// </summary>
    public class AccountInfo
    {
        [JsonProperty("accountId")]
        public string AccountId { get; set; } = string.Empty;
        
        [JsonProperty("name")]
        public string Name { get; set; } = string.Empty;
        
        [JsonProperty("connectionName")]
        public string ConnectionName { get; set; } = string.Empty;
        
        [JsonProperty("accountType")]
        public string AccountType { get; set; } = string.Empty;
        
        [JsonProperty("cashValue")]
        public double CashValue { get; set; }
        
        [JsonProperty("buyingPower")]
        public double BuyingPower { get; set; }
        
        [JsonProperty("realizedProfitLoss")]
        public double RealizedProfitLoss { get; set; }
        
        [JsonProperty("unrealizedProfitLoss")]
        public double UnrealizedProfitLoss { get; set; }
        
        [JsonProperty("netLiquidationValue")]
        public double NetLiquidationValue { get; set; }
        
        [JsonProperty("positions")]
        public List<Position> Positions { get; set; } = new List<Position>();
    }

    /// <summary>
    /// Represents a position in an instrument
    /// </summary>
    public class Position
    {
        [JsonProperty("instrument")]
        public string Instrument { get; set; } = string.Empty;
        
        [JsonProperty("quantity")]
        public int Quantity { get; set; }
        
        [JsonProperty("averagePrice")]
        public double AveragePrice { get; set; }
        
        [JsonProperty("marketPrice")]
        public double MarketPrice { get; set; }
        
        [JsonProperty("unrealizedPnL")]
        public double UnrealizedPnL { get; set; }
    }

    /// <summary>
    /// WebSocket message format for client communication
    /// </summary>
    public class WebSocketMessage
    {
        [JsonProperty("type")]
        public string Type { get; set; } = string.Empty;
    }

    /// <summary>
    /// Connect command message
    /// </summary>
    public class ConnectMessage : WebSocketMessage
    {
        public ConnectMessage()
        {
            Type = "connect";
        }
    }

    /// <summary>
    /// Disconnect command message
    /// </summary>
    public class DisconnectMessage : WebSocketMessage
    {
        public DisconnectMessage()
        {
            Type = "disconnect";
        }
    }

    /// <summary>
    /// Get accounts command message
    /// </summary>
    public class GetAccountsMessage : WebSocketMessage
    {
        public GetAccountsMessage()
        {
            Type = "getAccounts";
        }
    }

    /// <summary>
    /// Get account details command message
    /// </summary>
    public class GetAccountDetailsMessage : WebSocketMessage
    {
        public GetAccountDetailsMessage()
        {
            Type = "getAccountDetails";
        }

        [JsonProperty("accountId")]
        public string AccountId { get; set; } = string.Empty;
    }

    /// <summary>
    /// Connection status response message
    /// </summary>
    public class ConnectionStatusMessage : WebSocketMessage
    {
        public ConnectionStatusMessage()
        {
            Type = "connectionStatus";
        }

        [JsonProperty("connected")]
        public bool Connected { get; set; }
    }

    /// <summary>
    /// Account list response message
    /// </summary>
    public class AccountListMessage : WebSocketMessage
    {
        public AccountListMessage()
        {
            Type = "accountList";
        }

        [JsonProperty("accounts")]
        public List<AccountListItem> Accounts { get; set; } = new List<AccountListItem>();
    }

    /// <summary>
    /// Account list item for simplified account list
    /// </summary>
    public class AccountListItem
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;
        
        [JsonProperty("name")]
        public string Name { get; set; } = string.Empty;
        
        [JsonProperty("accountType")]
        public string AccountType { get; set; } = string.Empty;
    }

    /// <summary>
    /// Account details response message
    /// </summary>
    public class AccountDetailsMessage : WebSocketMessage
    {
        public AccountDetailsMessage()
        {
            Type = "accountDetails";
        }

        [JsonProperty("account")]
        public AccountInfo Account { get; set; } = new AccountInfo();
    }

    /// <summary>
    /// Accounts update response message
    /// </summary>
    public class AccountsUpdateMessage : WebSocketMessage
    {
        public AccountsUpdateMessage()
        {
            Type = "accountsUpdate";
        }

        [JsonProperty("accounts")]
        public List<AccountInfo> Accounts { get; set; } = new List<AccountInfo>();
    }

    /// <summary>
    /// Error response message
    /// </summary>
    public class ErrorMessage : WebSocketMessage
    {
        public ErrorMessage()
        {
            Type = "error";
        }

        [JsonProperty("message")]
        public string Message { get; set; } = string.Empty;
    }
} 