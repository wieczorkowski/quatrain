using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using NinjaTrader.Cbi;
using NinjaTrader.Gui;
using NinjaTrader.Gui.Tools;
using NinjaTrader.NinjaScript;
using System.Runtime.Serialization;
using System.Web.Script.Serialization; // Built-in JSON serializer
using System.Reflection;

namespace NinjaTrader.NinjaScript.AddOns
{
    // Helper class to manage WebSocket connection and its send lock
    internal class ClientConnection
    {
        public WebSocket Socket { get; }
        public object SendLock { get; } = new object(); // Lock specific to this client's sends

        public ClientConnection(WebSocket socket)
        {
            Socket = socket;
        }
    }

    public class QuatrainTradeManagerAddOn : AddOnBase
    {
        private readonly object _syncRoot = new object();
        private HttpListener _httpListener;
        // Store ClientConnection objects instead of just WebSockets
        private readonly Dictionary<string, ClientConnection> _clients = new Dictionary<string, ClientConnection>();
        private bool _isRunning;
        private int _port = 8079;
        private MenuItem _menuItem;
        private JavaScriptSerializer _jsonSerializer;
        private bool _debugMode = true; // Set to true to enable debug logging

        // Dictionary to track last update time per account for throttling
        private readonly Dictionary<string, DateTime> _lastAccountUpdateTimes = new Dictionary<string, DateTime>();
        // Reduce throttle interval for testing
        private readonly TimeSpan _updateThrottleInterval = TimeSpan.FromMilliseconds(250); // Throttle interval (e.g., 250ms)

