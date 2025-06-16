import React, { useState, useEffect, useRef, useCallback } from 'react';
import DataClient from '../services/data-client';
import tradeTheChartIcon from '../images/trade-the-chart-icon.png';
import smartstopIcon from '../images/smartstop-icon.png';
import TradeBossPanel from './trading/TradeBossPanel';
import { useTradeBoss } from './trading/useTradeBoss';
import {
  TradeWindowContainer,
  MainContent,
  TradingPanel,
  ChartTraderPanel,
  SmartStopPanel,
  TabsContainer,
  Tab,
  Header,
  HeaderLeft,
  HeaderTitle,
  HeaderCenter,
  HeaderSymbol,
  SymbolText,
  PriceText,
  HeaderAccount,
  Form,
  FormGroup,
  Label,
  Input,
  ButtonGroup,
  Button,
  SmallText,
  QtyInput,
  InfoBox,
  InfoRow,
  InfoLabel,
  InfoValue,
  StatusMessage,
  SectionTitle,
  Select,
  NotImplemented,
  LimitSubtypeGroup,
  LimitPriceInput,
  LimitSubtypeSelect,
  StopSubtypeGroup,
  StopPriceInput,
  StopSubtypeSelect,
  ChartTraderContainer,
  ChartTraderHeader,
  HeaderIcon,
  ChartTraderSection,
  ChartTraderSectionTitle,
  ChartTraderButtonGroup,
  ChartTraderButton,
  CompactQtyInput,
  CheckboxContainer,
  CheckboxLabel,
  Checkbox,
  PositionActionGroup,
  SmartStopContainer,
  SmartStopHeader,
  SmartStopSection,
  SmartStopSectionTitle,
  Tooltip
} from './trading/TradeWindowStyles';

