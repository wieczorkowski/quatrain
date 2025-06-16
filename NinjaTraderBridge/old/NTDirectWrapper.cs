using System;
using System.Collections.Generic;
using System.Reflection;
using System.IO;
using System.Linq;

namespace NinjaTraderBridge
{
    /// <summary>
    /// Wrapper for NinjaTrader Client API functions using reflection
    /// </summary>
    public static class NTDirectWrapper
    {
        private static Assembly _ntAssembly;
        private static Type _ntDirectType;
        private static bool _initialized = false;
        private static Dictionary<string, MethodInfo> _methodCache = new Dictionary<string, MethodInfo>();

        static NTDirectWrapper()
        {
            try
            {
                // Find NinjaTrader installation path
                string ntPath = Environment.GetFolderPath(Environment.Is64BitOperatingSystem && !Environment.Is64BitProcess 
                    ? Environment.SpecialFolder.ProgramFilesX86 
                    : Environment.SpecialFolder.ProgramFiles) 
                    + @"\NinjaTrader 8\bin\";
                
                string clientDllPath = Path.Combine(ntPath, "NinjaTrader.Client.dll");
                
                Console.WriteLine($"Looking for NinjaTrader.Client.dll at: {clientDllPath}");
                
                if (!File.Exists(clientDllPath))
                {
                    // Try common alternative locations
                    string x86Path = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86) 
                        + @"\NinjaTrader 8\bin\NinjaTrader.Client.dll";
                    
                    if (File.Exists(x86Path))
                    {
                        clientDllPath = x86Path;
                        Console.WriteLine($"Found NinjaTrader.Client.dll at alternative location: {clientDllPath}");
                    }
                    else
                    {
                        Console.WriteLine("Could not find NinjaTrader.Client.dll in common locations");
                        return;
                    }
                }
                
                // Load the NinjaTrader.Client assembly
                try
                {
                    _ntAssembly = Assembly.LoadFrom(clientDllPath);
                    Console.WriteLine($"Successfully loaded NinjaTrader.Client.dll: {_ntAssembly.FullName}");
                    
                    // Print all the types in the assembly for diagnostic purposes
                    Console.WriteLine("Types in NinjaTrader.Client.dll:");
                    var allTypes = _ntAssembly.GetTypes()
                        .Where(t => !t.Name.Contains('<')) // Skip compiler-generated types
                        .OrderBy(t => t.FullName)
                        .ToList();
                    
                    foreach (var type in allTypes.Take(20))
                    {
                        Console.WriteLine($"  {type.FullName}");
                    }
                    if (allTypes.Count > 20)
                    {
                        Console.WriteLine($"  ... and {allTypes.Count - 20} more types");
                    }
                    
                    // Check all types for methods we need
                    Console.WriteLine("\nSearching for API methods in all types...");
                    
                    // First check for types with obvious names
                    var potentialTypes = allTypes.Where(t => 
                        t.Name.Contains("NTDirect") || 
                        t.Name.Contains("ATI") || 
                        t.Name.Contains("Api") || 
                        t.Name.Contains("API") ||
                        t.Name.Contains("AtiSocket") ||
                        t.Name.EndsWith("Socket") ||
                        t.FullName.Contains("Trading")).ToList();
                    
                    Console.WriteLine($"Found {potentialTypes.Count} potential API types with matching names");
                    
                    // Try to find methods in these types first
                    bool found = false;
                    foreach (var type in potentialTypes)
                    {
                        if (TryInitializeType(type))
                        {
                            found = true;
                            break;
                        }
                    }
                    
                    // If not found in named types, check all types
                    if (!found)
                    {
                        Console.WriteLine("No API methods found in likely types. Searching all types...");
                        foreach (var type in allTypes)
                        {
                            if (TryInitializeType(type))
                            {
                                found = true;
                                break;
                            }
                        }
                    }
                    
                    if (!found)
                    {
                        // Look specifically for the AtiSocket type we saw in the error
                        var atiSocketType = allTypes.FirstOrDefault(t => t.FullName == "NinjaTrader.Server.AtiSocket");
                        if (atiSocketType != null)
                        {
                            Console.WriteLine($"Found AtiSocket type: {atiSocketType.FullName}");
                            Console.WriteLine("Methods in AtiSocket:");
                            
                            var methods = atiSocketType.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance);
                            foreach (var method in methods.Take(20))
                            {
                                Console.WriteLine($"  {method.Name}");
                            }
                        }
                        
                        Console.WriteLine("Could not find any type with required ATI methods.");
                        _initialized = false;
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error loading NinjaTrader.Client.dll: {ex.Message}");
                    }
                }
            catch (Exception ex)
            {
                Console.WriteLine($"Error initializing NTDirectWrapper: {ex.Message}");
            }
        }
        
