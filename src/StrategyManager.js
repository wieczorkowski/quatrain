import React, { useState, useEffect } from 'react';
import './StrategyManager.css';
import strategyIcon from './images/strategymgr-icon.png';

const StrategyManager = ({ strategies, onClose, ws, clientId, instrument, clearAndRefreshStrategy, strategyAnnotationCounts = {} }) => {
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    // Track pending state changes for optimistic UI updates
    const [pendingSubscriptions, setPendingSubscriptions] = useState([]);
    const [pendingUnsubscriptions, setPendingUnsubscriptions] = useState([]);
    
    // Create the full client ID by adding the prefix
    const fullClientId = `quatrain-${clientId}`;
    
    // Debug logs
    console.log("StrategyManager - strategies received:", strategies);
    console.log("StrategyManager - current clientId:", clientId);
    console.log("StrategyManager - full clientId used for comparison:", fullClientId);
    console.log("StrategyManager - pending subscriptions:", pendingSubscriptions);
    console.log("StrategyManager - pending unsubscriptions:", pendingUnsubscriptions);
    
    // Apply optimistic updates to the subscription status
    const subscribedStrategies = strategies.filter(strategy => {
        // Check if we're pending a subscription (optimistic UI)
        if (pendingSubscriptions.includes(strategy.clientid)) {
            return true;
        }
        
        // Check if we're pending an unsubscription (optimistic UI)
        if (pendingUnsubscriptions.includes(strategy.clientid)) {
            return false;
        }
        
        // Normal subscription check logic
        if (!strategy.subscribers) {
            return false;
        }
        
        if (!strategy.subscribers.subscribers) {
            return false;
        }
        
        if (!Array.isArray(strategy.subscribers.subscribers)) {
            return false;
        }
        
        return strategy.subscribers.subscribers.includes(fullClientId);
    });
    
    // Available strategies are those the client is not subscribed to
    const availableStrategies = strategies.filter(strategy => 
        !subscribedStrategies.includes(strategy)
    );

    const handleSubscribe = (strategy) => {
        // Send subscription request to the server
        if (ws) {
            ws.send(JSON.stringify({
                action: 'sub_strat',
                clientid: fullClientId,
                stratid: strategy.clientid
            }));
            console.log(`Subscribing to strategy: ${strategy.name} (${strategy.clientid})`);
            
            // Optimistic UI update
            setPendingSubscriptions(prev => [...prev, strategy.clientid]);
            setPendingUnsubscriptions(prev => prev.filter(id => id !== strategy.clientid));
        }
    };

    const handleRefresh = (strategy) => {
        if (ws && clearAndRefreshStrategy) {
            console.log(`Refreshing annotations for strategy: ${strategy.name} (${strategy.clientid})`);
            
            // First clear any existing annotations for this strategy
            clearAndRefreshStrategy(strategy.clientid);
            
            // Then request new annotations
            ws.send(JSON.stringify({
                action: 'get_anno',
                clienttype: 'strategy',
                clientid: strategy.clientid,
                instrument: instrument
            }));
        }
    };

    const handleUnsubscribe = (strategy) => {
        // Send unsubscription request to the server
        if (ws) {
            ws.send(JSON.stringify({
                action: 'unsub_strat',
                clientid: fullClientId,
                stratid: strategy.clientid
            }));
            console.log(`Unsubscribing from strategy: ${strategy.name} (${strategy.clientid})`);
            
            // Optimistic UI update
            setPendingUnsubscriptions(prev => [...prev, strategy.clientid]);
            setPendingSubscriptions(prev => prev.filter(id => id !== strategy.clientid));
            
            // Clear any annotations for this strategy from the charts
            if (clearAndRefreshStrategy) {
                clearAndRefreshStrategy(strategy.clientid);
            }
        }
    };

    // Reset pending state when we receive new strategy data
    useEffect(() => {
        setPendingSubscriptions([]);
        setPendingUnsubscriptions([]);
    }, [strategies]);

    const handleStrategySelect = (strategy) => {
        setSelectedStrategy(strategy);
    };

    return (
        <div className="strategy-manager-overlay">
            <div className="strategy-manager-panel">
                <div className="strategy-manager-header">
                    <div className="header-title">
                        <img 
                            src={strategyIcon} 
                            alt="Strategy Manager" 
                            className="strategy-manager-icon" 
                            width="30" 
                        />
                        <h2>Strategy Manager</h2>
                    </div>
                    <button className="close-button" onClick={onClose}>
                        X
                    </button>
                </div>
                
                <div className="strategy-section">
                    <h3>Subscribed Strategies</h3>
                    <div className="strategy-list">
                        {subscribedStrategies.length > 0 ? (
                            subscribedStrategies.map((strategy) => (
                                <div 
                                    key={strategy.clientid} 
                                    className={`strategy-item ${selectedStrategy?.clientid === strategy.clientid ? 'selected' : ''}`}
                                    onClick={() => handleStrategySelect(strategy)}
                                >
                                    <div className="strategy-info">
                                        <div className="strategy-name">
                                            {strategy.name} 
                                            <span className="strategy-clientid">[{strategy.clientid}]</span>
                                        </div>
                                        <div className="strategy-description">{strategy.description}</div>
                                        <div className="strategy-annotation-count">
                                            Annotations: {strategyAnnotationCounts[strategy.clientid] || 0}
                                        </div>
                                    </div>
                                    <div className="strategy-buttons">
                                        <button 
                                            className="refresh-button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRefresh(strategy);
                                            }}
                                            style={{ marginRight: '8px' }}
                                        >
                                            Refresh
                                        </button>
                                        <button 
                                            className="unsubscribe-button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUnsubscribe(strategy);
                                            }}
                                        >
                                            Unsubscribe
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="no-strategies">No subscribed strategies</div>
                        )}
                    </div>
                </div>
                
                <div style={{ margin: '20px 0' }}></div>
                
                <div className="strategy-section">
                    <h3>Available Strategies</h3>
                    <div className="strategy-list">
                        {availableStrategies.length > 0 ? (
                            availableStrategies.map((strategy) => (
                                <div 
                                    key={strategy.clientid} 
                                    className={`strategy-item ${selectedStrategy?.clientid === strategy.clientid ? 'selected' : ''}`}
                                    onClick={() => handleStrategySelect(strategy)}
                                >
                                    <div className="strategy-info">
                                        <div className="strategy-name">
                                            {strategy.name} 
                                            <span className="strategy-clientid">[{strategy.clientid}]</span>
                                        </div>
                                        <div className="strategy-description">{strategy.description}</div>
                                        <div className="strategy-annotation-count">
                                            Annotations: {strategyAnnotationCounts[strategy.clientid] || 0}
                                        </div>
                                    </div>
                                    <button 
                                        className="subscribe-button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSubscribe(strategy);
                                        }}
                                    >
                                        Subscribe
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="no-strategies">No available strategies</div>
                        )}
                    </div>
                </div>
                
                {selectedStrategy && (
                    <div className="strategy-details">
                        <h3>Strategy Details</h3>
                        <div className="details-content">
                            <div className="detail-row">
                                <span className="detail-label">Client ID:</span>
                                <span className="detail-value">{selectedStrategy.clientid}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Name:</span>
                                <span className="detail-value">{selectedStrategy.name}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Description:</span>
                                <span className="detail-value">{selectedStrategy.description}</span>
                            </div>
                            {selectedStrategy.parameters && (
                                <div className="detail-row">
                                    <span className="detail-label">Parameters:</span>
                                    <span className="detail-value">
                                        <pre>{JSON.stringify(selectedStrategy.parameters, null, 2)}</pre>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StrategyManager; 