        // Flag to track if we are actively monitoring account events
        private bool _isMonitoringActive = false;

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name = "QuatrainTradeManager"; // Ensure Name is set here
                Description = "Quatrain Trade Manager Add-On for real-time account and position data";
                _jsonSerializer = new JavaScriptSerializer();
            }
            else if (State == State.Active)
            {
                // Start the WebSocket server only
                StartServer();
                
                // Do NOT subscribe to account events here. Wait for first client.
                // Account.AccountStatusUpdate += OnAccountStatusUpdateHandler;
                // lock (Account.All) { ... subscribe logic removed ... }

                // Menu items are removed for now
                try
                {
                    Print("Quatrain AddOn Activated. Server running on port " + _port + ". Waiting for client connection to start monitoring...");
                }
                catch (Exception ex)
                {
                    Print("Error during activation: " + ex.Message);
                }
            }
            else if (State == State.Terminated)
            {
                Print("Quatrain AddOn Terminating...");
                // Stop the WebSocket server (this will also trigger StopMonitoring if needed)
                StopServer();
                
                // Ensure monitoring is stopped if it was active
                if (_isMonitoringActive)
                {
                    StopMonitoring(); 
                }
                
                Print("Quatrain AddOn Terminated.");
            }
        }

        private void StartServer()
        {
            lock (_syncRoot)
            {
                if (_isRunning)
                    return;

                try
                {
                    _httpListener = new HttpListener();
                    _httpListener.Prefixes.Add($"http://localhost:{_port}/");
                    _httpListener.Start();

                    _isRunning = true;

                    // Start the WebSocket server in a separate thread
                    Task.Run(WebSocketServerLoop);

                    Print("Quatrain Trade Manager server started on port " + _port);
                }
                catch (Exception ex)
                {
                    Print("Error starting server: " + ex.Message);
                }
            }
        }

        private void StopServer()
        {
            lock (_syncRoot)
            {
                if (!_isRunning)
                    return;

                try
                {
                    _isRunning = false;

                    // Stop monitoring BEFORE closing listener to prevent race conditions
                    if (_isMonitoringActive)
                    {
                        StopMonitoring();
                    }

                    _clients.Clear();

                    // Stop the HTTP listener
                    if (_httpListener != null)
                    {
                        _httpListener.Stop();
                        _httpListener = null;
                    }

                    Print("Quatrain Trade Manager server stopped");
                }
                catch (Exception ex)
                {
                    Print("Error stopping server: " + ex.Message);
                }
            }
        }

        private async Task WebSocketServerLoop()
        {
            while (_isRunning)
            {
                try
                {
                    var context = await _httpListener.GetContextAsync();

                    if (context.Request.IsWebSocketRequest)
                    {
                        ProcessWebSocketRequest(context);
                    }
                    else
                    {
                        // Handle regular HTTP requests
                        HandleHttpRequest(context);
                    }
                }
                catch (Exception ex)
                {
                    if (_isRunning)
                        Print("Error in WebSocket server loop: " + ex.Message);
                }
            }
        }

        private async void ProcessWebSocketRequest(HttpListenerContext context)
        {
            try
            {
                var webSocketContext = await context.AcceptWebSocketAsync(subProtocol: null);
                var socket = webSocketContext.WebSocket;

                // Generate a unique client ID
                string clientId = Guid.NewGuid().ToString();
                ClientConnection clientConnection = new ClientConnection(socket);

                lock (_syncRoot)
                {
                     _clients[clientId] = clientConnection;
                    // If this is the first client, start monitoring
                    if (_clients.Count == 1 && !_isMonitoringActive)
                    {
                        StartMonitoring();
                    }
                }

                Print("Client connected: " + clientId + ". Total clients: " + _clients.Count); // Log count

                // Send initial connection status and account information AFTER adding client
                await SendConnectionStatus(clientId);
                await SendAllAccountInformation(clientId); // Pass clientId

                // Process messages from this client
                await ReceiveMessages(socket, clientId); // Pass original socket here is fine, Receive uses ID to find connection
            }
            catch (Exception ex)
            {
                Print("Error during WebSocket handshake: " + ex.Message);
                context.Response.StatusCode = 500;
                context.Response.Close();
            }
        }

        private async Task ReceiveMessages(WebSocket socket, string clientId)
        {
            var buffer = new byte[4096];

            try
            {
                // Use the client's specific socket
                ClientConnection clientConnection;
                lock(_syncRoot)
                {
                    // It's possible the client was removed between checks, handle this
                    if (!_clients.TryGetValue(clientId, out clientConnection))
                        return; // Exit loop if client is gone
                }

                while (clientConnection.Socket.State == WebSocketState.Open && _isRunning)
                {
                    var result = await clientConnection.Socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);

                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        await ProcessCommand(message, clientConnection.Socket, clientId);
                    }
                    else if (result.MessageType == WebSocketMessageType.Close)
                    {
                        // Attempt to close gracefully
                        try { await clientConnection.Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Client closed connection", CancellationToken.None); } catch { }

                        lock (_syncRoot)
                        {
                            _clients.Remove(clientId);
                            Print($"Client disconnected: {clientId}. Remaining clients: {_clients.Count}");
                            // If this was the last client, stop monitoring
                            if (_clients.Count == 0 && _isMonitoringActive)
                            {
                                StopMonitoring();
                            }
                        }
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                Print("Error receiving messages from client " + clientId + ": " + ex.Message);

                lock (_syncRoot)
                {
                    // Ensure client is removed on error too
                    if (_clients.ContainsKey(clientId))
                        _clients.Remove(clientId);
                    Print($"Client removed due to error: {clientId}. Remaining clients: {_clients.Count}");
                     // If this was the last client, stop monitoring
                    if (_clients.Count == 0 && _isMonitoringActive)
                    {
                        StopMonitoring();
                    }
                }
            }
        }

        private async Task ProcessCommand(string message, WebSocket socket, string clientId)
        {
            try
            {
                // Print($"Raw command received by {clientId}: {message}"); // Commented out
                var command = _jsonSerializer.Deserialize<Dictionary<string, object>>(message);
                string type = command["type"] as string;
                // Print($"Processing command type: {type} for client: {clientId}"); // Commented out

                switch (type)
                {
                    case "connect":
                        // Already handled in ProcessWebSocketRequest
                        break;

                    case "getAccounts":
                         await SendAllAccountInformation(clientId); // Pass clientId
                        break;

                    case "getAccountDetails":
                        // Check if accountId key exists before accessing
                        if (command.ContainsKey("accountId") && command["accountId"] is string accountIdToFetch)
                        {
                            Print($"Received request for account details: {accountIdToFetch} from {clientId}");
                            await SendAccountDetails(clientId, accountIdToFetch); // Pass clientId
                        }
                        else
                        {
                            Print($"Error: 'getAccountDetails' command received without a valid 'accountId'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing accountId."); // Pass clientId
                        }
                        break;

                    case "getInstrumentProperties":
                        // Check if symbol key exists before accessing
                        if (command.ContainsKey("symbol") && command["symbol"] is string symbol)
                        {
                            // Print($"Received request for instrument properties: {symbol} from {clientId}"); // Commented out for less verbosity
                            await SendInstrumentProperties(clientId, symbol); // Pass clientId
                        }
                        else
                        {
                            Print($"Error: 'getInstrumentProperties' command received without a valid 'symbol'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing symbol."); // Pass clientId
                        }
                        break;

                    case "flattenPosition":
                        // Flatten a specific position for a given account and instrument
                        if (command.ContainsKey("accountId") && command["accountId"] is string flattenAccountId &&
                            command.ContainsKey("instrumentSymbol") && command["instrumentSymbol"] is string flattenInstrumentSymbol)
                        {
                            Print($"Received flatten request for Account: {flattenAccountId}, Instrument: {flattenInstrumentSymbol} from {clientId}");
                            await HandleFlattenPosition(clientId, flattenAccountId, flattenInstrumentSymbol); // Pass clientId
                        }
                        else
                        {
                            Print($"Error: 'flattenPosition' command received with missing 'accountId' or 'instrumentSymbol'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing accountId or instrumentSymbol."); // Pass clientId
                        }
                        break;
                    
                    case "cancel_all_orders":
                        // Cancel all orders for a specific account and instrument
                        if (command.ContainsKey("accountId") && command["accountId"] is string cancelOrdersAccountId &&
                            command.ContainsKey("instrumentSymbol") && command["instrumentSymbol"] is string cancelOrdersInstrumentSymbol)
                        {
                            Print($"Received cancel all orders request for Account: {cancelOrdersAccountId}, Instrument: {cancelOrdersInstrumentSymbol} from {clientId}");
                            await HandleCancelAllOrders(clientId, cancelOrdersAccountId, cancelOrdersInstrumentSymbol); // Pass clientId
                        }
                        else
                        {
                            Print($"Error: 'cancel_all_orders' command received with missing 'accountId' or 'instrumentSymbol'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing accountId or instrumentSymbol for cancel_all_orders."); // Pass clientId
                        }
                        break;
                    
                    case "place_order":
                        // Validate required parameters individually
                        string orderAccountId, orderSymbol, orderAction, orderType;
                        int orderQuantity;
                        double? orderLimitPrice = null; // Nullable double for optional limit price
                        double? orderStopPrice = null; // Nullable double for optional stop price

                        if (!command.ContainsKey("accountId") || !(command["accountId"] is string accountIdVal) || string.IsNullOrEmpty(accountIdVal))
                        {
                            Print($"Error: 'place_order' command missing or invalid 'accountId'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing or invalid 'accountId' for place_order."); // Pass clientId
                            break;
                        }
                        orderAccountId = accountIdVal;

                        if (!command.ContainsKey("symbol") || !(command["symbol"] is string symbolVal) || string.IsNullOrEmpty(symbolVal))
                        {
                            Print($"Error: 'place_order' command missing or invalid 'symbol'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing or invalid 'symbol' for place_order."); // Pass clientId
                            break;
                        }
                        orderSymbol = symbolVal;

                        if (!command.ContainsKey("action") || !(command["action"] is string actionVal) || string.IsNullOrEmpty(actionVal))
                        {
                            Print($"Error: 'place_order' command missing or invalid 'action'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing or invalid 'action' for place_order."); // Pass clientId
                            break;
                        }
                        orderAction = actionVal;

                        if (!command.ContainsKey("orderType") || !(command["orderType"] is string typeVal) || string.IsNullOrEmpty(typeVal))
                        {
                            Print($"Error: 'place_order' command missing or invalid 'orderType'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing or invalid 'orderType' for place_order."); // Pass clientId
                            break;
                        }
                        orderType = typeVal.ToUpper(); // Ensure uppercase for comparison

                        // Check for Limit Price if order type requires it (LIMIT, MIT, LIMITSTOP)
                        if (orderType == "LIMIT" || orderType == "MIT" || orderType == "LIMITSTOP")
                        {
                            if (!command.TryGetValue("limitPrice", out object limitPriceObj))
                            {
                                Print($"Error: 'place_order' command of type {orderType} missing 'limitPrice'. Message: {message} from {clientId}");
                                await SendErrorMessage(clientId, $"Invalid command format: missing 'limitPrice' for {orderType} order.");
                                break;
                            }
                            try
                            {
                                orderLimitPrice = Convert.ToDouble(limitPriceObj);
                                if (orderLimitPrice <= 0) throw new FormatException("Limit price must be positive.");
                            }
                            catch (Exception ex)
                            {
                                Print($"Error: 'place_order' command invalid 'limitPrice'. Value: {limitPriceObj}, Error: {ex.Message}. Message: {message} from {clientId}");
                                await SendErrorMessage(clientId, $"Invalid command format: invalid 'limitPrice' ({limitPriceObj}) for {orderType} order. Must be a positive number.");
                                break;
                            }
                        }

                        // Check for Stop Price if order type requires it (LIMITSTOP, MARKETSTOP)
                        if (orderType == "LIMITSTOP" || orderType == "MARKETSTOP")
                        {
                            if (!command.TryGetValue("stopPrice", out object stopPriceObj))
                            {
                                Print($"Error: 'place_order' command of type {orderType} missing 'stopPrice'. Message: {message} from {clientId}");
                                await SendErrorMessage(clientId, $"Invalid command format: missing 'stopPrice' for {orderType} order.");
                                break;
                            }
                            try
                            {
                                orderStopPrice = Convert.ToDouble(stopPriceObj);
                                if (orderStopPrice <= 0) throw new FormatException("Stop price must be positive.");
                            }
                            catch (Exception ex)
                            {
                                Print($"Error: 'place_order' command invalid 'stopPrice'. Value: {stopPriceObj}, Error: {ex.Message}. Message: {message} from {clientId}");
                                await SendErrorMessage(clientId, $"Invalid command format: invalid 'stopPrice' ({stopPriceObj}) for {orderType} order. Must be a positive number.");
                                break;
                            }
                        }

                        // Handle potential type mismatch for quantity (e.g., double instead of int)
                        object quantityObj;
                        if (!command.TryGetValue("quantity", out quantityObj))
                        {
                            Print($"Error: 'place_order' command missing 'quantity'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing 'quantity' for place_order."); // Pass clientId
                            break;
                        }
                        try
                        {
                            orderQuantity = Convert.ToInt32(quantityObj); // Try converting in case it's not exactly int
                            if (orderQuantity <= 0) throw new FormatException("Quantity must be positive.");
                        }
                        catch (Exception ex)
                        {
                            Print($"Error: 'place_order' command invalid 'quantity'. Value: {quantityObj}, Error: {ex.Message}. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, $"Invalid command format: invalid 'quantity' ({quantityObj}) for place_order. Must be a positive integer."); // Pass clientId
                            break;
                        }
                        
                        // If all checks pass, proceed
                        Print($"Received place order request: Account={orderAccountId}, Symbol={orderSymbol}, Action={orderAction}, Type={orderType}, Quantity={orderQuantity}, Limit={orderLimitPrice}, Stop={orderStopPrice} from {clientId}"); // Added limit/stop to log
                        await HandlePlaceOrder(clientId, orderAccountId, orderSymbol, orderAction, orderType, orderQuantity, orderLimitPrice, orderStopPrice); // Pass clientId, limit price, and stop price
                        break;

                    case "getOrders":
                        if (command.ContainsKey("accountId") && command["accountId"] is string requestedAccountId)
                        {
                            Print($"Received request for orders: Account={requestedAccountId} from {clientId}");
                            await SendAllOrdersForAccount(clientId, requestedAccountId);
                        }
                        else
                        {
                            Print($"Error: 'getOrders' command received without a valid 'accountId'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing accountId for getOrders.");
                        }
                        break;

                    case "cancel_order":
                        string cancelAccountId, cancelOrderId;

                        if (!command.ContainsKey("accountId") || !(command["accountId"] is string accIdVal) || string.IsNullOrEmpty(accIdVal))
                        {
                            Print($"Error: 'cancel_order' command missing or invalid 'accountId'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing or invalid 'accountId' for cancel_order.");
                            break;
                        }
                        cancelAccountId = accIdVal;

                        if (!command.ContainsKey("orderId") || !(command["orderId"] is string ordIdVal) || string.IsNullOrEmpty(ordIdVal))
                        {
                            Print($"Error: 'cancel_order' command missing or invalid 'orderId'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing or invalid 'orderId' for cancel_order.");
                            break;
                        }
                        cancelOrderId = ordIdVal;

                        Print($"Received cancel order request: Account={cancelAccountId}, OrderId={cancelOrderId} from {clientId}");
                        await HandleCancelOrder(clientId, cancelAccountId, cancelOrderId);
                        break;

                    case "modify_order":
                        string modifyAccountId, modifyOrderId;
                        int modifyQuantity;
                        double? modifyLimitPrice = null;
                        double? modifyStopPrice = null;

                        // Validate account ID
                        if (!command.ContainsKey("accountId") || !(command["accountId"] is string modAccIdVal) || string.IsNullOrEmpty(modAccIdVal))
                        {
                            Print($"Error: 'modify_order' command missing or invalid 'accountId'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing or invalid 'accountId' for modify_order.");
                            break;
                        }
                        modifyAccountId = modAccIdVal;

                        // Validate order ID
                        if (!command.ContainsKey("orderId") || !(command["orderId"] is string modOrdIdVal) || string.IsNullOrEmpty(modOrdIdVal))
                        {
                            Print($"Error: 'modify_order' command missing or invalid 'orderId'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing or invalid 'orderId' for modify_order.");
                            break;
                        }
                        modifyOrderId = modOrdIdVal;

                        // Handle quantity
                        if (command.TryGetValue("quantity", out object modQuantityObj))
                        {
                            try
                            {
                                modifyQuantity = Convert.ToInt32(modQuantityObj);
                                if (modifyQuantity <= 0) throw new FormatException("Quantity must be positive.");
                            }
                            catch (Exception ex)
                            {
                                Print($"Error: 'modify_order' command invalid 'quantity'. Value: {modQuantityObj}, Error: {ex.Message}. Message: {message} from {clientId}");
                                await SendErrorMessage(clientId, $"Invalid command format: invalid 'quantity' ({modQuantityObj}) for modify_order. Must be a positive integer.");
                                break;
                            }
                        }
                        else
                        {
                            Print($"Error: 'modify_order' command missing 'quantity'. Message: {message} from {clientId}");
                            await SendErrorMessage(clientId, "Invalid command format: missing 'quantity' for modify_order.");
                            break;
                        }

                        // Handle limit price (optional, depends on order type)
                        if (command.TryGetValue("limitPrice", out object modLimitPriceObj) && modLimitPriceObj != null)
                        {
                            try
                            {
                                modifyLimitPrice = Convert.ToDouble(modLimitPriceObj);
                                if (modifyLimitPrice <= 0) throw new FormatException("Limit price must be positive.");
                            }
                            catch (Exception ex)
                            {
                                Print($"Error: 'modify_order' command invalid 'limitPrice'. Value: {modLimitPriceObj}, Error: {ex.Message}. Message: {message} from {clientId}");
                                await SendErrorMessage(clientId, $"Invalid command format: invalid 'limitPrice' ({modLimitPriceObj}) for modify_order. Must be a positive number.");
                                break;
                            }
                        }

                        // Handle stop price (optional, depends on order type)
                        if (command.TryGetValue("stopPrice", out object modStopPriceObj) && modStopPriceObj != null)
                        {
                            try
                            {
                                modifyStopPrice = Convert.ToDouble(modStopPriceObj);
                                if (modifyStopPrice <= 0) throw new FormatException("Stop price must be positive.");
                            }
                            catch (Exception ex)
                            {
                                Print($"Error: 'modify_order' command invalid 'stopPrice'. Value: {modStopPriceObj}, Error: {ex.Message}. Message: {message} from {clientId}");
                                await SendErrorMessage(clientId, $"Invalid command format: invalid 'stopPrice' ({modStopPriceObj}) for modify_order. Must be a positive number.");
                                break;
                            }
                        }

                        Print($"Received modify order request: Account={modifyAccountId}, OrderId={modifyOrderId}, Quantity={modifyQuantity}, LimitPrice={modifyLimitPrice}, StopPrice={modifyStopPrice} from {clientId}");
                        await HandleModifyOrder(clientId, modifyAccountId, modifyOrderId, modifyQuantity, modifyLimitPrice, modifyStopPrice);
                        break;

                    default:
                        await SendErrorMessage(clientId, "Unknown command: " + type); // Pass clientId
                        break;
                }
            }
            catch (Exception ex)
            {
                Print($"Error processing command for client {clientId}: {ex.Message}");
                await SendErrorMessage(clientId, "Error processing command: " + ex.Message); // Pass clientId
            }
        }

        private void HandleHttpRequest(HttpListenerContext context)
        {
            var response = context.Response;

            // Default response is JSON
            response.ContentType = "application/json";
            response.Headers.Add("Access-Control-Allow-Origin", "*");

            if (context.Request.HttpMethod == "GET" && context.Request.Url.AbsolutePath == "/status")
            {
                // Status endpoint
                var statusJson = _jsonSerializer.Serialize(new
                {
                    status = "running",
                    connected = true,
                    accountCount = GetActiveAccounts().Count()
                });

                var buffer = Encoding.UTF8.GetBytes(statusJson);
                response.ContentLength64 = buffer.Length;
                response.OutputStream.Write(buffer, 0, buffer.Length);
            }
            else
            {
                // Not found
                response.StatusCode = 404;
                var notFoundJson = _jsonSerializer.Serialize(new
                {
                    error = "Not found"
                });

                var buffer = Encoding.UTF8.GetBytes(notFoundJson);
                response.ContentLength64 = buffer.Length;
                response.OutputStream.Write(buffer, 0, buffer.Length);
            }

            response.Close();
        }

        private void BroadcastToAllClients(object message)
        {
            // Serialize once before the loop
            var json = _jsonSerializer.Serialize(message);
            var bytes = Encoding.UTF8.GetBytes(json); 

            List<string> clientsToRemove = new List<string>();
            Dictionary<string, ClientConnection> currentClientsSnapshot; // Use Dictionary to keep clientId easily

            lock (_syncRoot)
            {
                currentClientsSnapshot = new Dictionary<string, ClientConnection>(_clients); // Get a snapshot
            }

            // Run the broadcast logic in a background task to avoid blocking the caller
            Task.Run(async () => 
            {
                // Iterate sequentially through the snapshot
                foreach (var kvp in currentClientsSnapshot)
                {
                    string clientId = kvp.Key;
                    ClientConnection clientConnection = kvp.Value;

                    // Double-check if client still exists in the main dictionary (might have been removed)
                    bool stillExists;
                    lock (_syncRoot) { stillExists = _clients.ContainsKey(clientId); }
                    if (!stillExists) continue;

                    try
                    {
                        // Await the SendMessageAsync call directly.
                        // Pass the pre-serialized message for efficiency.
                        await SendMessageAsync(clientId, bytes); 
                    }
                    catch (Exception ex) // Catch potential exceptions from SendMessageAsync itself
                    {
                        // SendMessageAsync should handle its own errors and client removal, 
                        // but we log here just in case something unexpected bubbles up.
                        Print($"Error during broadcast loop for client {clientId}: {ex.Message}");
                        // Optionally mark for removal again, though SendMessageAsync might have already done it
                         lock(_syncRoot) 
                         {
                             if (!_clients.ContainsKey(clientId))
                                 clientsToRemove.Add(clientId); // Use the list defined outside
                         } 
                    }
                }

                // Clean up clients marked for removal (if any)
                if (clientsToRemove.Count > 0)
                {
                     lock (_syncRoot)
                     {
                         foreach (var clientIdToRemove in clientsToRemove)
                         {
                             if (_clients.ContainsKey(clientIdToRemove))
                             {
                                 _clients.Remove(clientIdToRemove);
                                 Print("Removed client " + clientIdToRemove + " due to broadcast error (post-loop cleanup).");
                                 if (_clients.Count == 0 && _isMonitoringActive)
                                 {
                                     StopMonitoring();
                                 }
                             }
                         }
                     }
                 }
            });
        }

        // Modified SendMessageAsync to accept clientId and use the client-specific lock
        // Overload to accept pre-serialized bytes for broadcasting efficiency
        private async Task SendMessageAsync(string clientId, byte[] messageBytes)
        {
             ClientConnection clientConnection;
            lock (_syncRoot)
            {
                if (!_clients.TryGetValue(clientId, out clientConnection)) return; 
            }

            if (clientConnection.Socket.State != WebSocketState.Open) return; 

            bool lockTaken = false;
            try
            {
                Monitor.TryEnter(clientConnection.SendLock, TimeSpan.FromSeconds(5), ref lockTaken);
                if (lockTaken)
                {
                    await clientConnection.Socket.SendAsync(new ArraySegment<byte>(messageBytes), WebSocketMessageType.Text, true, CancellationToken.None);
                }
                else
                {
                    Print($"SendMessageAsync: Could not acquire send lock for client {clientId} within timeout.");
                    // Consider removing the client here if lock timeout persists
                    RemoveClient(clientId, "Lock timeout");
                }
            }
            catch (Exception ex)
            {
                Print($"Error sending message to client {clientId}: {ex.Message}");
                RemoveClient(clientId, "Send error");
            }
            finally
            {
                if (lockTaken) Monitor.Exit(clientConnection.SendLock); // Corrected: Release the lock
            }
        }

        // Original SendMessageAsync accepting an object
        private async Task SendMessageAsync(string clientId, object message)
        {
            ClientConnection clientConnection;
            lock (_syncRoot)
            {
                if (!_clients.TryGetValue(clientId, out clientConnection)) return; 
            }
            
            if (clientConnection.Socket.State != WebSocketState.Open) return;

            byte[] bytes;
            try
            {
                 // Serialize the object to JSON bytes
                var json = _jsonSerializer.Serialize(message);
                bytes = Encoding.UTF8.GetBytes(json);
            }
            catch (Exception ex)
            {
                 Print($"SendMessageAsync: Error serializing message for client {clientId}: {ex.Message}");
                 return; // Cannot send if serialization fails
            }
            
            // Call the byte array overload to handle locking and sending
            await SendMessageAsync(clientId, bytes);
        }

        // Helper function to centralize client removal logic
        private void RemoveClient(string clientId, string reason)
        {
            lock (_syncRoot)
            {
                if (_clients.ContainsKey(clientId))
                {
                    // Attempt to close socket gracefully before removing
                    try { _clients[clientId].Socket.CloseAsync(WebSocketCloseStatus.InternalServerError, reason, CancellationToken.None).Wait(TimeSpan.FromSeconds(1)); } catch {} 

                    _clients.Remove(clientId);
                    Print($"Removed client {clientId} due to {reason}.");
                    if (_clients.Count == 0 && _isMonitoringActive)
                    {
                        StopMonitoring();
                    }
                }
            }
        }

        // Helper method needs clientId
        private async Task SendConnectionStatus(string clientId) 
        {
            var statusMessage = new Dictionary<string, object>
            {
                { "type", "connectionStatus" },
                { "connected", true }
            };
            await SendMessageAsync(clientId, statusMessage);
        }
        
        private async Task SendAllAccountInformation(string clientId) // Added clientId
        {
            // Send the *simplified* account list, consistent with BroadcastActiveAccountList
            var accounts = new List<object>();
            foreach (Account acc in GetActiveAccounts())
            {
                accounts.Add(new Dictionary<string, object> 
                {
                    { "id", acc.Name }, // Use Name as ID
                    { "name", acc.Name },
                    { "accountId", acc.Name }, // Explicitly include accountId
                    { "accountType", acc.Denomination.ToString() }
                    // No need to send full details here initially
                });
            }

            var message = new Dictionary<string, object>
            {
                { "type", "accountList" },
                { "accounts", accounts }
            };

            Print($"Sending initial simplified account list to {clientId}."); // Add log
            await SendMessageAsync(clientId, message); // Use clientId
        }

        private async Task SendAccountDetails(string clientId, string accountIdToFetch) // Added clientId
        {
            var account = GetActiveAccounts().FirstOrDefault(a => a.Name == accountIdToFetch);

            if (account != null)
            {
                // Debug account info
                if (_debugMode)
                {
                    DebugAccountProperties(account);
                }
                
                var accountInfo = GetAccountInfo(account);
                var message = new Dictionary<string, object>
                {
                    { "type", "accountDetails" },
                    { "account", accountInfo }
                };

                await SendMessageAsync(clientId, message); // Use clientId
            }
            else
            {
                await SendErrorMessage(clientId, "Account " + accountIdToFetch + " not found or not active"); // Use clientId
            }
        }

        private async Task SendErrorMessage(string clientId, string message) // Added clientId
        {
            var errorMessage = new Dictionary<string, object>
            {
                { "type", "error" },
                { "message", message }
            };

            await SendMessageAsync(clientId, errorMessage); // Use clientId
        }

        private async Task SendInstrumentProperties(string clientId, string symbolName) // Added clientId
        {
            try
            {
                // Get the instrument from NinjaTrader
                var instrument = Cbi.Instrument.GetInstrument(symbolName);
                
                if (instrument != null && instrument.MasterInstrument != null)
                {
                    // Print($"Found instrument: {symbolName}, Point Value: {instrument.MasterInstrument.PointValue}, Tick Size: {instrument.MasterInstrument.TickSize}"); // Commented out
                    
                    // Create the properties object
                    var properties = new Dictionary<string, object>
                    {
                        { "pointValue", instrument.MasterInstrument.PointValue },
                        { "tickSize", instrument.MasterInstrument.TickSize },
                        { "name", instrument.FullName }
                    };
                    
                    // Create the response message
                    var message = new Dictionary<string, object>
                    {
                        { "type", "instrumentProperties" },
                        { "properties", properties }
                    };
                    
                    // Send the properties
                    await SendMessageAsync(clientId, message); // Use clientId
                }
                else
                {
                    // Print($"Instrument not found: {symbolName}"); // Commented out
                    await SendErrorMessage(clientId, $"Instrument not found: {symbolName}"); // Use clientId
                }
            }
            catch (Exception ex)
            {
                Print($"Error retrieving instrument properties for {symbolName}: {ex.Message}");
                await SendErrorMessage(clientId, $"Error retrieving instrument properties: {ex.Message}"); // Use clientId
            }
        }

        private async Task HandleFlattenPosition(string clientId, string accountId, string instrumentSymbol) // Added clientId
        {
            try
            {
                // Find the account
                var account = GetActiveAccounts().FirstOrDefault(a => a.Name == accountId);
                if (account == null)
                {
                    Print($"Flatten error: Account '{accountId}' not found or not active.");
                    await SendErrorMessage(clientId, $"Account '{accountId}' not found or not active."); // Use clientId
                    return;
                }

                // Find the instrument
                var instrument = Cbi.Instrument.GetInstrument(instrumentSymbol);
                if (instrument == null)
                {
                    Print($"Flatten error: Instrument '{instrumentSymbol}' not found.");
                    await SendErrorMessage(clientId, $"Instrument '{instrumentSymbol}' not found."); // Use clientId
                    return;
                }

                // Execute CancelAllOrders for the single instrument
                Print($"Executing CancelAllOrders for Account: {accountId}, Instrument: {instrumentSymbol}");
                account.CancelAllOrders(instrument);

                // Execute Flatten for a collection containing the single instrument (using array syntax from docs)
                Print($"Executing Flatten for Account: {accountId}, Instrument: {instrumentSymbol}");
                account.Flatten(new[] { instrument });

                // Optionally, send a success message back (or rely on account updates)
                var successMessage = new Dictionary<string, object> { { "type", "flattenSuccess" }, { "accountId", accountId }, { "instrument", instrumentSymbol } };
                await SendMessageAsync(clientId, successMessage); // Use clientId
                Print($"Flatten command executed successfully for Account: {accountId}, Instrument: {instrumentSymbol}");

                // The position update should come through the regular OnAccountItemUpdateHandler shortly after
            }
            catch (Exception ex)
            {
                Print($"Error during flatten position for Account: {accountId}, Instrument: {instrumentSymbol}: {ex.Message}");
                await SendErrorMessage(clientId, $"Error flattening position for {instrumentSymbol}: {ex.Message}"); // Use clientId
            }
        }

        private async Task HandleCancelAllOrders(string clientId, string accountId, string instrumentSymbol)
        {
            try
            {
                // Find the account
                var account = GetActiveAccounts().FirstOrDefault(a => a.Name == accountId);
                if (account == null)
                {
                    Print($"Cancel All Orders error: Account '{accountId}' not found or not active.");
                    await SendErrorMessage(clientId, $"Account '{accountId}' not found or not active."); // Use clientId
                    return;
                }

                // Find the instrument
                var instrument = Cbi.Instrument.GetInstrument(instrumentSymbol);
                if (instrument == null)
                {
                    Print($"Cancel All Orders error: Instrument '{instrumentSymbol}' not found.");
                    await SendErrorMessage(clientId, $"Instrument '{instrumentSymbol}' not found."); // Use clientId
                    return;
                }

                // Execute CancelAllOrders for the single instrument
                Print($"Executing CancelAllOrders for Account: {accountId}, Instrument: {instrumentSymbol}");
                account.CancelAllOrders(instrument);

                // Send success message
                var successMessage = new Dictionary<string, object> { { "type", "cancelAllOrdersSuccess" }, { "accountId", accountId }, { "instrument", instrumentSymbol } };
                await SendMessageAsync(clientId, successMessage); // Use clientId
                Print($"Cancel All Orders command executed successfully for Account: {accountId}, Instrument: {instrumentSymbol}");

                // Order updates will come through the regular OnOrderUpdateHandler shortly after
            }
            catch (Exception ex)
            {
                Print($"Error during cancel all orders for Account: {accountId}, Instrument: {instrumentSymbol}: {ex.Message}");
                await SendErrorMessage(clientId, $"Error cancelling orders for {instrumentSymbol}: {ex.Message}"); // Use clientId
            }
        }

        private async Task HandlePlaceOrder(string clientId, string accountId, string instrumentSymbol, string action, string orderTypeString, int quantity, double? limitPrice, double? stopPrice) // Added stopPrice parameter
        {
            try
            {
                // 1. Find the account
                var account = GetActiveAccounts().FirstOrDefault(a => a.Name == accountId);
                if (account == null)
                {
                    Print($"Place Order error: Account '{accountId}' not found or not active.");
                    await SendErrorMessage(clientId, $"Account '{accountId}' not found or not active."); // Use clientId
                    return;
                }

                // 2. Find the instrument
                var instrument = Cbi.Instrument.GetInstrument(instrumentSymbol);
                if (instrument == null)
                {
                    Print($"Place Order error: Instrument '{instrumentSymbol}' not found.");
                    await SendErrorMessage(clientId, $"Instrument '{instrumentSymbol}' not found."); // Use clientId
                    return;
                }

                // 3. Determine NinjaTrader Order Type
                NinjaTrader.Cbi.OrderType ntOrderType;
                switch (orderTypeString.ToUpper()) // Ensure comparison is case-insensitive
                {
                    case "MARKET":
                        ntOrderType = OrderType.Market;
                        break;
                    case "LIMIT":
                        ntOrderType = OrderType.Limit;
                        if (limitPrice == null || limitPrice <= 0) // Validate limit price for Limit order
                        {
                            Print($"Place Order error: Invalid or missing limit price for LIMIT order: {limitPrice}");
                            await SendErrorMessage(clientId, "Invalid or missing limit price for LIMIT order.");
                            return;
                        }
                        break;
                    case "MIT":
                        ntOrderType = OrderType.MIT; // Corrected enum name
                        if (limitPrice == null || limitPrice <= 0) // Validate limit price for MIT order
                        {
                            Print($"Place Order error: Invalid or missing limit price for MIT order: {limitPrice}");
                            await SendErrorMessage(clientId, "Invalid or missing limit price for MIT order.");
                            return;
                        }
                        break;
                    case "LIMITSTOP": // Handle Stop Limit type from UI
                        ntOrderType = OrderType.StopLimit;
                        if (stopPrice == null || stopPrice <= 0) // Validate stop price for StopLimit
                        {
                            Print($"Place Order error: Invalid or missing stop price for LIMITSTOP order: {stopPrice}");
                            await SendErrorMessage(clientId, "Invalid or missing stop price for LIMITSTOP order.");
                            return;
                        }
                        if (limitPrice == null || limitPrice <= 0) // Validate limit price for StopLimit (sent from UI)
                        {
                            Print($"Place Order error: Invalid or missing limit price for LIMITSTOP order: {limitPrice}");
                            await SendErrorMessage(clientId, "Invalid or missing limit price for LIMITSTOP order.");
                            return;
                        }
                        break;
                    case "MARKETSTOP": // Handle Stop Market type from UI
                        ntOrderType = OrderType.StopMarket;
                        if (stopPrice == null || stopPrice <= 0) // Validate stop price for StopMarket
                        {
                            Print($"Place Order error: Invalid or missing stop price for MARKETSTOP order: {stopPrice}");
                            await SendErrorMessage(clientId, "Invalid or missing stop price for MARKETSTOP order.");
                            return;
                        }
                        // No limit price needed for StopMarket
                        break;
                    default:
                        Print($"Place Order error: Unsupported order type '{orderTypeString}'.");
                        await SendErrorMessage(clientId, $"Unsupported order type '{orderTypeString}'.");
                        return;
                }

                // 4. Validate Quantity
                if (quantity <= 0)
                {
                    Print($"Place Order error: Invalid quantity '{quantity}'. Must be positive.");
                    await SendErrorMessage(clientId, $"Invalid quantity '{quantity}'. Must be positive."); // Use clientId
                    return;
                }

                // 5. Prepare parameters for CreateOrder
                string orderSignalName = "QuatrainOrder_" + Guid.NewGuid().ToString().Substring(0, 8); // Unique identifier

                NinjaTrader.Cbi.OrderAction orderAction;
                if (action.ToUpper() == "BUY")
                {
                    orderAction = NinjaTrader.Cbi.OrderAction.Buy;
                }
                else if (action.ToUpper() == "SELL")
                {
                    // Note: SELL action initiates a Sell Short order.
                    // Use FlattenPosition command to close an existing long position.
                    orderAction = NinjaTrader.Cbi.OrderAction.Sell;
                }
                else
                {
                    Print($"Place Order error: Invalid action '{action}'. Must be BUY or SELL."); // Corrected variable name
                    await SendErrorMessage(clientId, $"Invalid action '{action}'. Must be BUY or SELL."); // Use clientId
                    return;
                }

                // Parameters for CreateOrder
                double createLimitPrice = limitPrice ?? 0;
                double createStopPrice = stopPrice ?? 0;
                OrderEntry createOrderEntry = OrderEntry.Manual; // Assume manual entry from external interface
                TimeInForce createTif = TimeInForce.Day; // Default to Day
                string createOco = ""; // No OCO linking for now
                DateTime createGtd = Core.Globals.MaxDate; // Default for non-GTD orders

                // Variable to hold the order object
                Order order = null;

                // Try using Application.Current.Dispatcher
                await Application.Current.Dispatcher.InvokeAsync(() =>
                {
                    try
                    {
                        // 1. Create the order using Account.CreateOrder
                        Print($"Calling CreateOrder: Account={account.Name}, Instrument={instrument.FullName}, Action={orderAction}, Type={ntOrderType}, Qty={quantity}, Limit={createLimitPrice}, Stop={createStopPrice}, Name={orderSignalName}");
                        order = account.CreateOrder(
                            instrument,
                            orderAction,
                            ntOrderType,
                            createOrderEntry,
                            createTif,
                            quantity,
                            createLimitPrice,
                            createStopPrice,
                            createOco,
                            orderSignalName,
                            createGtd,
                            null // customOrder (null for now)
                        );

                        if (order != null)
                        {
                            Print($"CreateOrder successful. Submitting order: Name={order.Name}");
                            // 2. Submit the created order
                            account.Submit(new Order[] { order });
                        }
                        else
                        {
                            Print("Error: Account.CreateOrder returned null.");
                        }
                    }
                    catch (Exception submitEx)
                    {
                        // Catch errors during CreateOrder or Submit
                        Print($"Error during CreateOrder/Submit on dispatcher thread: {submitEx.Message}");
                        // Optionally send an error back to the client here
                        // SendErrorMessage(clientId, $"Failed to submit order internally: {submitEx.Message}").Wait(); // Be careful with .Wait() or make SendErrorMessage non-async if needed here
                    }
                });

                // Send confirmation (NinjaTrader will handle the actual order update events via OnOrderUpdate/OnExecutionUpdate if subscribed)
                var confirmationMessage = new Dictionary<string, object>
                {
                    { "type", "orderSubmitted" },
                    { "accountId", accountId },
                    { "instrument", instrumentSymbol },
                    { "action", action },
                    { "orderType", orderTypeString }, // Send back the original string type
                    { "quantity", quantity },
                    { "limitPrice", limitPrice }, // Include limit price in confirmation if set
                    { "stopPrice", stopPrice }, // Include stop price in confirmation if set
                    { "signalName", orderSignalName }, // Keep sending signalName for reference
                    { "message", $"{ntOrderType} order submitted successfully via Account.Submit()." }
                };
                await SendMessageAsync(clientId, confirmationMessage); // Use clientId
                Print($"{ntOrderType} order submitted successfully via Account.Submit(): Account={accountId}, Instrument={instrumentSymbol}, Action={action}, Quantity={quantity}" 
                    + (limitPrice.HasValue ? $", LimitPrice={limitPrice.Value}" : "")
                    + (stopPrice.HasValue ? $", StopPrice={stopPrice.Value}" : ""));

            }
            catch (Exception ex)
            {
                 Print($"Error during place order for Account: {accountId}, Instrument: {instrumentSymbol}: {ex.Message}");
                await SendErrorMessage(clientId, $"Error submitting order for {instrumentSymbol}: {ex.Message}"); // Use clientId
            }
        }

        private void DebugAccountProperties(Account account)
        {
            Print("=== DEBUG ACCOUNT PROPERTIES ===");
            Print($"Account: {account.Name}");
            
            // Use reflection to enumerate all properties
            Print("--- All Properties ---");
            foreach (PropertyInfo prop in account.GetType().GetProperties())
            {
                try
                {
                    var value = prop.GetValue(account, null);
                    Print($"{prop.Name}: {(value == null ? "null" : value.ToString())}");
                }
                catch (Exception ex)
                {
                    Print($"Error accessing {prop.Name}: {ex.Message}");
                }
            }
            Print("=== END DEBUG ===");
        }

        private object GetAccountInfo(Account account)
        {
            try
            {
                var positions = new List<object>();

                // Lock the positions collection while iterating
                lock (account.Positions) 
                {
                    foreach (Position position in account.Positions)
                    {
                        double avgPrice = position.AveragePrice;
                        // Cannot directly access live MarketPrice or UnrealizedProfitLoss here.
                        // Use placeholders for now.
                        double marketPrice = 0; // Placeholder
                        double posUnrealizedPnL = 0; // Placeholder

                        // *** Log the raw quantity from the position object ***
                        Print($"Processing position: {position.Instrument.FullName}, Raw Quantity: {position.Quantity}");

                        positions.Add(new Dictionary<string, object>
                        {
                            { "instrument", position.Instrument.FullName },
                            { "quantity", position.Quantity }, // Send the absolute quantity
                            { "marketPosition", position.MarketPosition.ToString() }, // Send direction enum as string
                            { "averagePrice", avgPrice },
                            { "marketPrice", marketPrice }, 
                            { "unrealizedPnL", posUnrealizedPnL } 
                        });
                    }
                }

                // Get basic account info
                string connectionName = "Unknown";
                try { connectionName = account.Connection != null ? account.Connection.Options.Name : "Unknown"; } catch { }
                
                string accountType = "Unknown";
                try { accountType = account.Denomination.ToString(); } catch { }

                // Get financial values using reflection
                double cashValue = GetAccountDoubleValue(account, "CashValue");
                double buyingPower = GetAccountDoubleValue(account, "BuyingPower");
                double netLiquidation = GetAccountDoubleValue(account, "NetLiquidation");
                double realizedPnL = GetAccountDoubleValue(account, "RealizedProfitLoss");
                double unrealizedPnL = GetAccountDoubleValue(account, "UnrealizedProfitLoss");

                return new Dictionary<string, object>
                {
                    { "accountId", account.Name },
                    { "name", account.Name },
                    { "displayName", account.DisplayName },
                    { "connectionName", connectionName },
                    { "accountType", accountType },
                    { "cashValue", cashValue },
                    { "buyingPower", buyingPower },
                    { "realizedProfitLoss", realizedPnL },
                    { "unrealizedProfitLoss", unrealizedPnL },
                    { "netLiquidationValue", netLiquidation },
                    { "positions", positions }
                };
            }
            catch (Exception ex)
            {
                Print("Error in GetAccountInfo: " + ex.Message);
                return new Dictionary<string, object>
                {
                    { "accountId", account.Name },
                    { "name", account.Name },
                    { "displayName", account.DisplayName },
                    { "connectionName", "Unknown" },
                    { "accountType", "Unknown" },
                    { "cashValue", 0.0 },
                    { "buyingPower", 0.0 },
                    { "realizedProfitLoss", 0.0 },
                    { "unrealizedProfitLoss", 0.0 },
                    { "netLiquidationValue", 0.0 },
                    { "positions", new List<object>() }
                };
            }
        }

        // Helper method to get account numeric values by property name
        private double GetAccountDoubleValue(Account account, string propertyName)
        {
            try
            {
                AccountItem accountItem;

                // Map property name string to AccountItem enum
                switch (propertyName)
                {
                    case "CashValue":
                        accountItem = AccountItem.CashValue;
                        break;
                    case "BuyingPower":
                        accountItem = AccountItem.BuyingPower;
                        break;
                    case "NetLiquidation":
                        accountItem = AccountItem.NetLiquidation;
                        break;
                    case "RealizedProfitLoss":
                        accountItem = AccountItem.RealizedProfitLoss;
                        break;
                    case "UnrealizedProfitLoss":
                        accountItem = AccountItem.UnrealizedProfitLoss;
                        break;
                    // Add other cases here if needed in the future
                    default:
                        Print($"Account property '{propertyName}' is not explicitly handled. Returning 0.");
                        return 0.0;
                }

                // Use the official GetAccountItem method
                double value = account.GetAccountItem(accountItem, account.Denomination).Value;
                
                // Optional: Add debug logging if needed
                // if (_debugMode)
                // {
                //     Print($"Retrieved {propertyName}: {value}");
                // }

                return value;
            }
            catch (Exception ex)
            {
                Print($"Error getting account value for {propertyName}: {ex.Message}");
                return 0.0;
            }
        }

        private void Print(string message)
        {
            NinjaTrader.Code.Output.Process("QuatrainTradeManager: " + message, PrintTo.OutputTab1);
        }

        private void OnAccountStatusUpdateHandler(object sender, AccountStatusEventArgs e)
        {
            try
            {
                string connectionName = (e.Account?.Connection?.Options?.Name) ?? "Unknown";
                Print($"OnAccountStatusUpdateHandler triggered: Account={e.Account?.Name ?? "N/A"}, Status={e.Status}, ConnectionStatus={e.Account?.Connection?.Status}, Connection={connectionName}"); 

                bool needsListUpdate = false;

                if (e.Account?.Connection != null)
                {
                    // Check the connection status
                    bool isNowConnected = e.Account.Connection.Status == ConnectionStatus.Connected;
                    
                    // Check if we were previously subscribed (implies we thought it was connected)
                    bool wasSubscribed = false; // Need a way to track this, or simplify logic
                    // Let's simplify: always try to subscribe/unsubscribe based on current state
                    // and broadcast only if the connection status flips TO connected or FROM connected.

                    // Determine if the status relevant for broadcasting has changed
                    // For simplicity, let's broadcast whenever the handler is called for a connected account
                    // or when it transitions away from connected. Refinement might be needed.

                    if (isNowConnected)
                    {
                        // Attempt to subscribe (safe if already subscribed)
                        e.Account.AccountItemUpdate -= OnAccountItemUpdateHandler; // Unsubscribe first to prevent duplicates
                        e.Account.AccountItemUpdate += OnAccountItemUpdateHandler;
                        e.Account.OrderUpdate -= OnOrderUpdateHandler; // Prevent duplicates
                        e.Account.OrderUpdate += OnOrderUpdateHandler;
                        Print($"Ensured subscription to updates for connected account: {e.Account.Name}");
                        needsListUpdate = true; // Broadcast list when an account is confirmed connected
                    }
                    else 
                    { 
                        // Unsubscribe if not connected
                        e.Account.AccountItemUpdate -= OnAccountItemUpdateHandler;
                        e.Account.OrderUpdate -= OnOrderUpdateHandler;
                        Print($"Ensured unsubscription from updates for non-connected account: {e.Account.Name} (Status: {e.Account.Connection.Status})");
                        needsListUpdate = true; // Broadcast list when an account disconnects
                    }
                }
                else
                {
                    // Handle case where account or connection is null, potentially broadcast update
                    Print($"Account or Connection is null in Status Update for {e.Account?.Name ?? "N/A"}. Status={e.Status}");
                    needsListUpdate = true; // Broadcast list to reflect potential removal
                }

                // Broadcast the updated list ONLY if needed
                if (needsListUpdate)
                {
                    BroadcastActiveAccountList();
                }
            }
            catch (Exception ex)
            {
                Print("Error in OnAccountStatusUpdateHandler: " + ex.Message);
            }
        }

        private void OnAccountItemUpdateHandler(object sender, AccountItemEventArgs e)
        {
            try
            {
                // Cast the sender to Account
                if (!(sender is Account account))
                    return;

                // Throttle updates: Check if enough time has passed since the last update for this account
                lock (_lastAccountUpdateTimes)
                {
                    if (_lastAccountUpdateTimes.TryGetValue(account.Name, out DateTime lastUpdate))
                    {
                        if (DateTime.UtcNow - lastUpdate < _updateThrottleInterval)
                        {
                            // Optional: Log throttled message if needed for debugging
                            // Print($"Throttled update for account {account.Name}, Item={e.AccountItem}");
                            return; // Not enough time passed, skip this update
                        }
                    }
                    // Update last sent time
                    _lastAccountUpdateTimes[account.Name] = DateTime.UtcNow;
                }
                
                // If not throttled, proceed with sending the update
                Print($"Account item update received (Processing): Account={account.Name}, Item={e.AccountItem}, Value={e.Value}, Currency={e.Currency}");

                // Get the full updated account info
                var accountInfo = GetAccountInfo(account);

                // Create the update message
                var message = new Dictionary<string, object>
                {
                    { "type", "accountDetailsUpdate" }, // New message type for single account update
                    { "account", accountInfo }
                };

                // Broadcast the specific account update to all clients
                BroadcastToAllClients(message);
            }
            catch (Exception ex)
            {
                Print("Error in OnAccountItemUpdateHandler: " + ex.Message);
            }
        }

        // Handler for Account.OrderUpdate events
        private void OnOrderUpdateHandler(object sender, OrderEventArgs e)
        {
            try
            {
                // The Order object is in e.Order
                if (e.Order == null || e.Order.Account == null)
                {
                    Print("OnOrderUpdateHandler: Received update with null Order or Account.");
                    return;
                }

                // Enhanced logging for Order Update
                Print($"-- OnOrderUpdateHandler START --");
                // Log properties directly from OrderEventArgs that are available
                Print($"  EventArgs: OrderId={e.OrderId}, OrderState={e.OrderState}, Filled={e.Filled}, AvgFillPrice={e.AverageFillPrice}");
                // Log details from the Order object itself
                Print($"  Order Obj: Account={e.Order.Account?.Name ?? "NULL"}, OrderId={e.Order.OrderId}, Name={e.Order.Name}, State={e.Order.OrderState}, Action={e.Order.OrderAction}, Type={e.Order.OrderType}, Instrument={e.Order.Instrument?.FullName ?? "NULL"}");
                Print($"  Order Qty: Quantity={e.Order.Quantity}, Filled={e.Order.Filled}, Remaining={e.Order.Quantity - e.Order.Filled}");
                Print($"  Order Prices: AvgFill={e.Order.AverageFillPrice}, Limit={e.Order.LimitPrice}, Stop={e.Order.StopPrice}");
                Print($"  Order Details: Time={e.Order.Time:o}, IsLiveUntilCancelled={e.Order.IsLiveUntilCancelled}"); // ErrorCode/NativeError not available on EventArgs here
                Print($"-- OnOrderUpdateHandler END --");

                // Serialize and broadcast the order update
                // Pass both the Order object and the OrderId from the event args
                var orderInfo = GetOrderInfo(e.Order, e.OrderId);
                var message = new Dictionary<string, object>
                {
                    { "type", "orderUpdate" },
                    { "order", orderInfo }
                };

                BroadcastToAllClients(message); 
            }
            catch (Exception ex)
            {
                Print("Error in OnOrderUpdateHandler: " + ex.Message);
            }
        }

        // Helper method to broadcast the current list of active accounts
        private void BroadcastActiveAccountList()
        {
            var accounts = new List<object>();
            foreach (Account acc in GetActiveAccounts())
            {
                // Send simplified info for the list
                accounts.Add(new Dictionary<string, object> 
                {
                    { "id", acc.Name }, // Ensure 'id' field is present for client
                    { "name", acc.Name },
                    { "accountId", acc.Name }, // Include accountId as well
                    { "accountType", acc.Denomination.ToString() }
                });
            }
            
            var message = new Dictionary<string, object>
            {
                { "type", "accountList" }, // Use existing type for the list
                { "accounts", accounts }
            };
            
            BroadcastToAllClients(message);
        }

        // Helper method to start monitoring account events
        private void StartMonitoring()
        {
            if (_isMonitoringActive)
                return;

            Print("First client connected. Starting account monitoring...");
            try
            {
                Account.AccountStatusUpdate += OnAccountStatusUpdateHandler;
                
                lock (Account.All) 
                {
                    foreach (Account account in Account.All)
                    {
                        if (account.Connection != null && account.Connection.Status == ConnectionStatus.Connected)
                        {
                            account.AccountItemUpdate -= OnAccountItemUpdateHandler; // Prevent duplicates
                            account.AccountItemUpdate += OnAccountItemUpdateHandler;
                            account.OrderUpdate -= OnOrderUpdateHandler; // Prevent duplicates
                            account.OrderUpdate += OnOrderUpdateHandler;
                            Print($"Subscribed to updates for initially connected account: {account.Name}");
                        }
                    }
                }
                _isMonitoringActive = true;
                Print("Account monitoring started.");
            }
            catch (Exception ex)
            {
                 Print("Error starting monitoring: " + ex.Message);
            }
        }

        // Helper method to stop monitoring account events
        private void StopMonitoring()
        {
            if (!_isMonitoringActive)
                return;
                
            Print("Last client disconnected or AddOn stopping. Stopping account monitoring...");
            try
            {
                Account.AccountStatusUpdate -= OnAccountStatusUpdateHandler;

                lock (Account.All)
                {
                    foreach (Account account in Account.All)
                    {
                         account.AccountItemUpdate -= OnAccountItemUpdateHandler;
                         account.OrderUpdate -= OnOrderUpdateHandler;
                    }
                }
                
                lock (_lastAccountUpdateTimes)
                {
                    _lastAccountUpdateTimes.Clear(); // Clear throttle times
                }

                _isMonitoringActive = false;
                Print("Account monitoring stopped.");
            }
             catch (Exception ex)
            {
                 Print("Error stopping monitoring: " + ex.Message);
            }
        }

        // Helper method to get only active accounts
        private IEnumerable<Account> GetActiveAccounts()
        {
            List<Account> activeAccounts = new List<Account>();
            
            try
            {
                lock (Account.All) // Lock is needed when accessing Account.All
                {
                    foreach (Account account in Account.All)
                    {
                        bool isActive = false;
                        
                        // Check if account is connected and active
                        try
                        {
                            if (account.Connection != null && 
                                account.Connection.Status == ConnectionStatus.Connected && 
                                account.Connection.Options != null)
                            {
                                isActive = true;
                            }
                        }
                        catch (Exception ex)
                        {
                            Print("Error checking account connection: " + ex.Message);
                        }
                        
                        // Potentially add other checks if needed, like checking Positions count
                        // try
                        // {
                        //     if (!isActive && account.Positions != null && account.Positions.Count > 0)
                        //     {
                        //         isActive = true;
                        //     }
                        // }
                        // catch { }
                        
                        if (isActive)
                        {
                            activeAccounts.Add(account);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Print("Error in GetActiveAccounts: " + ex.Message);
            }
            
            return activeAccounts;
        }

        // Helper method to serialize Order details
        private Dictionary<string, object> GetOrderInfo(Order order, string orderIdFromEvent)
        {
            // Prioritize OrderId from the event args, fall back to the one on the Order object
            string reliableOrderId = !string.IsNullOrEmpty(orderIdFromEvent) ? orderIdFromEvent : order.OrderId;

            // Log if there's a discrepancy (for debugging)
            // if (reliableOrderId != order.OrderId && !string.IsNullOrEmpty(order.OrderId))
            // {
            //    Print($"GetOrderInfo: Discrepancy! EventArg OrderId '{reliableOrderId}' != Order.OrderId '{order.OrderId}'. Using EventArg ID.");
            // }

            return new Dictionary<string, object>
            {
                // Identifiers
                { "orderId", reliableOrderId }, // Use the reliable OrderId
                { "name", order.Name },       // User-defined name (e.g., SignalName)
                { "accountId", order.Account.Name },
                
                // Order Details
                { "instrument", order.Instrument?.FullName ?? "Unknown" }, // Use null-conditional operator
                { "action", order.OrderAction.ToString() },
                { "type", order.OrderType.ToString() },
                { "tif", order.TimeInForce.ToString() },
                { "quantity", order.Quantity },
                
                // State and Execution
                { "state", order.OrderState.ToString() },
                { "filledQuantity", order.Filled },
                { "averageFillPrice", order.AverageFillPrice },
                { "limitPrice", order.LimitPrice },
                { "stopPrice", order.StopPrice },

                // Other potentially useful info
                { "isLiveUntilCancelled", order.IsLiveUntilCancelled },
                { "submissionTime", order.Time.ToString("o") } // ISO 8601 format
            };
        }

        // Helper to send all existing orders for a specific account
        private async Task SendAllOrdersForAccount(string clientId, string accountIdToFetch)
        {
            Account account = GetActiveAccounts().FirstOrDefault(a => a.Name == accountIdToFetch);
            if (account == null)
            {
                 await SendErrorMessage(clientId, $"Account '{accountIdToFetch}' not found or not active when fetching orders.");
                 return;
            }

            // Get a snapshot of orders within the lock
            List<Order> ordersSnapshot;
            lock (account.Orders)
            {
                ordersSnapshot = account.Orders.ToList(); // Create a copy
            }

            // Log the count found in the live collection (might not be full history)
            Print($"SendAllOrdersForAccount: Found {ordersSnapshot.Count} orders in Account.Orders snapshot for Account: {accountIdToFetch} to client {clientId}"); 
            int orderCount = 0;
            
            // Iterate through the snapshot *outside* the lock
            foreach (Order order in ordersSnapshot)
            {
                // Add back detailed log for this specific debug session
                Print($"  -> Processing Order: Name='{order.Name}', OrderId='{order.OrderId}', State={order.OrderState}, Instrument={order.Instrument?.FullName ?? "N/A"}"); 
                try
                {
                    var orderInfo = GetOrderInfo(order, order.OrderId); // Pass order.OrderId here as eventId isn't relevant
                    var message = new Dictionary<string, object>
                    {
                        { "type", "orderUpdate" }, // Re-use the update type
                        { "order", orderInfo }
                    };
                    // Await outside the lock
                    await SendMessageAsync(clientId, message);
                    orderCount++;
                }
                catch (Exception ex)
                {
                    Print($"Error serializing or sending existing order {order.OrderId} for account {accountIdToFetch}: {ex.Message}");
                }
            }
            Print($"Sent {orderCount} existing orders for Account: {accountIdToFetch} to client {clientId}");
        }

        private async Task HandleCancelOrder(string clientId, string accountId, string orderIdToCancel)
        {
            try
            {
                // 1. Find the account
                var account = GetActiveAccounts().FirstOrDefault(a => a.Name == accountId);
                if (account == null)
                {
                    Print($"Cancel Order error: Account '{accountId}' not found or not active.");
                    await SendErrorMessage(clientId, $"Account '{accountId}' not found or not active for cancellation.");
                    return;
                }

                // 2. Find the Order object within the account's orders
                Order orderToCancel = null;
                lock (account.Orders) // Lock the collection while searching
                {
                    // Use OrderId for matching - this should work now that orders have IDs
                    orderToCancel = account.Orders.FirstOrDefault(o => o.OrderId == orderIdToCancel);
                }

                if (orderToCancel == null)
                {
                    Print($"Cancel Order error: Order '{orderIdToCancel}' not found in account '{accountId}'. It might already be filled or cancelled.");
                    // It might be okay not to send an error here if the order is simply gone, 
                    // but we can send one for clarity.
                    await SendErrorMessage(clientId, $"Order '{orderIdToCancel}' not found in account '{accountId}'.");
                    return;
                }

                // 3. Dispatch the cancellation to the main NT thread
                Print($"Attempting to cancel order: Account={accountId}, OrderId={orderIdToCancel}, Name={orderToCancel.Name}");
                await Application.Current.Dispatcher.InvokeAsync(() =>
                {
                    try
                    {
                        // Use Account.Cancel() which takes an enumerable
                        account.Cancel(new[] { orderToCancel });
                        Print($"CancelOrder command executed for OrderId: {orderIdToCancel}");
                        // Confirmation is implicit via OnOrderUpdate, but we can send one if needed
                        // SendMessageAsync(clientId, new Dictionary<string, object> { ... }).Wait();
                    }
                    catch (Exception cancelEx)
                    {
                        Print($"Error cancelling order on dispatcher thread: {cancelEx.Message}");
                        // Send error back to client
                         SendErrorMessage(clientId, $"Failed to cancel order '{orderIdToCancel}' internally: {cancelEx.Message}").Wait(); // Use Wait or make SendError non-async
                    }
                });

                // Note: The actual order cancellation status will come through the OnOrderUpdate event handler.

            }
            catch (Exception ex)
            {
                Print($"Error during HandleCancelOrder for Account: {accountId}, OrderId: {orderIdToCancel}: {ex.Message}");
                await SendErrorMessage(clientId, $"Error processing cancel request for order '{orderIdToCancel}': {ex.Message}");
            }
        }

        private async Task HandleModifyOrder(string clientId, string accountId, string orderId, int quantity, double? limitPrice, double? stopPrice)
        {
            try
            {
                // 1. Find the account
                var account = GetActiveAccounts().FirstOrDefault(a => a.Name == accountId);
                if (account == null)
                {
                    Print($"Modify Order error: Account '{accountId}' not found or not active.");
                    await SendErrorMessage(clientId, $"Account '{accountId}' not found or not active for modification.");
                    return;
                }

                // 2. Find the Order object within the account's orders
                Order orderToModify = null;
                lock (account.Orders) // Lock the collection while searching
                {
                    // Use OrderId for matching - this should work now that orders have IDs
                    orderToModify = account.Orders.FirstOrDefault(o => o.OrderId == orderId);
                }

                if (orderToModify == null)
                {
                    Print($"Modify Order error: Order '{orderId}' not found in account '{accountId}'. It might already be filled or cancelled.");
                    // It might be okay not to send an error here if the order is simply gone, 
                    // but we can send one for clarity.
                    await SendErrorMessage(clientId, $"Order '{orderId}' not found in account '{accountId}'.");
                    return;
                }

                // Check if order is already filled
                if (orderToModify.OrderState == OrderState.Filled)
                {
                    Print($"Modify Order error: Order '{orderId}' is already filled and cannot be modified.");
                    await SendErrorMessage(clientId, $"Order '{orderId}' is already filled and cannot be modified.");
                    return;
                }

                // Check if order is cancelled
                if (orderToModify.OrderState == OrderState.Cancelled)
                {
                    Print($"Modify Order error: Order '{orderId}' is already cancelled and cannot be modified.");
                    await SendErrorMessage(clientId, $"Order '{orderId}' is already cancelled and cannot be modified.");
                    return;
                }

                // Check if the order is in a modifiable state
                if (orderToModify.OrderState != OrderState.Working && 
                    orderToModify.OrderState != OrderState.Accepted && 
                    orderToModify.OrderState != OrderState.Submitted)
                {
                    Print($"Modify Order error: Order '{orderId}' is in state '{orderToModify.OrderState}' which does not allow modification.");
                    await SendErrorMessage(clientId, $"Order '{orderId}' cannot be modified in its current state ({orderToModify.OrderState}).");
                    return;
                }

                // 3. Dispatch the modification to the main NT thread
                Print($"Attempting to modify order: Account={accountId}, OrderId={orderId}, Quantity={quantity}, LimitPrice={limitPrice}, StopPrice={stopPrice} from {clientId}");
                await Application.Current.Dispatcher.InvokeAsync(() =>
                {
                    try
                    {
                        // Create a clone of the order to work with (to avoid race conditions)
                        Order modOrder = orderToModify;

                        Print($"Original Order: Quantity={modOrder.Quantity}, LimitPrice={modOrder.LimitPrice}, StopPrice={modOrder.StopPrice}, Type={modOrder.OrderType}");
                        
                        // ONLY set the "Changed" properties - not the actual values
                        // This is essential for NinjaTrader's order modification system
                        if (quantity > 0)
                        {
                            // Only set QuantityChanged, not Quantity
                            modOrder.QuantityChanged = quantity;
                            Print($"Set QuantityChanged to: {quantity}");
                        }
                        
                        // Special case for StopLimit orders - both limit and stop prices should be set to the same value
                        if (modOrder.OrderType == OrderType.StopLimit && stopPrice.HasValue && stopPrice.Value > 0)
                        {
                            // For StopLimit orders, set both prices to the same value
                            modOrder.StopPriceChanged = stopPrice.Value;
                            modOrder.LimitPriceChanged = stopPrice.Value; // Use the same price for both
                            Print($"StopLimit order - setting both StopPriceChanged and LimitPriceChanged to: {stopPrice.Value}");
                        }
                        // Handle regular Limit orders
                        else if (limitPrice.HasValue && limitPrice.Value > 0 && 
                                (modOrder.OrderType == OrderType.Limit || modOrder.OrderType == OrderType.MIT))
                        {
                            // Only set LimitPriceChanged, not LimitPrice
                            modOrder.LimitPriceChanged = limitPrice.Value;
                            Print($"Set LimitPriceChanged to: {limitPrice.Value}");
                        }
                        // Handle StopMarket orders
                        else if (stopPrice.HasValue && stopPrice.Value > 0 && modOrder.OrderType == OrderType.StopMarket)
                        {
                            // Only set StopPriceChanged, not StopPrice
                            modOrder.StopPriceChanged = stopPrice.Value;
                            Print($"Set StopPriceChanged to: {stopPrice.Value}");
                        }
                        
                        // Log order state before Change call
                        Print($"Order state before Change call: {modOrder.OrderState}");
                        
                        // Now use Change() method to submit the modifications
                        account.Change(new[] { modOrder });
                        Print($"Change command executed for OrderId: {orderId}");
                    }
                    catch (Exception modifyEx)
                    {
                        Print($"Error modifying order on dispatcher thread: {modifyEx.Message}");
                        // Send error back to client
                         SendErrorMessage(clientId, $"Failed to modify order '{orderId}' internally: {modifyEx.Message}").Wait(); // Use Wait or make SendError non-async
                    }
                });

                // Note: The actual order modification status will come through the OnOrderUpdate event handler.

            }
            catch (Exception ex)
            {
                Print($"Error during HandleModifyOrder for Account: {accountId}, OrderId: {orderId}: {ex.Message}");
                await SendErrorMessage(clientId, $"Error processing modify request for order '{orderId}': {ex.Message}");
            }
        }
    }
} 