        private static bool TryInitializeType(Type type)
        {
            try
            {
                Console.WriteLine($"Checking type: {type.FullName}");
                
                var methods = type.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance);
                
                // Check if this type has the expected methods
                bool hasConnected = methods.Any(m => string.Equals(m.Name, "Connected", StringComparison.OrdinalIgnoreCase));
                bool hasMarketPosition = methods.Any(m => string.Equals(m.Name, "MarketPosition", StringComparison.OrdinalIgnoreCase));
                bool hasCashValue = methods.Any(m => string.Equals(m.Name, "CashValue", StringComparison.OrdinalIgnoreCase));
                bool hasMethods = hasConnected || hasMarketPosition || hasCashValue;
                
                if (hasMethods)
                {
                    _ntDirectType = type;
                    Console.WriteLine($"Found API type: {type.FullName}");
                    
                    Console.WriteLine("Available methods:");
                    foreach (var method in methods.Where(m => !m.Name.StartsWith("get_") && !m.Name.StartsWith("set_")).Take(20))
                    {
                        Console.WriteLine($"  {method.Name}");
                        
                        // Cache the method for faster lookup
                        if (!_methodCache.ContainsKey(method.Name))
                        {
                            _methodCache[method.Name] = method;
                        }
                    }
                    
                    _initialized = true;
                    return true;
                }
                
                // If it's a likely API container, print some methods
                if (type.Name.Contains("ATI") || type.Name.Contains("Api"))
                {
                    Console.WriteLine($"Methods in {type.Name}:");
                    foreach (var method in methods.Where(m => !m.Name.StartsWith("get_") && !m.Name.StartsWith("set_")).Take(5))
                    {
                        Console.WriteLine($"  {method.Name}");
                    }
                }
                
                return false;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error checking type {type.FullName}: {ex.Message}");
                return false;
            }
        }

        // Helper method to invoke a static method using reflection
        private static object InvokeMethod(string methodName, params object[] parameters)
        {
            if (!_initialized || _ntDirectType == null)
            {
                throw new InvalidOperationException("NinjaTrader.Client.dll not initialized");
            }
            
            try
            {
                // Try to get method from cache
                if (!_methodCache.TryGetValue(methodName, out var method))
                {
                    // Search for method by name (case insensitive)
                    method = _ntDirectType.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance)
                        .FirstOrDefault(m => string.Equals(m.Name, methodName, StringComparison.OrdinalIgnoreCase));
                    
                    if (method != null)
                    {
                        _methodCache[methodName] = method;
                    }
                    else
                    {
                        throw new MissingMethodException($"Method {methodName} not found in {_ntDirectType.FullName}");
                    }
                }
                
                // For instance methods, we need to create an instance
                if (!method.IsStatic)
                {
                    var instance = Activator.CreateInstance(_ntDirectType);
                    return method.Invoke(instance, parameters);
                }
                
                return method.Invoke(null, parameters);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error invoking {methodName}: {ex.Message}");
                throw;
            }
        }
        
        // API method wrappers
        
        public static bool IsConnected()
        {
            try
            {
                // Connected method returns 0 when connected, -1 when not
                var result = InvokeMethod("Connected", 0);
                return Convert.ToInt32(result) == 0;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error checking connection: {ex.Message}");
                return false;
            }
        }
        
        public static double AvgEntryPrice(string instrument, string account)
        {
            try
            {
                var result = InvokeMethod("AvgEntryPrice", instrument, account);
                return Convert.ToDouble(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting average entry price: {ex.Message}");
                return 0.0;
            }
        }
        
        public static double BuyingPower(string account)
        {
            try
            {
                var result = InvokeMethod("BuyingPower", account);
                return Convert.ToDouble(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting buying power: {ex.Message}");
                return 0.0;
            }
        }
        
        public static double CashValue(string account)
        {
            try
            {
                var result = InvokeMethod("CashValue", account);
                return Convert.ToDouble(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting cash value: {ex.Message}");
                return 0.0;
            }
        }
        
        public static int MarketPosition(string instrument, string account)
        {
            try
            {
                var result = InvokeMethod("MarketPosition", instrument, account);
                return Convert.ToInt32(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting market position: {ex.Message}");
                return 0;
            }
        }
        
        public static double RealizedPnL(string account)
        {
            try
            {
                var result = InvokeMethod("RealizedPnL", account);
                return Convert.ToDouble(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting realized P&L: {ex.Message}");
                return 0.0;
            }
        }
        
        public static string Strategies(string account)
        {
            try
            {
                var result = InvokeMethod("Strategies", account);
                return result?.ToString() ?? string.Empty;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting strategies: {ex.Message}");
                return string.Empty;
            }
        }
        
        public static int SubscribeMarketData(string instrument)
        {
            try
            {
                var result = InvokeMethod("SubscribeMarketData", instrument);
                return Convert.ToInt32(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error subscribing to market data: {ex.Message}");
                return -1;
            }
        }
        
        public static double MarketData(string instrument, int type)
        {
            try
            {
                var result = InvokeMethod("MarketData", instrument, type);
                return Convert.ToDouble(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting market data: {ex.Message}");
                return 0.0;
            }
        }
        
        public static int UnsubscribeMarketData(string instrument)
        {
            try
            {
                var result = InvokeMethod("UnsubscribeMarketData", instrument);
                return Convert.ToInt32(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error unsubscribing from market data: {ex.Message}");
                return -1;
            }
        }
        
        public static int TearDown()
        {
            try
            {
                var result = InvokeMethod("TearDown");
                return Convert.ToInt32(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error tearing down: {ex.Message}");
                return -1;
            }
        }

        // Utility functions
        
        public static string[] GetAccountIds()
        {
            Console.WriteLine("Looking for NinjaTrader accounts...");
            
            // Use a HashSet to avoid duplicate accounts
            HashSet<string> knownAccounts = new HashSet<string>();
            
            // These are the hardcoded test account IDs NinjaTrader tries
            string[] commonAccountIds = { "Sim101", "Cash Account" };
            
            foreach (var accountId in commonAccountIds)
            {
                try
                {
                    // Check if this account exists by trying to get its cash value
                    double cashValue = CashValue(accountId);
                    
                    // If we get here without exception, this is a valid account
                    Console.WriteLine($"Found valid account: {accountId} (Cash: {cashValue})");
                    knownAccounts.Add(accountId);
                }
                catch (Exception ex)
                {
                    // This account ID doesn't exist or can't be accessed
                    Console.WriteLine($"Account {accountId} is not accessible: {ex.Message}");
                }
            }
            
            // If we found accounts, just return those
            if (knownAccounts.Count > 0)
            {
                return knownAccounts.ToArray();
            }
            
            // If we couldn't find specific accounts, at least return Sim101 which
            // usually exists in NinjaTrader installations
            Console.WriteLine("No accounts found, returning default Sim101 account");
            return new[] { "Sim101" };
        }

        public static string[] GetPositionInstruments(string accountId)
        {
            // NinjaTrader doesn't provide a direct way to get all positions
            // We need to use common instruments and check if there's a position
            
            string[] commonInstruments = { "ES", "NQ", "CL", "GC", "AAPL", "MSFT", "GOOG", "AMZN" };
            List<string> positions = new List<string>();
            
            foreach (var instrument in commonInstruments)
            {
                try
                {
                    int position = MarketPosition(instrument, accountId);
                    if (position != 0) // 0 means flat
                    {
                        positions.Add(instrument);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error checking position for {instrument}: {ex.Message}");
                }
            }
            
            return positions.ToArray();
        }

        public static double GetMarketPrice(string instrument)
        {
            try
            {
                // Subscribe to market data
                int subResult = SubscribeMarketData(instrument);
                if (subResult != 0) // 0 means success
                {
                    Console.WriteLine($"Failed to subscribe to market data for {instrument}");
                    return 0.0;
                }
                
                // Get last price (type 0)
                double price = MarketData(instrument, 0);
                
                // Unsubscribe
                UnsubscribeMarketData(instrument);
                
                return price;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting market price for {instrument}: {ex.Message}");
                return 0.0;
            }
        }
    }
} 