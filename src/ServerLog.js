// src/ServerLog.js
import React from 'react';
import './ServerLog.css'; // We�ll create this next
import serverMsgsIcon from './images/servermsgs-icon.png';

const ServerLog = ({ logs, onClose }) => {
    const copyToClipboard = (message) => {
        const textToCopy = typeof message === 'object' 
            ? JSON.stringify(message, null, 2) 
            : message.toString();
        
        navigator.clipboard.writeText(textToCopy)
            .catch(err => console.error('Failed to copy: ', err));
    };

    return (
        <div className="server-log-overlay">
            <div className="server-log-panel">
                <div className="server-log-header">
                    <div className="header-title">
                        <img 
                            src={serverMsgsIcon} 
                            alt="Server Messages" 
                            className="server-log-icon" 
                            width="30" 
                        />
                        <h2>Server Messages</h2>
                    </div>
                    <button className="close-button" onClick={onClose}>
                        X
                    </button>
                </div>
                <div className="server-log-content">
                    {logs.map((log, index) => (
                        <div key={index} className="log-entry">
                            <div className="log-entry-header">
                                <span className="log-timestamp">
                                    {new Date(log.timestamp).toLocaleString()}
                                </span>
                                <button 
                                    className="copy-button" 
                                    onClick={() => copyToClipboard(log.message)}
                                    title="Copy to clipboard"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </button>
                            </div>
                            <pre className="log-message">
                                {typeof log.message === 'object' 
                                    ? JSON.stringify(log.message, null, 2) 
                                    : log.message}
                            </pre>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ServerLog;