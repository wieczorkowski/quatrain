using System;
using System.Collections.Generic;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace NinjaTraderBridge
{
    /// <summary>
    /// Main bridge class that connects Quatrain to NinjaTrader
    /// </summary>
    public class NinjaTraderBridge
    {
        private HttpListener _listener;
        private readonly Dictionary<string, WebSocket> _clients = new Dictionary<string, WebSocket>();
        private readonly Dictionary<string, AccountInfo> _accounts = new Dictionary<string, AccountInfo>();
        private bool _isConnectedToNinjaTrader = false;
        private readonly object _lock = new object();
        private System.Threading.Timer _accountUpdateTimer;
        
        private const int Port = 8079;

        /// <summary>
        /// Start the bridge server
        /// </summary>
        public async Task StartServer()
        {
            try
            {
                _listener = new HttpListener();
                _listener.Prefixes.Add($"http://localhost:{Port}/");
                _listener.Start();
                
                Console.WriteLine($"NinjaTrader Bridge started on http://localhost:{Port}/");
                
                // Try to initialize NinjaTrader connection
                InitializeNinjaTrader();

                // Start the account update timer (every 5 seconds)
                _accountUpdateTimer = new System.Threading.Timer(UpdateAccountInfo, null, 0, 5000);

                // Listen for incoming connections
                while (_listener.IsListening)
                {
                    try
                    {
                        var context = await _listener.GetContextAsync();
                        
                        if (context.Request.IsWebSocketRequest)
                        {
                            ProcessWebSocketRequest(context);
                        }
                        else
                        {
                            // Handle regular HTTP requests (status check, etc.)
                            HandleHttpRequest(context);
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error handling request: {ex.Message}");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error starting server: {ex.Message}");
            }
        }

        /// <summary>
        /// Initialize the connection to NinjaTrader
        /// </summary>
        private void InitializeNinjaTrader()
        {
            try
            {
                // The DLL should be automatically loaded when we call any function
                
                // Check if we're connected to NinjaTrader
                bool isConnected = NTDirectWrapper.IsConnected();
                
                if (isConnected)
                {
                    _isConnectedToNinjaTrader = true;
                    Console.WriteLine("Successfully connected to NinjaTrader");
                    
                    // Fetch account information
                    RefreshAccountInformation();
                }
                else
                {
                    Console.WriteLine("Not connected to NinjaTrader. Please ensure NinjaTrader is running and ATI is enabled.");
                    _isConnectedToNinjaTrader = false;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error initializing NinjaTrader connection: {ex.Message}");
                _isConnectedToNinjaTrader = false;
            }
        }

        /// <summary>
        /// Connect to NinjaTrader
        /// </summary>
        private void ConnectToNinjaTrader()
        {
            try
            {
                // Check if we're connected to NinjaTrader
                _isConnectedToNinjaTrader = NTDirectWrapper.IsConnected();
                
                if (_isConnectedToNinjaTrader)
                {
                    Console.WriteLine("Successfully connected to NinjaTrader");
                    
                    // Fetch account information
                    RefreshAccountInformation();
                }
                else
                {
                    Console.WriteLine("Failed to connect to NinjaTrader. Please ensure NinjaTrader is running and ATI is enabled.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error connecting to NinjaTrader: {ex.Message}");
                _isConnectedToNinjaTrader = false;
            }
        }

        /// <summary>
        /// Disconnect from NinjaTrader
        /// </summary>
        private void DisconnectFromNinjaTrader()
        {
            try
            {
                // Call TearDown to disconnect from NinjaTrader
                NTDirectWrapper.TearDown();
                
                _isConnectedToNinjaTrader = false;
                _accounts.Clear();
                
                Console.WriteLine("Disconnected from NinjaTrader");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error disconnecting from NinjaTrader: {ex.Message}");
            }
        }

        /// <summary>
        /// Refresh account information from NinjaTrader
        /// </summary>
        private void RefreshAccountInformation()
        {
            try
            {
                if (!_isConnectedToNinjaTrader)
                {
                    // Try to connect
                    _isConnectedToNinjaTrader = NTDirectWrapper.IsConnected();
                    if (!_isConnectedToNinjaTrader) return;
                }

                // Get all account IDs
                string[] accountIds = NTDirectWrapper.GetAccountIds();
                
                if (accountIds.Length == 0)
                {
                    Console.WriteLine("No trading accounts found");
                    return;
                }
                
                // Create a temp collection to store updated accounts
                Dictionary<string, AccountInfo> updatedAccounts = new Dictionary<string, AccountInfo>();
                
                // Process each account
                foreach (var accountId in accountIds)
                {
                    try
                    {
                        // Create account info object
                        var account = new AccountInfo
                        {
                            AccountId = accountId,
                            Name = accountId, // NinjaTrader doesn't provide a name, so use ID
                            ConnectionName = "NinjaTrader",
                            AccountType = GetAccountType(accountId),
                            
                            // Use the documented API functions
                            CashValue = NTDirectWrapper.CashValue(accountId),
                            BuyingPower = NTDirectWrapper.BuyingPower(accountId),
                            RealizedProfitLoss = NTDirectWrapper.RealizedPnL(accountId),
                            
                            // These will be calculated from positions
                            UnrealizedProfitLoss = 0,
                            NetLiquidationValue = 0
                        };

                        // Get positions for this account
                        string[] instruments = NTDirectWrapper.GetPositionInstruments(accountId);
                        
                        double totalUnrealizedPnL = 0;
                        
                        foreach (var instrument in instruments)
                        {
                            try
                            {
                                // Use the documented API functions
                                int quantity = NTDirectWrapper.MarketPosition(instrument, accountId);
                                double avgPrice = NTDirectWrapper.AvgEntryPrice(instrument, accountId);
                                double marketPrice = NTDirectWrapper.GetMarketPrice(instrument);
                                
                                // Calculate unrealized P&L
                                double unrealizedPnL = quantity * (marketPrice - avgPrice);
                                
                                var position = new Position
                                {
                                    Instrument = instrument,
                                    Quantity = quantity,
                                    AveragePrice = avgPrice,
                                    MarketPrice = marketPrice,
                                    UnrealizedPnL = unrealizedPnL
                                };
                                
                                account.Positions.Add(position);
                                
                                totalUnrealizedPnL += unrealizedPnL;
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"Error processing position for {instrument}: {ex.Message}");
                            }
                        }
                        
                        // Update account with calculated values
                        account.UnrealizedProfitLoss = totalUnrealizedPnL;
                        account.NetLiquidationValue = account.CashValue + totalUnrealizedPnL;
                        
                        updatedAccounts[accountId] = account;
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error processing account {accountId}: {ex.Message}");
                    }
                }

                // Only if there are changes, update the accounts collection and broadcast
                bool hasChanges = false;
                
                // Check if accounts have changed
                if (_accounts.Count != updatedAccounts.Count)
                {
                    hasChanges = true;
                }
                else
                {
                    // Check if any account details have changed
                    foreach (var kvp in updatedAccounts)
                    {
                        if (!_accounts.ContainsKey(kvp.Key) || 
                            _accounts[kvp.Key].CashValue != kvp.Value.CashValue ||
                            _accounts[kvp.Key].BuyingPower != kvp.Value.BuyingPower ||
                            _accounts[kvp.Key].RealizedProfitLoss != kvp.Value.RealizedProfitLoss ||
                            _accounts[kvp.Key].UnrealizedProfitLoss != kvp.Value.UnrealizedProfitLoss ||
                            _accounts[kvp.Key].NetLiquidationValue != kvp.Value.NetLiquidationValue ||
                            _accounts[kvp.Key].Positions.Count != kvp.Value.Positions.Count)
                        {
                            hasChanges = true;
                            break;
                        }
                    }
                }
                
                if (hasChanges)
                {
                    // Update the accounts collection with new data
                    _accounts.Clear();
                    foreach (var kvp in updatedAccounts)
                    {
                        _accounts[kvp.Key] = kvp.Value;
                    }
                    
                    // Broadcast updates only if there were changes
                    BroadcastAccountUpdates();
                    Console.WriteLine($"Updated {_accounts.Count} accounts");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error refreshing account information: {ex.Message}");
            }
        }

        /// <summary>
        /// Get account type (Live or Simulation)
        /// </summary>
        private string GetAccountType(string accountId)
        {
            // NinjaTrader doesn't provide a direct way to get account type
            // We make a best guess based on account ID
            
            if (accountId.Contains("Sim") || accountId.Contains("sim") || accountId.Contains("Demo") || accountId.Contains("demo"))
                return "Simulation";
                
            return "Live";
        }

        /// <summary>
        /// Timer callback to update account information
        /// </summary>
        private void UpdateAccountInfo(object state)
        {
            // Only refresh account information if there are clients connected
            lock (_lock)
            {
                if (_clients.Count == 0)
                {
                    Console.WriteLine("No clients connected, skipping account refresh");
                    return;
                }
            }
            
            RefreshAccountInformation();
        }

        /// <summary>
        /// Process WebSocket requests
        /// </summary>
        private async void ProcessWebSocketRequest(HttpListenerContext context)
        {
            WebSocketContext webSocketContext = null;
            
            try
            {
                webSocketContext = await context.AcceptWebSocketAsync(subProtocol: null);
                var socket = webSocketContext.WebSocket;
                
                // Generate a unique client ID
                string clientId = Guid.NewGuid().ToString();
                
                // Add to clients dictionary
                lock (_lock)
                {
                    _clients[clientId] = socket;
                }
                
                Console.WriteLine($"Client connected: {clientId}");
                
                // Send connection status
                await SendConnectionStatus(socket);
                
                // If connected, send account information
                if (_isConnectedToNinjaTrader)
                {
                    await SendAccountList(socket);
                }
                
                // Process messages from this client
                await ReceiveMessages(socket, clientId);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error during WebSocket handshake: {ex.Message}");
                context.Response.StatusCode = 500;
                context.Response.Close();
            }
        }

        /// <summary>
        /// Receive messages from a WebSocket client
        /// </summary>
        private async Task ReceiveMessages(WebSocket socket, string clientId)
        {
            var buffer = new byte[4096];
            
            try
            {
                while (socket.State == WebSocketState.Open)
                {
                    var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                    
                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        await ProcessCommand(message, socket);
                    }
                    else if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Client closed connection", CancellationToken.None);
                        
                        // Remove from clients dictionary
                        lock (_lock)
                        {
                            _clients.Remove(clientId);
                        }
                        
                        Console.WriteLine($"Client disconnected: {clientId}");
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error receiving messages: {ex.Message}");
                
                // Remove from clients dictionary
                lock (_lock)
                {
                    if (_clients.ContainsKey(clientId))
                    {
                        _clients.Remove(clientId);
                    }
                }
            }
        }

        /// <summary>
        /// Process a command from a WebSocket client
        /// </summary>
        private async Task ProcessCommand(string message, WebSocket socket)
        {
            try
            {
                var command = JsonConvert.DeserializeObject<JObject>(message);
                var type = command["type"].ToString();
                
                switch (type)
                {
                    case "connect":
                        ConnectToNinjaTrader();
                        await SendConnectionStatus(socket);
                        if (_isConnectedToNinjaTrader)
                        {
                            await SendAccountList(socket);
                        }
                        break;
                    
                    case "disconnect":
                        DisconnectFromNinjaTrader();
                        await SendConnectionStatus(socket);
                        break;
                    
                    case "getAccounts":
                        if (_isConnectedToNinjaTrader)
                        {
                            await SendAccountList(socket);
                        }
                        else
                        {
                            await SendErrorMessage(socket, "Not connected to NinjaTrader");
                        }
                        break;
                    
                    case "getAccountDetails":
                        if (_isConnectedToNinjaTrader)
                        {
                            string accountId = command["accountId"].ToString();
                            await SendAccountDetails(socket, accountId);
                        }
                        else
                        {
                            await SendErrorMessage(socket, "Not connected to NinjaTrader");
                        }
                        break;
                    
                    default:
                        await SendErrorMessage(socket, $"Unknown command: {type}");
                        break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error processing command: {ex.Message}");
                await SendErrorMessage(socket, $"Error processing command: {ex.Message}");
            }
        }

        /// <summary>
        /// Send connection status to a WebSocket client
        /// </summary>
        private async Task SendConnectionStatus(WebSocket socket)
        {
            var statusMessage = new ConnectionStatusMessage
            {
                Connected = _isConnectedToNinjaTrader
            };
            
            await SendMessageAsync(socket, statusMessage);
        }

        /// <summary>
        /// Send account list to a WebSocket client
        /// </summary>
        private async Task SendAccountList(WebSocket socket)
        {
            var accountList = new AccountListMessage();
            
            accountList.Accounts = _accounts.Values.Select(a => new AccountListItem
            {
                Id = a.AccountId,
                Name = a.Name,
                AccountType = a.AccountType
            }).ToList();
            
            await SendMessageAsync(socket, accountList);
        }

        /// <summary>
        /// Send account details to a WebSocket client
        /// </summary>
        private async Task SendAccountDetails(WebSocket socket, string accountId)
        {
            if (_accounts.TryGetValue(accountId, out var account))
            {
                var accountDetails = new AccountDetailsMessage
                {
                    Account = account
                };
                
                await SendMessageAsync(socket, accountDetails);
            }
            else
            {
                await SendErrorMessage(socket, $"Account {accountId} not found");
            }
        }

        /// <summary>
        /// Send an error message to a WebSocket client
        /// </summary>
        private async Task SendErrorMessage(WebSocket socket, string message)
        {
            var errorMessage = new ErrorMessage
            {
                Message = message
            };
            
            await SendMessageAsync(socket, errorMessage);
        }

        /// <summary>
        /// Send a message to a WebSocket client
        /// </summary>
        private async Task SendMessageAsync(WebSocket socket, object message)
        {
            if (socket.State != WebSocketState.Open)
                return;
                
            try
            {
                var json = JsonConvert.SerializeObject(message);
                Console.WriteLine($"Sending message: {json}");
                var bytes = Encoding.UTF8.GetBytes(json);
                await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error sending message: {ex.Message}");
            }
        }

        /// <summary>
        /// Broadcast account updates to all connected WebSocket clients
        /// </summary>
        private void BroadcastAccountUpdates()
        {
            var message = new AccountsUpdateMessage
            {
                Accounts = _accounts.Values.ToList()
            };
            
            var json = JsonConvert.SerializeObject(message);
            var bytes = Encoding.UTF8.GetBytes(json);
            
            lock (_lock)
            {
                foreach (var socket in _clients.Values)
                {
                    if (socket.State == WebSocketState.Open)
                    {
                        try
                        {
                            socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None)
                                .ContinueWith(t => Console.WriteLine($"Error broadcasting update: {t.Exception?.Message}"), 
                                    TaskContinuationOptions.OnlyOnFaulted);
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"Error broadcasting update: {ex.Message}");
                        }
                    }
                }
            }
        }

        /// <summary>
        /// Handle HTTP requests
        /// </summary>
        private void HandleHttpRequest(HttpListenerContext context)
        {
            var response = context.Response;
            
            // Default response is JSON
            response.ContentType = "application/json";
            response.Headers.Add("Access-Control-Allow-Origin", "*");
            
            if (context.Request.HttpMethod == "GET" && context.Request.Url.AbsolutePath == "/status")
            {
                // Status endpoint
                var statusJson = JsonConvert.SerializeObject(new
                {
                    status = "running",
                    connected = _isConnectedToNinjaTrader,
                    accountCount = _accounts.Count
                });
                
                var buffer = Encoding.UTF8.GetBytes(statusJson);
                response.ContentLength64 = buffer.Length;
                response.OutputStream.Write(buffer, 0, buffer.Length);
            }
            else
            {
                // Not found
                response.StatusCode = 404;
                var notFoundJson = JsonConvert.SerializeObject(new
                {
                    error = "Not found"
                });
                
                var buffer = Encoding.UTF8.GetBytes(notFoundJson);
                response.ContentLength64 = buffer.Length;
                response.OutputStream.Write(buffer, 0, buffer.Length);
            }
            
            response.Close();
        }

        /// <summary>
        /// Stop the bridge server
        /// </summary>
        public void Stop()
        {
            _accountUpdateTimer?.Dispose();
            
            // Close all WebSocket connections
            lock (_lock)
            {
                foreach (var socket in _clients.Values)
                {
                    if (socket.State == WebSocketState.Open)
                    {
                        socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Server shutting down", CancellationToken.None)
                            .ContinueWith(t => Console.WriteLine($"Error closing WebSocket: {t.Exception?.Message}"), 
                                TaskContinuationOptions.OnlyOnFaulted);
                    }
                }
                
                _clients.Clear();
            }
            
            // Disconnect from NinjaTrader
            DisconnectFromNinjaTrader();
            
            // Stop the HTTP listener
            _listener?.Stop();
            _listener = null;
            
            Console.WriteLine("NinjaTrader Bridge stopped");
        }

        /// <summary>
        /// Program entry point
        /// </summary>
        static void Main(string[] args)
        {
            Console.WriteLine("Starting NinjaTrader Bridge...");
            var bridge = new NinjaTraderBridge();
            
            // Set up console handler for clean shutdown
            Console.CancelKeyPress += (sender, e) =>
            {
                Console.WriteLine("Shutting down...");
                bridge.Stop();
                e.Cancel = true;
            };
            
            try
            {
                bridge.StartServer().Wait();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Fatal error: {ex.Message}");
            }
            finally
            {
                bridge.Stop();
            }
        }
    }
} 