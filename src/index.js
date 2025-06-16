import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import TradeManager from './components/TradeManager';
import TradeWindow from './components/TradeWindow';
import reportWebVitals from './reportWebVitals';

// Parse query parameters to determine which component to render
const urlParams = new URLSearchParams(window.location.search);
const view = urlParams.get('view');

const root = ReactDOM.createRoot(document.getElementById('root'));

// Determine the component to render
let ComponentToRender;
if (view === 'tradeManager') {
  ComponentToRender = TradeManager;
} else if (view === 'tradeWindow') {
  ComponentToRender = TradeWindow;
} else {
  ComponentToRender = App;
}

// Render without Redux Provider
root.render(
  <React.StrictMode>
    <ComponentToRender />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