function TradeWindow() {
  const [symbol, setSymbol] = useState('');
  const [price, setPrice] = useState(0);
  const [quantity, setQuantity] = useState('1');
  const [status, setStatus] = useState({ message: '', type: null });
  const [isConnected, setIsConnected] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [orderType, setOrderType] = useState('Market');
  const [limitPriceInput, setLimitPriceInput] = useState('');
  const [limitOrderSubtype, setLimitOrderSubtype] = useState('Limit');
  const [stopPriceInput, setStopPriceInput] = useState('');
  const [stopOrderSubtype, setStopOrderSubtype] = useState('Limit Stop');
  
  // Active tab state - default to Chart Trader
  const [activeTab, setActiveTab] = useState('chartTrader');
  
  const [stopQtyFollowsPosition, setStopQtyFollowsPosition] = useState(false);
  const [chartTraderQuantity, setChartTraderQuantity] = useState('1');
  const [chartTraderStopQuantity, setChartTraderStopQuantity] = useState('1');
  const [isMarketStop, setIsMarketStop] = useState(false);
  const [isNTBridgeConnected, setIsNTBridgeConnected] = useState(false);
  
  // State for modifying orders on chart
  const [isModifyingOrdersOnChart, setIsModifyingOrdersOnChart] = useState(false);
  
  // Add trail stop state variables
  const [trailStopEnabled, setTrailStopEnabled] = useState(false);
  const [trailStopPoints, setTrailStopPoints] = useState('5');
  
  // Add new state variables for Stop by Candle feature
  const [candleStopEnabled, setCandleStopEnabled] = useState(false);
  const [candleTimeframe, setCandleTimeframe] = useState('1m');
  const [candleType, setCandleType] = useState('any');
  
  // Add state for Cancel All Orders On Close/Reverse feature
  const [cancelOrdersOnCloseReverse, setCancelOrdersOnCloseReverse] = useState(false);
  
  // Trade Boss functionality
  const tradeBoss = useTradeBoss(isNTBridgeConnected, accountName, symbol, setStatus);
  
  // Refs
  const dataClientRef = useRef(null);
  const messageTimerRef = useRef(null);
  
  // Effect 1: Setup, DataClient, WebSocket Connection, Cleanup (Runs ONCE on mount)
  useEffect(() => {
    console.log('TradeWindow: MOUNT Effect Running (Setup DataClient/WebSocket)');
    // Initialize DataClient
    if (!dataClientRef.current) {
      dataClientRef.current = new DataClient();
      console.log('TradeWindow: DataClient initialized');
    }

    // Subscribe to market data for symbol/price/account updates
    const marketDataUnsubscribe = dataClientRef.current.subscribeToMarketData((data) => {
      if (data) {
        if (data.currentSymbol !== undefined) { // Check if property exists
          setSymbol(data.currentSymbol);
        }
        if (data.latestPrice !== undefined) {
          const latestPrice = parseFloat(data.latestPrice);
          if (!isNaN(latestPrice)) {
            setPrice(latestPrice); // Update market price state
          }
        }
        if (data.accountName !== undefined) {
          setAccountName(data.accountName);
        }
      }
    });

    // Subscribe to dedicated account info channel
    const accountInfoUnsubscribe = dataClientRef.current.subscribe('account:info', (data) => {
      if (data && data.name) {
        console.log('TradeWindow: Received account info from shared service:', data);
        setAccountName(data.name);
      }
    });

    // Get initial market data
    dataClientRef.current.getMarketData().then((data) => {
      if (data) {
        console.log('TradeWindow: Fetched initial market data from shared service:', data);
        if (data.currentSymbol) setSymbol(data.currentSymbol);
        if (data.latestPrice) {
          const latestPrice = parseFloat(data.latestPrice);
          if (!isNaN(latestPrice)) setPrice(latestPrice);
        }
        if (data.accountName) setAccountName(data.accountName);
      }
    });

    // Request account info
    dataClientRef.current.request('account:info').then((data) => {
      if (data && data.name) {
        console.log('TradeWindow: Fetched account info from shared service:', data);
        setAccountName(data.name);
      }
    });

    // Set up IPC listeners for NT Bridge communication 
    try {
      const { ipcRenderer } = window.require('electron');
      
      // Listen for NinjaTrader Bridge connection status
      ipcRenderer.on('nt-bridge-connected', (event, connected) => {
        console.log('TradeWindow: NinjaTrader Bridge connection status:', connected);
        setIsConnected(connected);
        setIsNTBridgeConnected(connected);
        
        // Update UI when connection status changes
        if (connected) {
          setStatus({
            message: 'Connected to NinjaTrader Bridge',
            type: 'success'
          });
        } else {
          setStatus({
            message: 'Disconnected from NinjaTrader Bridge. Orders cannot be sent.',
            type: 'error'
          });
        }
      });
      
      // Request current connection status
      ipcRenderer.send('nt-bridge-status-request');
      
      // Listen for NinjaTrader Bridge messages
      ipcRenderer.on('nt-bridge-message', (event, message) => {
        console.log('TradeWindow: Received NinjaTrader Bridge message:', message.type);
        handleNinjaTraderMessage(message);
      });
      
      ipcRenderer.on('toggle-chart-trader', () => {
        console.log('TradeWindow: Received toggle-chart-trader IPC message');
        toggleChartTrader();
      });

      // Add new IPC listener for toggling Smart Stop
      ipcRenderer.on('toggle-smart-stop', () => {
        console.log('TradeWindow: Received toggle-smart-stop IPC message');
        toggleSmartStop();
      });
      
      // Listener to reset the "Modify Orders on Chart" button state
      ipcRenderer.on('reset-modify-order-mode', () => {
        console.log('TradeWindow: Received reset-modify-order-mode IPC message');
        setIsModifyingOrdersOnChart(false);
      });
      
      // Add notification about the active tab to the IPC setup
      try {
        const { ipcRenderer } = window.require('electron');
        
        // Notify that we start with Chart Trader active by default
        ipcRenderer.send('chart-trader-state-changed', true);
        ipcRenderer.send('smart-stop-state-changed', false);
        
        // Always expanded now, so resize the window on startup
        ipcRenderer.send('resize-trade-window', true);
      } catch (error) {
        console.error('TradeWindow: Error sending initial tab state IPC message:', error);
      }
      
      // Listen for chart click order completion
      ipcRenderer.on('chart-click-order-completed', (event, data) => {
        console.log('TradeWindow: Chart click order completed:', data);
        
        // Determine the appropriate message based on order type
        let orderTypeDisplay = 'limit';
        let priceField = 'price';
        
        if (data.orderType) {
          if (data.orderType === 'STOPLIMIT') {
            orderTypeDisplay = 'stop limit';
          } else if (data.orderType === 'STOPMARKET') {
            orderTypeDisplay = 'stop market';
          } else {
            orderTypeDisplay = data.orderType.toLowerCase();
          }
        }
        
        setStatus({
          message: `${data.action} ${orderTypeDisplay} order placed at $${data.price.toFixed(2)} for ${data.quantity} ${data.symbol}`,
          type: 'success'
        });
      });
      
      // Listen for chart click order cancelation
      ipcRenderer.on('chart-click-order-canceled', () => {
        console.log('TradeWindow: Chart click order canceled');
        setStatus({
          message: 'Chart limit order canceled',
          type: 'error'
        });
      });
      
      // Listen for order submission responses
      ipcRenderer.on('nt-bridge-send-response', (event, response) => {
        console.log('TradeWindow: Received nt-bridge-send-response:', response);
        
        // Only handle place_order type responses
        if (response.originalMessage && response.originalMessage.type === 'place_order') {
          if (!response.success) {
            // Show an error message for failed order submissions
            const orderType = response.originalMessage.orderType || 'Unknown';
            const symbol = response.originalMessage.symbol || 'Unknown';
            const action = response.originalMessage.action || 'Unknown';
            
            setStatus({
              message: `Failed to send ${action} ${orderType} order for ${symbol}: ${response.error || 'Connection error'}`,
              type: 'error'
            });
          }
          // Note: We don't need to handle successful submissions here as they'll 
          // trigger separate orderSubmitted/order_confirmation messages
        }
      });
    } catch (error) {
      console.error('TradeWindow: Error setting up IPC listener:', error);
    }

    // Clean up on unmount
    return () => {
      console.log('TradeWindow: UNMOUNT Effect Running (Cleanup DataClient/WebSocket)');
      marketDataUnsubscribe();
      accountInfoUnsubscribe();
      
      // Clear any active message timer
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
        messageTimerRef.current = null;
      }
      
      // Remove IPC listeners - improved cleanup method
      try {
        const { ipcRenderer } = window.require('electron');
        
        // Store functions we want to remove in an array
        const events = [
          'toggle-chart-trader',
          'toggle-smart-stop',
          'chart-click-order-completed',
          'chart-click-order-canceled',
          'nt-bridge-send-response',
          'nt-bridge-connected',
          'nt-bridge-message',
          'price-update'
        ];
        
        // Remove all listeners for these events
        events.forEach(event => {
          console.log(`TradeWindow: Removing all listeners for ${event}`);
          ipcRenderer.removeAllListeners(event);
        });
        // Also remove the new listener specifically
        ipcRenderer.removeAllListeners('reset-modify-order-mode');
        
        console.log('TradeWindow: Successfully removed all IPC listeners');
      } catch (error) {
        console.error('TradeWindow: Error removing IPC listeners:', error);
      }
    };
  }, []); 

 // Effect 2: Update Default Price Inputs based on Market Price or Order Type Change ***
 useEffect(() => {
    // Only update inputs if the market price is valid
    if (price > 0) {
        // If Limit order is selected AND the input is currently empty, set default
        if (orderType === 'Limit' && limitPriceInput === '') {
            setLimitPriceInput(price.toString());
        }
        // If Stop order is selected AND the input is currently empty, set default
        else if (orderType === 'Stop' && stopPriceInput === '') {
            setStopPriceInput(price.toString());
        }
    }
  // Dependencies: Run only when market price or order type changes
  }, [price, orderType]);

  // Effect 3: Clear Price Inputs when Order Type changes away from Limit/Stop ***
  useEffect(() => {
      if (orderType !== 'Limit') {
          setLimitPriceInput('');
      }
      if (orderType !== 'Stop') {
          setStopPriceInput('');
      }
      // Reset subtypes on order type change as well
      if (orderType === 'Limit') {
          setLimitOrderSubtype('Limit');
      } else if (orderType === 'Stop') {
          setStopOrderSubtype('Limit Stop');
      }
  // Dependency: Run only when order type changes
  }, [orderType]);

  // Effect 4: Resize window when Chart Trader or Smart Stop visibility changes
  useEffect(() => {
    // Notify the main process to resize the window
    try {
      const { ipcRenderer } = window.require('electron');
      
      // Report which tab is active to the main process
      if (activeTab === 'chartTrader') {
        console.log('TradeWindow: Chart Trader tab is active');
        ipcRenderer.send('chart-trader-state-changed', true);
        ipcRenderer.send('smart-stop-state-changed', false);
      } else if (activeTab === 'smartStop') {
        console.log('TradeWindow: Smart Stop tab is active');
        ipcRenderer.send('chart-trader-state-changed', false);
        ipcRenderer.send('smart-stop-state-changed', true);
      } else if (activeTab === 'tradeBoss') {
        console.log('TradeWindow: Trade Boss tab is active');
        ipcRenderer.send('chart-trader-state-changed', false);
        ipcRenderer.send('smart-stop-state-changed', false);
      }
    } catch (error) {
      console.error('TradeWindow: Error sending tab change IPC message:', error);
    }
  }, [activeTab]);

  // Effect to clear status messages after 10 seconds
  useEffect(() => {
    // Only set timer if there's a message
    if (status.message) {
      // Clear any existing timer
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
      
      // Set new timer to clear message after 10 seconds
      messageTimerRef.current = setTimeout(() => {
        setStatus({ message: '', type: null });
      }, 10000);
    }
    
    // Clean up timer on unmount or when status changes
    return () => {
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
    };
  }, [status]);



  // Handle NinjaTrader messages
  const handleNinjaTraderMessage = (message) => {
    try {
      // console.log('TradeWindow: Handling NinjaTrader message:', message);
      
      // --- Handle specific message types --- 
      if (message.type === 'orderSubmitted') {
         const { action = '', quantity = '', instrument = '', orderType: submittedType = '', message: msg = '' } = message;
         setStatus({
           message: msg || `Order ${action} ${quantity} ${instrument} ${submittedType} submitted.`,
           type: 'success'
         });
      }
      else if (message.type === 'order_confirmation' || message.type === 'orderUpdate') { 
         // Extract from the correct fields based on message type
         let orderId, status, action, quantity, symbol, fillPrice;
         
         if (message.type === 'orderUpdate' && message.order) {
           // For orderUpdate messages, data is in the order object
           orderId = message.order.orderId || 'N/A';
           status = message.order.state || 'N/A'; // Use order.state, not message.status
           action = message.order.action || '';
           quantity = message.order.quantity ? message.order.quantity.toString() : '';
           symbol = message.order.instrument || '';
           fillPrice = message.order.averageFillPrice || '';
         } else {
           // For order_confirmation messages, use the old extraction
           orderId = message.orderId || 'N/A';
           status = message.status || 'N/A';
           action = message.action || '';
           quantity = message.quantity || '';
           symbol = message.symbol || message.instrument || '';
           fillPrice = message.price || '';
         }
        
        console.log(`TradeWindow: ${message.type} received:`, { orderId, status, action, quantity, symbol, fillPrice });
        
        // Handle Trade Boss automation if applicable
        tradeBoss.handleTradeBossMessage(message);
        
        // Only show status for order_confirmation messages to avoid spam
        if (message.type === 'order_confirmation') {
          setStatus({
            message: `Order ${orderId} ${status}: ${action} ${quantity} ${symbol} @ ${fillPrice}`,
            type: 'success'
          });
        }
      }
      else if (message.type === 'order_rejected' || message.type === 'error') { 
         const reason = message.reason || message.message || 'Unknown reason';
        setStatus({
          message: `Order rejected or Error: ${reason}`,
          type: 'error'
        });
      } 
      // ---> Handle the accountList message from the AddOn <--- 
      else if (message.type === 'accountList' && Array.isArray(message.accounts)) {
          console.log('TradeWindow: Received accountList:', message.accounts);
          if (message.accounts.length > 0) {
              // Use the first account from the list as the active one
              const firstAccountName = message.accounts[0].name || message.accounts[0].accountId;
              if (firstAccountName) {
                  console.log('TradeWindow: Setting active account name:', firstAccountName);
                  setAccountName(firstAccountName);
              } else {
                  console.warn('TradeWindow: First account in list has no name/accountId');
              }
          } else {
              console.warn('TradeWindow: Received empty accountList');
          }
      }
      // Keep handling other account messages if AddOn sends them separately
      else if (message.type === 'account_info' || (message.type === 'current_account' && message.account)) {
          const accName = message.account?.name || message.name;
          if (accName) {
            setAccountName(accName);
          }
      } 
    } catch (error) {
      console.error('TradeWindow: Error handling NinjaTrader message:', error);
    }
  };

  // Handle quantity change
  const handleQuantityChange = (e) => {
    const value = e.target.value;
    // Allow empty string or numbers only
    if (value === '' || /^\d+$/.test(value)) {
      setQuantity(value);
    }
  };
  
  // Handle chart trader quantity change
  const handleChartTraderQuantityChange = (e) => {
    const value = e.target.value;
    // Allow empty string or numbers only
    if (value === '' || /^\d+$/.test(value)) {
      setChartTraderQuantity(value);
    }
  };
  
  // Handle chart trader stop quantity change
  const handleChartTraderStopQuantityChange = (e) => {
    const value = e.target.value;
    // Allow empty string or numbers only
    if (value === '' || /^\d+$/.test(value)) {
      setChartTraderStopQuantity(value);
    }
  };

  // Handle market stop checkbox change
  const handleMarketStopChange = (e) => {
    setIsMarketStop(e.target.checked);
  };

  // Handle stop qty follows position change
  const handleStopQtyFollowsPositionChange = (e) => {
    const newValue = e.target.checked;
    setStopQtyFollowsPosition(newValue);
    
    try {
      const { ipcRenderer } = window.require('electron');
      console.log(`TradeWindow: Setting Stop Qty Follows Position to ${newValue}`);
      
      // Notify Trade Manager about the setting change
      ipcRenderer.send('smart-stop-settings-changed', {
        stopQtyFollowsPosition: newValue,
        // Include other settings
        trailStopEnabled,
        trailStopPoints: parseInt(trailStopPoints, 10) || 5,
        candleStopEnabled,
        candleTimeframe,
        candleType
      });
      
      // Show a status message to confirm the change
      setStatus({
        message: `Smart Stop: Position quantity tracking ${newValue ? 'enabled' : 'disabled'}`,
        type: 'success'
      });
    } catch (error) {
      console.error('TradeWindow: Error sending smart-stop-settings-changed IPC message:', error);
      setStatus({
        message: `Error updating Smart Stop settings: ${error.message}`,
        type: 'error'
      });
    }
  };

  // Handle buy order
  const handleBuy = () => {
    if (!isConnected || !symbol || !accountName) {
      setStatus({
        message: 'Cannot place order: Not connected, no instrument selected, or no account active',
        type: 'error'
      });
      return;
    }
    
    // Validate quantity
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      setStatus({
        message: 'Please enter a valid quantity',
        type: 'error'
      });
      return;
    }
    
    const order = {
      type: 'place_order',
      action: 'BUY',
      orderType: 'MARKET', // Default, will be overwritten below
      accountId: accountName,
      symbol: symbol,
      quantity: qty,
      timestamp: Date.now()
    };

    // Handle Limit/MIT Orders
    if (orderType === 'Limit') {
      const limitPrice = parseFloat(limitPriceInput);
      if (isNaN(limitPrice) || limitPrice <= 0) {
        setStatus({ message: 'Please enter a valid limit price', type: 'error' });
        return;
      }
      order.orderType = limitOrderSubtype.toUpperCase(); // 'LIMIT' or 'MIT'
      order.limitPrice = limitPrice;
    }
    // Handle Stop Orders
    else if (orderType === 'Stop') {
        const stopPrice = parseFloat(stopPriceInput);
        if (isNaN(stopPrice) || stopPrice <= 0) {
            setStatus({ message: 'Please enter a valid stop price', type: 'error' });
            return;
        }
        // Determine NT order type string based on subtype
        order.orderType = stopOrderSubtype.toUpperCase().replace(' ', ''); // "LIMITSTOP" or "MARKETSTOP"
        order.stopPrice = stopPrice;
        // For StopLimit orders, NT requires both Stop and Limit price.
        // We send the Stop Price as the Limit Price as well, as per user spec.
        if (order.orderType === 'LIMITSTOP') {
            order.limitPrice = stopPrice;
        }
    }
    else {
      // For Market orders, ensure orderType is MARKET explicitly
      order.orderType = 'MARKET';
    }
    
    try {
      // Send the order via IPC instead of direct WebSocket
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('nt-bridge-send-request', order);
      
      setStatus({
        message: `Sending ${orderType === 'Stop' ? stopOrderSubtype : order.orderType} order for ${qty} ${symbol}...`,
        type: 'success'
      });
    } catch (error) {
      console.error('TradeWindow: Error sending buy order:', error);
      setStatus({
        message: 'Error sending order. Please try again.',
        type: 'error'
      });
    }
  };
  
  // Handle sell order
  const handleSell = () => {
    if (!isConnected || !symbol || !accountName) {
      setStatus({
        message: 'Cannot place order: Not connected, no instrument selected, or no account active',
        type: 'error'
      });
      return;
    }
    
    // Validate quantity
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      setStatus({
        message: 'Please enter a valid quantity',
        type: 'error'
      });
      return;
    }
    
    const order = {
      type: 'place_order',
      action: 'SELL',
      orderType: 'MARKET', // Default, will be overwritten below
      accountId: accountName,
      symbol: symbol,
      quantity: qty,
      timestamp: Date.now()
    };
    
    // Handle Limit/MIT Orders
    if (orderType === 'Limit') {
        const limitPrice = parseFloat(limitPriceInput);
        if (isNaN(limitPrice) || limitPrice <= 0) {
          setStatus({ message: 'Please enter a valid limit price', type: 'error' });
          return;
        }
        order.orderType = limitOrderSubtype.toUpperCase(); // 'LIMIT' or 'MIT'
        order.limitPrice = limitPrice;
    }
    // Handle Stop Orders
    else if (orderType === 'Stop') {
        const stopPrice = parseFloat(stopPriceInput);
        if (isNaN(stopPrice) || stopPrice <= 0) {
            setStatus({ message: 'Please enter a valid stop price', type: 'error' });
            return;
        }
        // Determine NT order type string based on subtype
        order.orderType = stopOrderSubtype.toUpperCase().replace(' ', ''); // "LIMITSTOP" or "MARKETSTOP"
        order.stopPrice = stopPrice;
        // For StopLimit orders, NT requires both Stop and Limit price.
        // We send the Stop Price as the Limit Price as well, as per user spec.
        if (order.orderType === 'LIMITSTOP') {
            order.limitPrice = stopPrice;
        }
    }
    else {
       // For Market orders, ensure orderType is MARKET explicitly
       order.orderType = 'MARKET';
    }

    try {
      // Send the order via IPC instead of direct WebSocket
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('nt-bridge-send-request', order);
      
      setStatus({
        message: `Sending ${orderType === 'Stop' ? stopOrderSubtype : order.orderType} order for ${qty} ${symbol}...`,
        type: 'success'
      });
    } catch (error) {
      console.error('TradeWindow: Error sending sell order:', error);
      setStatus({
        message: 'Error sending order. Please try again.',
        type: 'error'
      });
    }
  };
  
  // Handle Chart Trader Buy button
  const handleChartTraderBuy = () => {
    console.log(`Chart Trader: Initiating Buy ${chartTraderQuantity} ${symbol} by chart click`);
    
    // Check bridge connection first
    if (!isNTBridgeConnected) {
      console.error('TradeWindow: Cannot initiate chart click order - NinjaTrader Bridge not connected');
      setStatus({
        message: 'Cannot place order: NinjaTrader Bridge is not connected',
        type: 'error'
      });
      return;
    }
    
    // Check for valid account
    if (!accountName) {
      console.error('TradeWindow: Cannot initiate chart click order - No account selected');
      setStatus({
        message: 'Cannot place order: No account selected',
        type: 'error'
      });
      return;
    }
    
    // Check for valid symbol
    if (!symbol) {
      console.error('TradeWindow: Cannot initiate chart click order - No instrument selected');
      setStatus({
        message: 'Cannot place order: No instrument selected',
        type: 'error'
      });
      return;
    }
    
    // Validate quantity
    const qty = parseInt(chartTraderQuantity, 10);
    if (isNaN(qty) || qty < 1) {
      console.error('TradeWindow: Cannot initiate chart click order - Invalid quantity');
      setStatus({
        message: 'Please enter a valid quantity',
        type: 'error'
      });
      return;
    }
    
    try {
      const { ipcRenderer } = window.require('electron');
      
      // Create order data object
      const orderData = {
        action: 'BUY',
        quantity: qty,
        symbol: symbol,
        accountId: accountName,
        orderType: 'LIMIT' // Default to LIMIT for regular chart click orders
      };
      
      console.log('TradeWindow: Sending chart click order request:', orderData);
      
      // Send a message to the main process to initiate chart click order
      ipcRenderer.send('initiate-chart-click-order', orderData);
      
      // Update status to inform user
      setStatus({
        message: `Initiated chart click BUY order for ${qty} ${symbol}. Click on chart to set price...`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error initiating chart click order:', error);
      setStatus({
        message: 'Failed to initiate chart click order. Please try again.',
        type: 'error'
      });
    }
  };
  
  // Handle Chart Trader Sell button
  const handleChartTraderSell = () => {
    console.log(`Chart Trader: Initiating Sell ${chartTraderQuantity} ${symbol} by chart click`);
    
    // Check bridge connection first
    if (!isNTBridgeConnected) {
      console.error('TradeWindow: Cannot initiate chart click order - NinjaTrader Bridge not connected');
      setStatus({
        message: 'Cannot place order: NinjaTrader Bridge is not connected',
        type: 'error'
      });
      return;
    }
    
    // Check for valid account
    if (!accountName) {
      console.error('TradeWindow: Cannot initiate chart click order - No account selected');
      setStatus({
        message: 'Cannot place order: No account selected',
        type: 'error'
      });
      return;
    }
    
    // Check for valid symbol
    if (!symbol) {
      console.error('TradeWindow: Cannot initiate chart click order - No instrument selected');
      setStatus({
        message: 'Cannot place order: No instrument selected',
        type: 'error'
      });
      return;
    }
    
    // Validate quantity
    const qty = parseInt(chartTraderQuantity, 10);
    if (isNaN(qty) || qty < 1) {
      console.error('TradeWindow: Cannot initiate chart click order - Invalid quantity');
      setStatus({
        message: 'Please enter a valid quantity',
        type: 'error'
      });
      return;
    }
    
    try {
      const { ipcRenderer } = window.require('electron');
      
      // Create order data object
      const orderData = {
        action: 'SELL',
        quantity: qty,
        symbol: symbol,
        accountId: accountName,
        orderType: 'LIMIT' // Default to LIMIT for regular chart click orders
      };
      
      console.log('TradeWindow: Sending chart click order request:', orderData);
      
      // Send a message to the main process to initiate chart click order
      ipcRenderer.send('initiate-chart-click-order', orderData);
      
      // Update status to inform user
      setStatus({
        message: `Initiated chart click SELL order for ${qty} ${symbol}. Click on chart to set price...`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error initiating chart click order:', error);
      setStatus({
        message: 'Failed to initiate chart click order. Please try again.',
        type: 'error'
      });
    }
  };
  
  // Handle Chart Trader Buy Stop button
  const handleChartTraderBuyStop = () => {
    console.log(`Chart Trader: Initiating Buy Stop ${chartTraderStopQuantity} ${symbol} by chart click. Market Stop: ${isMarketStop}`);
    
    // Check bridge connection first
    if (!isNTBridgeConnected) {
      console.error('TradeWindow: Cannot initiate chart click stop order - NinjaTrader Bridge not connected');
      setStatus({
        message: 'Cannot place order: NinjaTrader Bridge is not connected',
        type: 'error'
      });
      return;
    }
    
    // Check for valid account
    if (!accountName) {
      console.error('TradeWindow: Cannot initiate chart click stop order - No account selected');
      setStatus({
        message: 'Cannot place order: No account selected',
        type: 'error'
      });
      return;
    }
    
    // Check for valid symbol
    if (!symbol) {
      console.error('TradeWindow: Cannot initiate chart click stop order - No instrument selected');
      setStatus({
        message: 'Cannot place order: No instrument selected',
        type: 'error'
      });
      return;
    }
    
    // Validate quantity
    const qty = parseInt(chartTraderStopQuantity, 10);
    if (isNaN(qty) || qty < 1) {
      console.error('TradeWindow: Cannot initiate chart click stop order - Invalid quantity');
      setStatus({
        message: 'Please enter a valid quantity',
        type: 'error'
      });
      return;
    }
    
    try {
      const { ipcRenderer } = window.require('electron');
      
      // Determine stop order type - ALWAYS use MARKETSTOP (not STOPMARKET)
      const orderType = isMarketStop ? 'MARKETSTOP' : 'LIMITSTOP';
      
      // Create order data object
      const orderData = {
        action: 'BUY',
        quantity: qty,
        symbol: symbol,
        accountId: accountName,
        orderType: orderType // Specify stop order type with correct format
      };
      
      console.log(`TradeWindow: Sending chart click ${orderType} order request:`, orderData);
      
      // Send a message to the main process to initiate chart click order
      ipcRenderer.send('initiate-chart-click-order', orderData);
      
      // Update status to inform user
      setStatus({
        message: `Initiated chart click BUY ${isMarketStop ? 'Market Stop' : 'Stop Limit'} order for ${qty} ${symbol}. Click on chart to set price...`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error initiating chart click stop order:', error);
      setStatus({
        message: 'Failed to initiate chart click stop order. Please try again.',
        type: 'error'
      });
    }
  };
  
  // Handle Chart Trader Sell Stop button
  const handleChartTraderSellStop = () => {
    console.log(`Chart Trader: Initiating Sell Stop ${chartTraderStopQuantity} ${symbol} by chart click. Market Stop: ${isMarketStop}`);
    
    // Check bridge connection first
    if (!isNTBridgeConnected) {
      console.error('TradeWindow: Cannot initiate chart click stop order - NinjaTrader Bridge not connected');
      setStatus({
        message: 'Cannot place order: NinjaTrader Bridge is not connected',
        type: 'error'
      });
      return;
    }
    
    // Check for valid account
    if (!accountName) {
      console.error('TradeWindow: Cannot initiate chart click stop order - No account selected');
      setStatus({
        message: 'Cannot place order: No account selected',
        type: 'error'
      });
      return;
    }
    
    // Check for valid symbol
    if (!symbol) {
      console.error('TradeWindow: Cannot initiate chart click stop order - No instrument selected');
      setStatus({
        message: 'Cannot place order: No instrument selected',
        type: 'error'
      });
      return;
    }
    
    // Validate quantity
    const qty = parseInt(chartTraderStopQuantity, 10);
    if (isNaN(qty) || qty < 1) {
      console.error('TradeWindow: Cannot initiate chart click stop order - Invalid quantity');
      setStatus({
        message: 'Please enter a valid quantity',
        type: 'error'
      });
      return;
    }
    
    try {
      const { ipcRenderer } = window.require('electron');
      
      // Determine stop order type - ALWAYS use MARKETSTOP (not STOPMARKET)
      const orderType = isMarketStop ? 'MARKETSTOP' : 'LIMITSTOP';
      
      // Create order data object
      const orderData = {
        action: 'SELL',
        quantity: qty,
        symbol: symbol,
        accountId: accountName,
        orderType: orderType // Specify stop order type with correct format
      };
      
      console.log(`TradeWindow: Sending chart click ${orderType} order request:`, orderData);
      
      // Send a message to the main process to initiate chart click order
      ipcRenderer.send('initiate-chart-click-order', orderData);
      
      // Update status to inform user
      setStatus({
        message: `Initiated chart click SELL ${isMarketStop ? 'Market Stop' : 'Stop Limit'} order for ${qty} ${symbol}. Click on chart to set price...`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error initiating chart click stop order:', error);
      setStatus({
        message: 'Failed to initiate chart click stop order. Please try again.',
        type: 'error'
      });
    }
  };

  // Handler for Flatten button
  const handleFlatten = () => {
    console.log(`TradeWindow: Flattening position for ${symbol} on account ${accountName}`);
    
    // Check bridge connection first
    if (!isNTBridgeConnected) {
      console.error('TradeWindow: Cannot flatten - NinjaTrader Bridge not connected');
      setStatus({
        message: 'Cannot flatten: NinjaTrader Bridge is not connected',
        type: 'error'
      });
      return;
    }
    
    // Check for valid account
    if (!accountName) {
      console.error('TradeWindow: Cannot flatten - No account selected');
      setStatus({
        message: 'Cannot flatten: No account selected',
        type: 'error'
      });
      return;
    }
    
    // Check for valid symbol
    if (!symbol) {
      console.error('TradeWindow: Cannot flatten - No instrument selected');
      setStatus({
        message: 'Cannot flatten: No instrument selected',
        type: 'error'
      });
      return;
    }
    
    try {
      const { ipcRenderer } = window.require('electron');
      
      // Use the existing 'flattenPosition' command
      const request = {
        type: 'flattenPosition',
        accountId: accountName,
        instrumentSymbol: symbol
      };
      
      // Send via IPC to main process
      ipcRenderer.send('nt-bridge-send-request', request);
      
      // Update status
      setStatus({
        message: `Flattening position for ${symbol}...`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error flattening position:', error);
      setStatus({
        message: 'Failed to flatten position. Please try again.',
        type: 'error'
      });
    }
  };
  
  // Handler for Cancel All Orders button
  const handleCancelAllOrders = () => {
    console.log(`TradeWindow: Cancelling all orders for ${symbol} on account ${accountName}`);
    
    // Check bridge connection first
    if (!isNTBridgeConnected) {
      console.error('TradeWindow: Cannot cancel orders - NinjaTrader Bridge not connected');
      setStatus({
        message: 'Cannot cancel orders: NinjaTrader Bridge is not connected',
        type: 'error'
      });
      return;
    }
    
    // Check for valid account
    if (!accountName) {
      console.error('TradeWindow: Cannot cancel orders - No account selected');
      setStatus({
        message: 'Cannot cancel orders: No account selected',
        type: 'error'
      });
      return;
    }
    
    // Check for valid symbol
    if (!symbol) {
      console.error('TradeWindow: Cannot cancel orders - No instrument selected');
      setStatus({
        message: 'Cannot cancel orders: No instrument selected',
        type: 'error'
      });
      return;
    }
    
    try {
      const { ipcRenderer } = window.require('electron');
      
      // Create a new command for cancel all orders
      const request = {
        type: 'cancel_all_orders',
        accountId: accountName,
        instrumentSymbol: symbol
      };
      
      // Send via IPC to main process
      ipcRenderer.send('nt-bridge-send-request', request);
      
      // Update status
      setStatus({
        message: `Cancelling all orders for ${symbol}...`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error cancelling orders:', error);
      setStatus({
        message: 'Failed to cancel orders. Please try again.',
        type: 'error'
      });
    }
  };

  // Handler for "Modify Orders on Chart" button
  const handleToggleModifyOrdersMode = () => {
    const newModeState = !isModifyingOrdersOnChart;
    setIsModifyingOrdersOnChart(newModeState);
    try {
      const { ipcRenderer } = window.require('electron');
      if (newModeState) {
        console.log('TradeWindow: Starting chart order modification mode.');
        ipcRenderer.send('start-chart-order-modification');
      } else {
        console.log('TradeWindow: Stopping chart order modification mode.');
        ipcRenderer.send('stop-chart-order-modification');
      }
    } catch (error) {
      console.error('TradeWindow: Error sending chart order modification IPC message:', error);
      setStatus({
        message: 'Error communicating with main process for order modification.',
        type: 'error',
      });
    }
  };

  // Report panel state changes to main process
  const reportPanelStateChange = useCallback(() => {
    try {
      const { ipcRenderer } = window.require('electron');
      // Report current state of panels to main process
      ipcRenderer.send('chart-trader-state-changed', activeTab === 'chartTrader');
      ipcRenderer.send('smart-stop-state-changed', activeTab === 'smartStop');
    } catch (error) {
      console.error('TradeWindow: Error reporting panel state change:', error);
    }
  }, [activeTab]);

  // Effect to report panel state changes
  useEffect(() => {
    reportPanelStateChange();
  }, [activeTab, reportPanelStateChange]);

  // Modified toggle functions to switch tabs
  const toggleChartTrader = () => {
    console.log('TradeWindow: Toggling Chart Trader');
    setActiveTab('chartTrader');
  };

  const toggleSmartStop = () => {
    console.log('TradeWindow: Toggling Smart Stop');
    setActiveTab('smartStop');
  };

  // Add handler for trail stop checkbox
  const handleTrailStopEnabledChange = (e) => {
    const newValue = e.target.checked;
    setTrailStopEnabled(newValue);
    
    try {
      const { ipcRenderer } = window.require('electron');
      console.log(`TradeWindow: Setting Trail Stop Enabled to ${newValue}, points: ${trailStopPoints}`);
      
      // Notify Trade Manager about the setting change
      ipcRenderer.send('smart-stop-settings-changed', {
        trailStopEnabled: newValue,
        trailStopPoints: parseInt(trailStopPoints, 10) || 5,
        stopQtyFollowsPosition, // Include existing setting
        // Include candle stop settings
        candleStopEnabled,
        candleTimeframe,
        candleType
      });
      
      // Show a status message to confirm the change
      setStatus({
        message: `Smart Stop: Price trailing ${newValue ? 'enabled' : 'disabled'}`,
        type: 'success'
      });
    } catch (error) {
      console.error('TradeWindow: Error sending smart-stop-settings-changed IPC message:', error);
      setStatus({
        message: `Error updating Smart Stop settings: ${error.message}`,
        type: 'error'
      });
    }
  };

  // Add handler for trail stop points input
  const handleTrailStopPointsChange = (e) => {
    const value = e.target.value;
    // Allow empty string or numbers only
    if (value === '' || /^\d+$/.test(value)) {
      setTrailStopPoints(value);
      
      // Always send updated settings to maintain consistency
      try {
        const { ipcRenderer } = window.require('electron');
        const points = parseInt(value, 10) || 5;
        console.log(`TradeWindow: Updating Trail Stop Points to ${points}`);
        
        // Notify Trade Manager about the setting change
        ipcRenderer.send('smart-stop-settings-changed', {
          trailStopEnabled,
          trailStopPoints: points,
          stopQtyFollowsPosition, // Include existing setting
          candleStopEnabled,
          candleTimeframe,
          candleType
        });
      } catch (error) {
        console.error('TradeWindow: Error sending smart-stop-settings-changed IPC message:', error);
      }
    }
  };

  // Add handler for candle stop enabled checkbox
  const handleCandleStopEnabledChange = (e) => {
    const newValue = e.target.checked;
    setCandleStopEnabled(newValue);
    
    try {
      const { ipcRenderer } = window.require('electron');
      console.log(`TradeWindow: Setting Stop by Candle Enabled to ${newValue}, timeframe: ${candleTimeframe}, type: ${candleType}`);
      
      // Notify Trade Manager about the setting change
      ipcRenderer.send('smart-stop-settings-changed', {
        candleStopEnabled: newValue,
        candleTimeframe: candleTimeframe,
        candleType: candleType,
        stopQtyFollowsPosition, // Include existing settings
        trailStopEnabled,
        trailStopPoints: parseInt(trailStopPoints, 10) || 5
      });
      
      // Show a status message to confirm the change
      setStatus({
        message: `Smart Stop: Candle trailing ${newValue ? 'enabled' : 'disabled'}`,
        type: 'success'
      });
    } catch (error) {
      console.error('TradeWindow: Error sending smart-stop-settings-changed IPC message:', error);
      setStatus({
        message: `Error updating Smart Stop settings: ${error.message}`,
        type: 'error'
      });
    }
  };

  // Add handler for candle timeframe change
  const handleCandleTimeframeChange = (e) => {
    const newValue = e.target.value;
    setCandleTimeframe(newValue);
    
    // Always send updated settings to maintain consistency
    try {
      const { ipcRenderer } = window.require('electron');
      console.log(`TradeWindow: Updating Stop by Candle timeframe to ${newValue}`);
      
      // Notify Trade Manager about the setting change
      ipcRenderer.send('smart-stop-settings-changed', {
        candleStopEnabled,
        candleTimeframe: newValue,
        candleType,
        stopQtyFollowsPosition, // Include existing settings
        trailStopEnabled,
        trailStopPoints: parseInt(trailStopPoints, 10) || 5
      });
    } catch (error) {
      console.error('TradeWindow: Error sending smart-stop-settings-changed IPC message:', error);
    }
  };

  // Add handler for candle type change
  const handleCandleTypeChange = (e) => {
    const newValue = e.target.value;
    setCandleType(newValue);
    
    // Always send updated settings to maintain consistency
    try {
      const { ipcRenderer } = window.require('electron');
      console.log(`TradeWindow: Updating Stop by Candle type to ${newValue}`);
      
      // Notify Trade Manager about the setting change
      ipcRenderer.send('smart-stop-settings-changed', {
        candleStopEnabled,
        candleTimeframe,
        candleType: newValue,
        stopQtyFollowsPosition, // Include existing settings
        trailStopEnabled,
        trailStopPoints: parseInt(trailStopPoints, 10) || 5
      });
    } catch (error) {
      console.error('TradeWindow: Error sending smart-stop-settings-changed IPC message:', error);
    }
  };

  // Add handler for Cancel All Orders On Close/Reverse checkbox
  const handleCancelOrdersOnCloseReverseChange = (e) => {
    const newValue = e.target.checked;
    setCancelOrdersOnCloseReverse(newValue);
    
    try {
      const { ipcRenderer } = window.require('electron');
      console.log(`TradeWindow: Setting Cancel All Orders On Close/Reverse to ${newValue}`);
      
      // Notify Trade Manager about the setting change
      ipcRenderer.send('smart-stop-settings-changed', {
        cancelOrdersOnCloseReverse: newValue,
        // Include existing settings
        stopQtyFollowsPosition,
        trailStopEnabled,
        trailStopPoints: parseInt(trailStopPoints, 10) || 5,
        candleStopEnabled,
        candleTimeframe,
        candleType
      });
      
      // Show a status message to confirm the change
      setStatus({
        message: `Smart Stop: Cancel orders on close/reverse ${newValue ? 'enabled' : 'disabled'}`,
        type: 'success'
      });
    } catch (error) {
      console.error('TradeWindow: Error sending smart-stop-settings-changed IPC message:', error);
      setStatus({
        message: `Error updating Smart Stop settings: ${error.message}`,
        type: 'error'
      });
    }
  };





  // --- Render JSX --- 
  console.log(`TradeWindow: Rendering with activeTab: ${activeTab}, isConnected: ${isConnected}, accountName: '${accountName}'`);
  
  return (
    <TradeWindowContainer>
      <MainContent>
        <TradingPanel>
          <Header>
            <HeaderLeft>
              <HeaderTitle>Trade</HeaderTitle>
            </HeaderLeft>
            <HeaderCenter>
              <SymbolText>{symbol || '---'}</SymbolText>
              {price > 0 && <PriceText>{price.toFixed(2)}</PriceText>}
            </HeaderCenter>
            <HeaderAccount isConnected={isConnected && !!accountName}>
              {accountName || (isConnected ? 'Connecting...' : 'Disconnected')}
            </HeaderAccount>
          </Header>
          
          <Form>
            {/* Order Type Selector - unchanged */}
            <FormGroup>
              <Label htmlFor="order-type">Order Type:</Label>
              <Select 
                id="order-type"
                value={orderType}
                onChange={(e) => {
                  const newType = e.target.value;
                  setOrderType(newType);
                  // Reset/set defaults when switching to/from Limit/Stop
                  if (newType === 'Limit') {
                    setLimitPriceInput(price > 0 ? price.toString() : ''); // Default to current price if available
                    setLimitOrderSubtype('Limit'); // Default to Limit subtype
                    setStopPriceInput(''); // Clear stop price
                  } else if (newType === 'Stop') {
                    setStopPriceInput(price > 0 ? price.toString() : ''); // Default to current price if available
                    setStopOrderSubtype('Limit Stop'); // Default to Limit Stop
                    setLimitPriceInput(''); // Clear limit price
                  } else { // Market or others
                    setLimitPriceInput('');
                    setStopPriceInput('');
                  }
                }}
              >
                <option value="Market">Market</option>
                <option value="Limit">Limit</option>
                <option value="Stop">Stop</option> {/* Added Stop */}
              </Select>
            </FormGroup>

            {/* Conditional rendering based on order type */}
            {orderType === 'Market' && (
              <>
                {/* <SectionTitle>Market Order</SectionTitle> Removed Title */}
                <ButtonGroup>
                  <Button
                    color="#4CAF50"
                    onClick={handleBuy}
                    disabled={!isConnected || !symbol || !accountName}
                  >
                    BUY
                  </Button>

                  <QtyInput
                    type="text"
                    value={quantity}
                    onChange={handleQuantityChange}
                    placeholder="QTY"
                  />

                  <Button
                    color="#F44336"
                    onClick={handleSell}
                    disabled={!isConnected || !symbol}
                  >
                    SELL
                  </Button>
                </ButtonGroup>
              </>
            )}

            {(orderType === 'Limit') && ( // Changed condition to check specifically for 'Limit'
               <>
                {/* Limit Subtype and Price Input */}
                <LimitSubtypeGroup>
                  <LimitSubtypeSelect
                    id="limit-order-subtype"
                    value={limitOrderSubtype}
                    onChange={(e) => setLimitOrderSubtype(e.target.value)}
                  >
                    <option value="Limit">LIM</option>
                    <option value="MIT">MIT</option>
                  </LimitSubtypeSelect>
                  <LimitPriceInput
                    id="limit-price"
                    type="number" // Use number type for better input control
                    step="any" // Allow decimal prices
                    value={limitPriceInput}
                    onChange={(e) => setLimitPriceInput(e.target.value)}
                    placeholder="Limit Price"
                  />
                </LimitSubtypeGroup>

                {/* Conditionally show Buy/Sell or Not Supported based on *value* */}
                {limitOrderSubtype === 'Limit' ? (
                  <ButtonGroup>
                    <Button
                      color="#4CAF50"
                      onClick={handleBuy}
                      disabled={!isConnected || !symbol || !accountName || !limitPriceInput}
                    >
                      BUY LIM
                    </Button>
                    <QtyInput
                      type="text"
                      value={quantity}
                      onChange={handleQuantityChange}
                      placeholder="QTY"
                    />
                    <Button
                      color="#F44336"
                      onClick={handleSell}
                      disabled={!isConnected || !symbol || !accountName || !limitPriceInput}
                    >
                      SELL LIM
                    </Button>
                  </ButtonGroup>
                ) : limitOrderSubtype === 'MIT' ? (
                  <NotImplemented>
                    MIT orders not supported yet.
                  </NotImplemented>
                ) : null /* Should not happen, but good practice */ }
               </>
            )}

            {/* Added Stop Order Section */}
            {orderType === 'Stop' && (
               <>
                 <StopSubtypeGroup>
                   <StopSubtypeSelect
                     id="stop-order-subtype"
                     value={stopOrderSubtype}
                     onChange={(e) => setStopOrderSubtype(e.target.value)}
                   >
                     <option value="Limit Stop">Limit Stop</option>
                     <option value="Market Stop">Market Stop</option>
                   </StopSubtypeSelect>
                   <StopPriceInput
                     id="stop-price"
                     type="number"
                     step="any"
                     value={stopPriceInput}
                     onChange={(e) => setStopPriceInput(e.target.value)}
                     placeholder="Stop Price"
                   />
                 </StopSubtypeGroup>

                 <ButtonGroup>
                   <Button
                     color="#4CAF50"
                     onClick={handleBuy}
                     disabled={!isConnected || !symbol || !accountName || !stopPriceInput}
                   >
                     BUY Stop
                     <SmallText>(close short)</SmallText>
                   </Button>
                   <QtyInput
                     type="text"
                     value={quantity}
                     onChange={handleQuantityChange}
                     placeholder="QTY"
                   />
                   <Button
                     color="#F44336"
                     onClick={handleSell}
                     disabled={!isConnected || !symbol || !accountName || !stopPriceInput}
                   >
                     SELL Stop
                     <SmallText>(close long)</SmallText>
                   </Button>
                 </ButtonGroup>
               </>
            )}

            {/* Position Management Buttons */}
            <PositionActionGroup>
              <Button
                color="#777777"
                onClick={handleCancelAllOrders}
                disabled={!isConnected || !symbol || !accountName}
              >
                Cancel Orders
              </Button>
              <Button
                color="#777777"
                onClick={handleFlatten}
                disabled={!isConnected || !symbol || !accountName}
              >
                Flatten
              </Button>
            </PositionActionGroup>

            {/* Added checkbox for Cancel All Orders On Close/Reverse */}
            <CheckboxContainer style={{ marginTop: '10px', marginBottom: '10px' }}>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={cancelOrdersOnCloseReverse}
                  onChange={handleCancelOrdersOnCloseReverseChange}
                />
                Cancel all orders on close/reverse
              </CheckboxLabel>
            </CheckboxContainer>

            <StatusMessage
              visible={!!status.message}
              success={status.type === 'success'}
              error={status.type === 'error'}
            >
              {status.message}
            </StatusMessage>
          </Form>
        </TradingPanel>
        
        {/* Tabs for right panel */}
        <TabsContainer>
          <Tab 
            active={activeTab === 'chartTrader'} 
            onClick={() => setActiveTab('chartTrader')}
          >
            Chart Trader
          </Tab>
          <Tab 
            active={activeTab === 'smartStop'} 
            onClick={() => setActiveTab('smartStop')}
          >
            Smart Stop
          </Tab>
          <Tab 
            active={activeTab === 'tradeBoss'} 
            onClick={() => setActiveTab('tradeBoss')}
          >
            Trade Boss
          </Tab>
        </TabsContainer>
        
        {/* Right panels - render based on activeTab instead of showing/hiding */}
        {activeTab === 'chartTrader' && (
          <ChartTraderPanel>
            <ChartTraderContainer>
              <ChartTraderHeader>
                <span>Chart Trader</span>
                <HeaderIcon src={tradeTheChartIcon} alt="Trade the Chart Icon" />
              </ChartTraderHeader>
              
              <ChartTraderSection>
                <ChartTraderSectionTitle>Chart Limit Order</ChartTraderSectionTitle>
                <ChartTraderButtonGroup>
                  <Button
                    color="#4CAF50"
                    onClick={handleChartTraderBuy}
                    disabled={!isConnected || !symbol || !accountName}
                    style={{ padding: '5px', fontSize: '12px' }}
                  >
                    Buy
                  </Button>
                  <CompactQtyInput
                    id="chart-trader-qty"
                    type="text"
                    value={chartTraderQuantity}
                    onChange={handleChartTraderQuantityChange}
                    placeholder="QTY"
                  />
                  <Button
                    color="#F44336"
                    onClick={handleChartTraderSell}
                    disabled={!isConnected || !symbol || !accountName}
                    style={{ padding: '5px', fontSize: '12px' }}
                  >
                    Sell
                  </Button>
                </ChartTraderButtonGroup>
              </ChartTraderSection>
              
              {/* Chart Stop Order Section */}
              <ChartTraderSection>
                <ChartTraderSectionTitle>Chart Stop Order</ChartTraderSectionTitle>
                <CheckboxContainer>
                  <CheckboxLabel>
                    <Checkbox
                      type="checkbox"
                      checked={isMarketStop}
                      onChange={handleMarketStopChange} 
                    />
                    Market Stop
                  </CheckboxLabel>
                </CheckboxContainer>
                <ChartTraderButtonGroup>
                  <Button
                    color="#4CAF50"
                    onClick={handleChartTraderBuyStop}
                    disabled={!isConnected || !symbol || !accountName}
                    style={{ padding: '5px', fontSize: '12px' }}
                  >
                    Buy Stop
                  </Button>
                  <CompactQtyInput
                    id="chart-trader-stop-qty"
                    type="text"
                    value={chartTraderStopQuantity}
                    onChange={handleChartTraderStopQuantityChange}
                    placeholder="QTY"
                  />
                  <Button
                    color="#F44336"
                    onClick={handleChartTraderSellStop}
                    disabled={!isConnected || !symbol || !accountName}
                    style={{ padding: '5px', fontSize: '12px' }}
                  >
                    Sell Stop
                  </Button>
                </ChartTraderButtonGroup>
              </ChartTraderSection>
              
              {/* Modify Orders on Chart Section */}
              <ChartTraderSection>
                <ChartTraderSectionTitle>Modify Orders</ChartTraderSectionTitle>
                <ChartTraderButton
                  color={isModifyingOrdersOnChart ? '#FFA500' : '#007bff'} 
                  onClick={handleToggleModifyOrdersMode}
                  disabled={!isConnected || !symbol || !accountName}
                >
                  {isModifyingOrdersOnChart ? 'Done Modifying Orders' : 'Modify Orders on Chart'}
                </ChartTraderButton>
              </ChartTraderSection>
            </ChartTraderContainer>
          </ChartTraderPanel>
        )}

        {activeTab === 'smartStop' && (
          <SmartStopPanel>
            <SmartStopContainer>
              <SmartStopHeader>
                <span>Smart Stop Management</span>
                <HeaderIcon src={smartstopIcon} alt="Smart Stop Icon" />
              </SmartStopHeader>
              
              {/* Position Quantity Tracking */}
              <SmartStopSection>
                <SmartStopSectionTitle>Stop Quantity Management</SmartStopSectionTitle>
                
                <CheckboxContainer>
                  <CheckboxLabel>
                    <Checkbox
                      type="checkbox"
                      checked={stopQtyFollowsPosition}
                      onChange={handleStopQtyFollowsPositionChange}
                    />
                    Stop Qty Follows Position Qty
                    <Tooltip text="When enabled, stop orders will automatically adjust their quantity to match the position." />
                  </CheckboxLabel>
                </CheckboxContainer>
              </SmartStopSection>
              
              {/* Trail Stop Section */}
              <SmartStopSection>
                <SmartStopSectionTitle>Trailing Stop</SmartStopSectionTitle>
                
                <CheckboxContainer>
                  <CheckboxLabel>
                    <Checkbox
                      type="checkbox"
                      checked={trailStopEnabled}
                      onChange={handleTrailStopEnabledChange}
                    />
                    Trail Stop
                    <Tooltip text="When enabled, stop orders will trail price by the specified points." />
                  </CheckboxLabel>
                </CheckboxContainer>
                
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px', marginBottom: '4px' }}>
                  <Label style={{ marginRight: '10px', marginBottom: '0' }}>Points:</Label>
                  <Input
                    type="number"
                    value={trailStopPoints}
                    onChange={handleTrailStopPointsChange}
                    style={{ width: '60px', padding: '4px 8px' }}
                  />
                </div>
              </SmartStopSection>
              
              {/* Stop by Candle Section */}
              <SmartStopSection>
                <SmartStopSectionTitle>Stop by Candle</SmartStopSectionTitle>
                
                <CheckboxContainer>
                  <CheckboxLabel>
                    <Checkbox
                      type="checkbox"
                      checked={candleStopEnabled}
                      onChange={handleCandleStopEnabledChange}
                    />
                    Trail Stop to Back-Side of last
                    <Tooltip text="When enabled, stop orders will trail to the back-side of closed candles." />
                  </CheckboxLabel>
                </CheckboxContainer>
                
                <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0' }}>
                  <Select 
                    value={candleTimeframe} 
                    onChange={handleCandleTimeframeChange}
                    style={{ width: '70px', padding: '4px 8px', marginRight: '8px' }}
                  >
                    <option value="1m">1m</option>
                    <option value="5m">5m</option>
                    <option value="10m">10m</option>
                    <option value="15m">15m</option>
                    <option value="30m">30m</option>
                    <option value="1h">1h</option>
                    <option value="4h">4h</option>
                    <option value="1d">1d</option>
                  </Select>
                  
                  <Select 
                    value={candleType} 
                    onChange={handleCandleTypeChange}
                    style={{ width: '120px', padding: '4px 8px' }}
                  >
                    <option value="green">green</option>
                    <option value="red">red</option>
                    <option value="any">any</option>
                  </Select>
                  
                  <Label style={{ marginLeft: '8px' }}>candle</Label>
                </div>
              </SmartStopSection>
            </SmartStopContainer>
          </SmartStopPanel>
        )}

        {activeTab === 'tradeBoss' && (
          <TradeBossPanel
            // Trade Boss state
            tradePlan={tradeBoss.tradePlan}
            setTradePlan={tradeBoss.setTradePlan}
            stopLossPoints={tradeBoss.stopLossPoints}
            setStopLossPoints={tradeBoss.setStopLossPoints}
            scaleOutQty={tradeBoss.scaleOutQty}
            setScaleOutQty={tradeBoss.setScaleOutQty}
            scaleOutPoints={tradeBoss.scaleOutPoints}
            setScaleOutPoints={tradeBoss.setScaleOutPoints}
            scaleOutUnit={tradeBoss.scaleOutUnit}
            setScaleOutUnit={tradeBoss.setScaleOutUnit}
            tradeBossQuantity={tradeBoss.tradeBossQuantity}
            setTradeBossQuantity={tradeBoss.setTradeBossQuantity}
            
            // Connection and trading state
            isConnected={isConnected}
            symbol={symbol}
            accountName={accountName}
            
            // Event handlers
            onGoLong={tradeBoss.handleGoLong}
            onGoShort={tradeBoss.handleGoShort}
          />
        )}
      </MainContent>
    </TradeWindowContainer>
  );
}

export default TradeWindow; 