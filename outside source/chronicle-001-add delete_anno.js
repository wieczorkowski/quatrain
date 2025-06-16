// chronicle.js - WebSocket server back-end for trading/charting software

const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Chronicle Back-end Version Level - for developer reference
const CHRONICLE_VERSION = '0.1.3' // Last revision for shortening heartbeat messages

// Configuration
const WS_PORT = 8080;
const DB_PATH = './chronicle_data.db';
const LOG_DIR = './logs';

// Constants for easy configuration
const DEFAULT_DATA_RANGE_MINUTES = 86400;  // 60 days in minutes
const EARLY_CANDLE_CUSHION_MINUTES = 4320;  // 3 days in minutes
const LATE_CANDLE_CUSHION_MINUTES = 180;    // 3 hours in minutes
const DEFAULT_TIMEZONE = 'America/New_York';  // Eastern Time

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

// Initialize SQLite database with PRAGMA optimizations
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Failed to connect to SQLite database:', err.message);
        process.exit(1);
    }
    console.log('Connected to SQLite database at', DB_PATH);
});

// Apply PRAGMA settings for performance
db.serialize(() => {
    db.run('PRAGMA journal_mode = WAL;', (err) => {
        if (err) console.error('Failed to set journal_mode to WAL:', err);
        else console.log('Set journal_mode to WAL');
    });
    db.run('PRAGMA synchronous = NORMAL;', (err) => {
        if (err) console.error('Failed to set synchronous to NORMAL:', err);
        else console.log('Set synchronous to NORMAL');
    });
    db.run('PRAGMA cache_size = -131072;', (err) => {  // 128MB cache
        if (err) console.error('Failed to set cache_size:', err);
        else console.log('Set cache_size to 128MB');
    });
});

// Set up database tables
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS CANDLES (
            instrument TEXT,
            timeframe TEXT,
            timestamp INTEGER,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume INTEGER,
            PRIMARY KEY (instrument, timeframe, timestamp)
        )
    `, (err) => {
        if (err) console.error('Error creating CANDLES table:', err.message);
        else console.log('CANDLES table ready');
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS SYSTEM_SETTINGS (
            setting_name TEXT PRIMARY KEY,
            setting_value TEXT
        )
    `, (err) => {
        if (err) console.error('Error creating SYSTEM_SETTINGS table:', err.message);
        else console.log('SYSTEM_SETTINGS table ready');
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS CLIENT_SETTINGS (
            client_id TEXT PRIMARY KEY,
            client_settings TEXT
        )
    `, (err) => {
        if (err) console.error('Error creating CLIENT_SETTINGS table:', err.message);
        else console.log('CLIENT_SETTINGS table ready');
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS ANNOTATIONS (
            client_id TEXT,
            instrument TEXT,
            timeframe TEXT,
            annotype TEXT,
            unique_id TEXT,
            object TEXT,
            PRIMARY KEY (client_id, unique_id)
        )
    `, (err) => {
        if (err) console.error('Error creating ANNOTATIONS table:', err.message);
        else console.log('ANNOTATIONS table ready');
    });
});

// Initialize WebSocket server
const wss = new WebSocket.Server({ port: WS_PORT }, () => {
    console.log(`\n********\n*** CHRONICLE Data Manager Back-End WS Server, version ${CHRONICLE_VERSION} \n********\n`);
    console.log(`WebSocket server running on ws://localhost:${WS_PORT}`);
});

// Utility functions
function getSettings(settingName) {
    return new Promise((resolve, reject) => {
        db.get('SELECT setting_value FROM SYSTEM_SETTINGS WHERE setting_name = ?', [settingName], (err, row) => {
            if (err) reject(err);
            else resolve(row ? JSON.parse(row.setting_value) : null);
        });
    });
}

// Helper function to parse timeframe strings into milliseconds
function parseTimeframeMs(timeframe) {
    const match = timeframe.match(/^(\d+)([mhd])$/);
    if (!match) {
        throw new Error(`Invalid timeframe format: ${timeframe}. Expected format like '1m', '5m', '1h', '4h', '1d'.`);
    }
    const value = parseInt(match[1]);
    const unit = match[2];
    let multiplier;
    if (unit === 'm') multiplier = 60 * 1000; // minutes to milliseconds
    else if (unit === 'h') multiplier = 60 * 60 * 1000; // hours to milliseconds
    else if (unit === 'd') multiplier = 24 * 60 * 60 * 1000; // days to milliseconds
    return value * multiplier;
}

// Aggregate candles from 1m data to the requested timeframe with hybrid "isClosed" logic
function aggregateCandles(instrument, timeframe, start, end, candles1m) {
    console.log(`Starting aggregation for ${instrument} to ${timeframe}`);
    const aggStartTime = Date.now();

    if (timeframe === '1m') {
        const result = candles1m.filter(c => c.timestamp >= start && c.timestamp <= end);
        const aggEndTime = Date.now();
        console.log(`Aggregated ${result.length} candles for ${instrument} to ${timeframe} in ${aggEndTime - aggStartTime} ms`);
        return result;
    }

    const intervalMs = parseTimeframeMs(timeframe);
    const maxTs = Math.max(...candles1m.map(c => c.timestamp));  // Latest 1m candle timestamp
    const result = [];
    let currentCandle = null;
    let currentCandleTimestamps = [];  // Track 1m timestamps within the candle

    candles1m.sort((a, b) => a.timestamp - b.timestamp);
    for (const candle1m of candles1m) {
        const baseTime = Math.floor(candle1m.timestamp / intervalMs) * intervalMs;
        if (!currentCandle || baseTime !== currentCandle.timestamp) {
            if (currentCandle) {
                const lastPossibleTs = currentCandle.timestamp + intervalMs - 60000;  // Last 1m slot (e.g., 20:59 for 20:55�20:59)
                const hasLastPossible = currentCandleTimestamps.includes(lastPossibleTs);
                const hasLaterData = maxTs >= currentCandle.timestamp + intervalMs;
                currentCandle.isClosed = hasLaterData || hasLastPossible;  // Closed if either condition is true
                result.push(currentCandle);
            }
            currentCandle = {
                timestamp: baseTime,
                open: candle1m.open,
                high: candle1m.high,
                low: candle1m.low,
                close: candle1m.close,
                volume: candle1m.volume,
                instrument,
                timeframe,
                source: 'A'
            };
            currentCandleTimestamps = [candle1m.timestamp];
        } else {
            currentCandle.high = Math.max(currentCandle.high, candle1m.high);
            currentCandle.low = Math.min(currentCandle.low, candle1m.low);
            currentCandle.close = candle1m.close;
            currentCandle.volume += candle1m.volume;
            currentCandleTimestamps.push(candle1m.timestamp);
        }
    }
    if (currentCandle) {
        const lastPossibleTs = currentCandle.timestamp + intervalMs - 60000;
        const hasLastPossible = currentCandleTimestamps.includes(lastPossibleTs);
        const hasLaterData = maxTs >= currentCandle.timestamp + intervalMs;
        currentCandle.isClosed = hasLaterData || hasLastPossible;  // Apply the same logic to the last candle
        result.push(currentCandle);
    }

    const aggEndTime = Date.now();
    console.log(`Aggregated ${result.length} candles for ${instrument} to ${timeframe} in ${aggEndTime - aggStartTime} ms`);
    return result.filter(c => c.timestamp >= start && c.timestamp <= end);
}

// Batch insert candles into the database, skipping "null" candles
async function batchInsertCandles(candles, instrument, timeframe) {
    console.log(`Starting cache write of ${candles.length} candles for ${instrument} ${timeframe}`);

    // Filter out "null" candles (volume == 0 or any OHLC is null)
    const validCandles = candles.filter(candle =>
        candle.volume > 0 &&
        candle.open !== null &&
        candle.high !== null &&
        candle.low !== null &&
        candle.close !== null
    );

    // Log skipped "null" candles
    const skippedCandles = candles.filter(candle =>
        candle.volume === 0 ||
        candle.open === null ||
        candle.high === null ||
        candle.low === null ||
        candle.close === null
    );
    skippedCandles.forEach(candle => {
        console.log(`Null candle encountered for ${candle.instrument} at ${new Date(candle.timestamp).toISOString()}: not saved to cache.`);
    });

    const startTime = Date.now();
    return new Promise((resolve, reject) => {
        if (validCandles.length === 0) {
            console.log(`No valid candles to insert for ${instrument} ${timeframe}`);
            resolve();
            return;
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO CANDLES (
                    instrument, timeframe, timestamp, open, high, low, close, volume
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const candle of validCandles) {
                stmt.run([candle.instrument, candle.timeframe, candle.timestamp, candle.open, candle.high, candle.low, candle.close, candle.volume]);
            }
            stmt.finalize((err) => {
                if (err) {
                    db.run('ROLLBACK');
                    reject(err);
                } else {
                    db.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else {
                            const endTime = Date.now();
                            console.log(`Completed cache write of ${validCandles.length} candles for ${instrument} ${timeframe} in ${endTime - startTime} ms`);
                            resolve();
                        }
                    });
                }
            });
        });
    });
}

// Fetch historical 1m candles from Databento API with retry logic and empty response handling
async function fetchHistorical1mCandles(instrument, startMs, endMs) {
    const settings = await getSettings('DATAFEED');
    let params = new URLSearchParams();
    params.append('dataset', settings.dataset);
    params.append('symbols', instrument);
    params.append('schema', 'ohlcv-1m');
    const startTimeISO = new Date(startMs).toISOString().slice(0, 16);
    const endTimeISO = new Date(endMs).toISOString().slice(0, 16);
    params.append('start', startTimeISO);
    params.append('end', endTimeISO);
    params.append('encoding', 'json');

    console.log(`HTTP Historical API call for ${instrument} from ${startTimeISO} to ${endTimeISO}`);

    let attempt = 0;
    while (attempt < 2) {
        try {
            const requestStartTime = Date.now();
            const response = await axios.post(settings.hist_host, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                auth: { username: settings.api_key, password: '' }
            });
            const requestEndTime = Date.now();

            // Handle empty or whitespace-only response
            if (!response.data || response.data.trim() === '') {
                console.log(`HTTP request for ${instrument} returned 0 candles in ${requestEndTime - requestStartTime} ms`);
                return []; // Return empty array gracefully
            }

            const candles1m = response.data.trim().split('\n').map(line => {
                const raw = JSON.parse(line);
                return {
                    timestamp: Number(raw.hd.ts_event) / 1e6,
                    open: Number(raw.open) / 1e9,
                    high: Number(raw.high) / 1e9,
                    low: Number(raw.low) / 1e9,
                    close: Number(raw.close) / 1e9,
                    volume: Number(raw.volume || 0),
                    instrument,
                    timeframe: '1m',
                    source: 'H',
                    isClosed: true  // Historical 1m candles are always closed
                };
            });
            console.log(`HTTP request for ${instrument} returned ${candles1m.length} OHLCV-1m candles in ${requestEndTime - requestStartTime} ms`);
            return candles1m;
        } catch (err) {
            if (err.response && err.response.status === 422 && attempt === 0) {
                const detail = err.response.data.detail;
                if (detail && detail.payload && detail.payload.available_end) {
                    const availableEnd = detail.payload.available_end;
                    params.set('end', availableEnd);
                    attempt++;
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }
    }
    throw new Error('Failed to fetch historical data after retrying');
}

// Start live trades subscription from Databento Live RAW API with diagnostics
async function startLiveTradesSubscription(instruments, startTs, onTrade) {
    const settings = await getSettings('DATAFEED');
    if (!settings.live_host || !settings.api_key || !settings.dataset) {
        throw new Error('Live API settings (live_host, api_key, dataset) not configured in DATAFEED');
    }

    const [liveHost, livePort] = settings.live_host.split(':');
    const livePortNum = parseInt(livePort || 13000);

    const liveClient = new net.Socket();
    liveClient.setKeepAlive(true, 30000);
    let buffer = '';
    let versionReceived = false;
    let cramReceived = false;
    let subscribed = false;
    const instrumentIdToSymbol = new Map(); // Added to map instrument_id to symbol

    console.log(`Connecting to Databento Live RAW API at ${liveHost}:${livePortNum} for instruments: ${instruments.join(', ')}`);

    liveClient.connect({ host: liveHost, port: livePortNum }, () => {
        console.log(`Connected to Databento Live RAW API at ${liveHost}:${livePortNum}`);
    });

    liveClient.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        lines.filter(line => line.trim()).forEach(line => {
            if (line.startsWith('lsg_version=') && !versionReceived) {
                console.log('Server version received:', line);
                versionReceived = true;
            } else if (line.startsWith('cram=') && !cramReceived) {
                const cramChallenge = line.split('cram=')[1].trim();
                console.log('CRAM challenge:', cramChallenge);

                const hash = crypto.createHash('sha256')
                    .update(`${cramChallenge}|${settings.api_key}`)
                    .digest('hex');
                const resp = `${hash}-${settings.api_key.slice(-5)}`;
                const authResponse = `auth=${resp}|dataset=${settings.dataset}|encoding=json|ts_out=1|heartbeat_interval_s=10\n`;
                liveClient.write(Buffer.from(authResponse));
                console.log('Sent auth_response:', authResponse.trim());
                cramReceived = true;
            } else if (line.includes('success=1')) {
                console.log('Authentication successful!');
                const subMsg = `schema=trades|stype_in=raw_symbol|symbols=${instruments.join(',')}|start=${startTs}\n`;
                liveClient.write(Buffer.from(subMsg));
                console.log('Sent subscription (trades):', subMsg.trim());
                liveClient.write(Buffer.from('start_session=1\n'));
                console.log('Sent start_session');
                subscribed = true;
            } else if (line.includes('success=0')) {
                console.error('Authentication failed:', line);
                liveClient.destroy();
            } else if (subscribed) {
                try {
                    const msg = JSON.parse(line);
                    // console.log(`DEBUG - msg = ${msg}`); // DEBUGGING!
                    // console.log(msg);                    // DEBUGGING!
                    if (msg.hd && msg.hd.rtype === 22) { // Instrument mapping message
                        const instrumentId = msg.hd.instrument_id;
                        const symbol = msg.stype_in_symbol;
                        instrumentIdToSymbol.set(instrumentId, symbol);
                        console.log(`Mapped instrument_id ${instrumentId} to symbol ${symbol}`);
                    } else if (msg.hd && msg.hd.rtype === 0 && msg.action === "T") { // Trade message
                        const instrumentId = msg.hd.instrument_id;
                        const symbol = instrumentIdToSymbol.get(instrumentId) || 'unknown';
                        const trade = {
                            timestamp: Number(msg.hd.ts_event) / 1e6,
                            price: Number(msg.price) / 1e9,
                            size: Number(msg.size),
                            side: msg.side,
                            instrument: symbol
                        };
                        onTrade(trade); // Call the provided callback
                    } else if (msg.hd && msg.hd.rtype === 23 && msg.msg === 'Heartbeat') {
                        console.log(`   ***   [${new Date().toLocaleString()}] - ${msg.msg} received, rtype ${msg.hd.rtype}   ***   `);
                    } else {
                        console.log(`[${new Date().toLocaleString()}] Control message (rtype: ${msg.hd ? msg.hd.rtype : 'unknown'}):`, msg);
                    }
                } catch (err) {
                    console.error('Error parsing live data message:', err.message, 'line:', line);
                }
            }
        });
    });

    liveClient.on('error', (err) => {
        console.error('Live API connection error:', err.message);
    });

    liveClient.on('close', () => {
        console.log('Live API connection closed');
    });

    return liveClient;
}

// Fetch live 1m candles from Databento Live RAW API with inactivity timeout
async function fetchLive1mCandles(instruments, startMs, endMs) {
    const settings = await getSettings('DATAFEED');
    if (!settings.live_host || !settings.api_key || !settings.dataset) {
        throw new Error('Live API settings (live_host, api_key, dataset) not configured in DATAFEED');
    }

    const [liveHost, livePort] = settings.live_host.split(':');
    const livePortNum = parseInt(livePort || 13000);

    return new Promise((resolve, reject) => {
        const liveClient = new net.Socket();
        liveClient.setKeepAlive(true, 30000);
        let buffer = '';
        let versionReceived = false;
        let cramReceived = false;
        let subscribed = false;
        const liveCandles = [];
        let inactivityTimer;

        console.log(`Connecting to Databento Live RAW API at ${liveHost}:${livePortNum} for instruments: ${instruments.join(', ')}`);

        liveClient.connect({ host: liveHost, port: livePortNum }, () => {
            console.log(`Connected to Databento Live RAW API at ${liveHost}:${livePortNum}`);
        });

        liveClient.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop();

            lines.filter(line => line.trim()).forEach(line => {
                if (line.startsWith('lsg_version=') && !versionReceived) {
                    console.log('Server version received:', line);
                    versionReceived = true;
                } else if (line.startsWith('cram=') && !cramReceived) {
                    const cramChallenge = line.split('cram=')[1].trim();
                    console.log('CRAM challenge:', cramChallenge);

                    const hash = crypto.createHash('sha256')
                        .update(`${cramChallenge}|${settings.api_key}`)
                        .digest('hex');
                    const resp = `${hash}-${settings.api_key.slice(-5)}`;
                    const authResponse = `auth=${resp}|dataset=${settings.dataset}|encoding=json|ts_out=1|heartbeat_interval_s=10\n`;
                    liveClient.write(Buffer.from(authResponse));
                    console.log('Sent auth_response:', authResponse.trim());
                    cramReceived = true;
                } else if (line.includes('success=1')) {
                    console.log('Authentication successful!');
                    const startTs = startMs * 1e6; // Convert to nanoseconds
                    const subMsg = `schema=ohlcv-1m|stype_in=raw_symbol|symbols=${instruments.join(',')}|start=${startTs}\n`;
                    liveClient.write(Buffer.from(subMsg));
                    console.log('Sent subscription (OHLCV-1m):', subMsg.trim());
                    liveClient.write(Buffer.from('start_session=1\n'));
                    console.log('Sent start_session');
                    subscribed = true;
                    // Start inactivity timer
                    inactivityTimer = setTimeout(() => {
                        console.log(`Inactivity timeout: no candles received after 500ms.`);
                        liveClient.destroy();
                        resolve(liveCandles); // Resolve with whatever was collected, possibly empty
                    }, 500);
                } else if (line.includes('success=0')) {
                    console.error('Authentication failed:', line);
                    reject(new Error('Authentication failed'));
                } else if (subscribed) {
                    try {
                        const msg = JSON.parse(line);
                        if (msg.hd && msg.hd.rtype === 33) { // OHLCV-1m candle
                            // console.log('Live 1m Candle Replay:');  // DEBUGGING!
                            // console.log(msg);                       // DEBUGGING!
                            const timestamp = Number(msg.hd.ts_event) / 1e6;
                            if (timestamp < startMs || timestamp > endMs) return;

                            const candle = {
                                timestamp,
                                open: Number(msg.open) / 1e9,
                                high: Number(msg.high) / 1e9,
                                low: Number(msg.low) / 1e9,
                                close: Number(msg.close) / 1e9,
                                volume: Number(msg.volume || 0),
                                instrument: msg.symbol || instruments[0], // Use symbol from message or first instrument
                                timeframe: '1m',
                                source: 'L',
                                isClosed: true  // Live 1m candles are always closed
                            };
                            liveCandles.push(candle);

                            console.log('Received OHLCV-1m candle:', new Date(candle.timestamp).toLocaleString(),
                                'OHLC:', candle.open, candle.high, candle.low, candle.close, 'Volume:', candle.volume);

                            // Reset inactivity timer
                            if (inactivityTimer) clearTimeout(inactivityTimer);
                            inactivityTimer = setTimeout(() => {
                                console.log(`Inactivity timeout: no new candles for 500ms. Received ${liveCandles.length} candles.`);
                                liveClient.destroy();
                                resolve(liveCandles); // Resolve with collected candles
                            }, 500);
                        } else {
                            console.log(`[${new Date().toLocaleString()}] Control message (rtype: ${msg.hd ? msg.hd.rtype : 'unknown'}):`, msg);
                        }
                    } catch (err) {
                        console.error('Error parsing live data message:', err.message, 'line:', line);
                    }
                }
            });
        });

        liveClient.on('error', (err) => {
            console.error('Live API connection error:', err.message);
            if (inactivityTimer) clearTimeout(inactivityTimer);
            reject(err);
        });

        liveClient.on('close', () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            console.log(`Live API connection closed with ${liveCandles.length} candles received`);
            resolve(liveCandles); // Resolve with whatever was collected
        });
    });
}

// Get cached 1m candles for a symbol
async function getCached1mCandles(symbol, startMs, endMs) {
    const queryStartTime = Date.now();
    return new Promise((resolve) => {
        console.log(`Querying Cache - ${startMs} to ${endMs}`);
        db.all('SELECT * FROM CANDLES WHERE instrument = ? AND timeframe = "1m" AND timestamp BETWEEN ? AND ? ORDER BY timestamp ASC',
            [symbol, startMs, endMs], (err, rows) => {
                const queryEndTime = Date.now();
                if (err) {
                    console.error(`Cache fetch error for ${symbol} 1m:`, err);
                    resolve([]);
                } else {
                    console.log(`Retrieved ${rows.length} candles from cache for ${symbol} 1m in ${queryEndTime - queryStartTime} ms`);
                    resolve(rows.map(row => ({
                        timestamp: row.timestamp,
                        open: row.open,
                        high: row.high,
                        low: row.low,
                        close: row.close,
                        volume: row.volume,
                        instrument: row.instrument,
                        timeframe: row.timeframe,
                        source: 'C',
                        isClosed: true  // Cached 1m candles are always closed
                    })));
                }
            });
    });
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New client connected');
    ws.liveClient = null; // For live trades subscription
    ws.logFileStream = null; // Initialize logFileStream on ws
    ws.activeSubscriptions = {}; // Track active subscriptions: { instrument: [timeframe1, timeframe2, ...] }
    ws.isLiveActive = false; // Track if live data is active
    ws.tradeQueue = []; // Queue for trades during timeframe changes
    ws.isProcessingTimeframeChange = false; // Flag to serialize trade processing

    ws.on('message', async (msg) => {
        let request;
        try {
            request = JSON.parse(msg);
            console.log('Received WebSocket request:', JSON.stringify(request, null, 2));
        } catch (err) {
            ws.send(JSON.stringify({ mtyp: 'error', message: 'Invalid JSON message' }));
            return;
        }

        const { action } = request;

        if (action === 'set_client_id') {
            const { clientid } = request;
            if (!clientid || typeof clientid !== 'string') {
                ws.send(JSON.stringify({ mtyp: 'error', message: 'Invalid or missing clientid' }));
                return;
            }
            ws.clientID = clientid;
            console.log(`Client ID set to ${ws.clientID}`);
            ws.send(JSON.stringify({ mtyp: 'ctrl', action: 'set_client_id_response', message: 'Client ID set successfully' }));
        } else if (action === 'get_settings') {
            const { settings } = request;
            if (!settings || typeof settings !== 'string') {
                ws.send(JSON.stringify({ mtyp: 'error', message: 'Invalid or missing settings name' }));
                return;
            }
            db.get('SELECT setting_value FROM SYSTEM_SETTINGS WHERE setting_name = ?', [settings], (err, row) => {
                if (err) {
                    console.error(`Error fetching settings ${settings}:`, err.message);
                    ws.send(JSON.stringify({ mtyp: 'error', message: 'Database error fetching settings' }));
                } else if (row) {
                    ws.send(JSON.stringify({ mtyp: 'ctrl', action: 'settings_response', settings, value: JSON.parse(row.setting_value) }));
                } else {
                    ws.send(JSON.stringify({ mtyp: 'ctrl', action: 'settings_response', settings, value: null, message: 'Settings not found' }));
                }
            });
        } else if (action === 'save_settings') {
            const { settings, new_values } = request;
            if (!settings || typeof settings !== 'string' || !new_values || typeof new_values !== 'object') {
                ws.send(JSON.stringify({ mtyp: 'error', message: 'Invalid settings name or values' }));
                return;
            }
            const settingValue = JSON.stringify(new_values);
            db.run(
                'INSERT OR REPLACE INTO SYSTEM_SETTINGS (setting_name, setting_value) VALUES (?, ?)',
                [settings, settingValue],
                (err) => {
                    if (err) {
                        console.error(`Error saving settings ${settings}:`, err.message);
                        ws.send(JSON.stringify({ mtyp: 'error', message: 'Database error saving settings' }));
                    } else {
                        console.log(`Settings ${settings} saved:`, new_values);
                        ws.send(JSON.stringify({ mtyp: 'ctrl', action: 'save_settings_response', settings, message: 'Settings saved successfully' }));
                    }
                }
            );
        } else if (action === 'clear_cache') {
            const { instrument = 'all', timeframe = 'all', start_time = 'all', end_time = 'all' } = request;
            let query = 'DELETE FROM CANDLES';
            const conditions = [];
            const params = [];

            if (instrument !== 'all') {
                conditions.push('instrument = ?');
                params.push(instrument);
            }
            if (timeframe !== 'all') {
                conditions.push('timeframe = ?');
                params.push(timeframe);
            }
            if (start_time !== 'all' || end_time !== 'all') {
                if (start_time !== 'all') {
                    conditions.push('timestamp >= ?');
                    params.push(start_time);
                }
                if (end_time !== 'all') {
                    conditions.push('timestamp <= ?');
                    params.push(end_time);
                }
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            db.run(query, params, function (err) {
                if (err) {
                    console.error('Error clearing cache:', err.message);
                    ws.send(JSON.stringify({ mtyp: 'error', message: 'Database error clearing cache' }));
                } else {
                    console.log(`Cleared ${this.changes} candles from cache with query: ${query}`, params);
                    ws.send(JSON.stringify({ mtyp: 'ctrl', action: 'clear_cache_response', message: `Cleared ${this.changes} candles` }));
                }
            });
        } else if (action === 'get_data') {
            ws.send(JSON.stringify({ mtyp: 'ctrl', message: `Received get_data request: ${JSON.stringify(request)}` }));
            let { subscriptions, start_time, end_time, live_data = 'none', sendto = 'console', use_cache = true, save_cache = true, timezone = DEFAULT_TIMEZONE } = request;

            // Convert live_data to number if it's not "none" or "all"
            if (typeof live_data === 'string' && live_data !== 'none' && live_data !== 'all') {
                live_data = Number(live_data);
                if (isNaN(live_data)) {
                    ws.send(JSON.stringify({ mtyp: 'error', message: 'Invalid live_data value: must be "none", "all", or a number' }));
                    return;
                }
            }

            // Validate subscriptions
            if (!Array.isArray(subscriptions) || !subscriptions.every(sub => sub.instrument && sub.timeframe)) {
                ws.send(JSON.stringify({ mtyp: 'error', message: 'Invalid subscriptions format' }));
                return;
            }

            // Set up active subscriptions
            ws.activeSubscriptions = {};
            subscriptions.forEach(sub => {
                const { instrument, timeframe } = sub;
                if (!ws.activeSubscriptions[instrument]) {
                    ws.activeSubscriptions[instrument] = [];
                }
                if (!ws.activeSubscriptions[instrument].includes(timeframe)) {
                    ws.activeSubscriptions[instrument].push(timeframe);
                }
            });

            // Set defaults for time range
            const now = Date.now();
            const startMs = start_time === undefined ? now - DEFAULT_DATA_RANGE_MINUTES * 60 * 1000 : new Date(start_time).getTime();
            const endMs = end_time === undefined || end_time === 'current' ? now : new Date(end_time).getTime();
            console.log(`  DEBUG - Start Time = ${start_time}, startMs = ${startMs} | End Time = ${end_time}, endMs = ${endMs} `);

            // Store parameters in ws for use in add_timeframe and remove_timeframe
            ws.startMs = startMs;
            ws.endMs = endMs;
            ws.sendto = sendto;

            // Load DATAFEED settings
            const settings = await getSettings('DATAFEED');
            if (!settings) {
                ws.send(JSON.stringify({ mtyp: 'error', message: 'DATAFEED settings not configured' }));
                return;
            }

            // Initialize log file stream if needed and attach to ws
            if (sendto === 'log') {
                const logFile = path.join(LOG_DIR, `candles-${new Date().toISOString().replace(/T/, '-').replace(/:/g, '-').slice(0, 19)}.log`);
                ws.logFileStream = fs.createWriteStream(logFile, { flags: 'a' });
            }

            // Output function with timezone adjustment, stored in ws
            ws.outputFunc = (candle) => {
                let outputCandle = { mtyp: 'data', ...candle };
                const date = new Date(candle.timestamp);
                const options = {
                    timeZone: timezone,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                };
                const formatter = new Intl.DateTimeFormat('en-US', options);
                const parts = formatter.formatToParts(date);
                const formattedDate = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value} ${parts.find(p => p.type === 'hour').value}:${parts.find(p => p.type === 'minute').value}:${parts.find(p => p.type === 'second').value}`;
                outputCandle.dateTime = formattedDate;
                const message = JSON.stringify(outputCandle);
                if (ws.sendto === 'console') {
                    console.log(message);
                } else if (ws.sendto === 'log') {
                    if (ws.logFileStream) {
                        ws.logFileStream.write(message + '\n');
                    }
                } else {
                    ws.send(message);
                }
            };

            // Group subscriptions by symbol internally
            const symbolSubscriptions = ws.activeSubscriptions;

            // Track the next1mStart for each symbol to determine the earliest start time for live trades
            const next1mStarts = {};

            // Process each symbol
            for (const symbol in symbolSubscriptions) {
                const timeframes = symbolSubscriptions[symbol];
                let candles1m = [];

                if (use_cache) {
                    candles1m = await getCached1mCandles(symbol, startMs, endMs);
                }

                if (candles1m.length === 0) {
                    // No cached data, fetch the entire range
                    try {
                        candles1m = await fetchHistorical1mCandles(symbol, startMs, endMs);
                        if (save_cache && candles1m.length > 0) {
                            await batchInsertCandles(candles1m, symbol, '1m');
                        }
                    } catch (err) {
                        console.error(`Failed to fetch historical data for ${symbol}:`, err.message);
                        ws.send(JSON.stringify({ mtyp: 'error', message: `Failed to fetch historical data for ${symbol}` }));
                        continue;
                    }
                } else {
                    // Cached data exists, fill in gaps
                    const earliestCached = Math.min(...candles1m.map(c => c.timestamp));
                    const latestCachedForSymbol = Math.max(...candles1m.map(c => c.timestamp));

                    // Fill in earlier data if needed, but check cushion first
                    if (startMs < earliestCached) {
                        const cushionMs = EARLY_CANDLE_CUSHION_MINUTES * 60 * 1000;
                        if (earliestCached - startMs <= cushionMs) {
                            console.log(`Bypassing early historical fetch for ${symbol}: earliest cached candle within cushion of ${EARLY_CANDLE_CUSHION_MINUTES} minutes.`);
                        } else {
                            try {
                                const diagCacheBeginRange = earliestCached - 60000;
                                console.log(`Checking Historical Early Range - ${startMs} to ${diagCacheBeginRange}...`);
                                const earlierCandles = await fetchHistorical1mCandles(symbol, startMs, earliestCached - 60000); // 1 minute before to avoid overlap
                                if (earlierCandles.length > 0) {
                                    candles1m = [...earlierCandles, ...candles1m];
                                    if (save_cache) {
                                        await batchInsertCandles(earlierCandles, symbol, '1m');
                                    }
                                }
                            } catch (err) {
                                console.error(`Failed to fetch earlier historical data for ${symbol}:`, err.message);
                                // Continue with existing data, no error sent to client
                            }
                        }
                    }

                    // Fill in later data if needed, but check cushion first
                    if (endMs > latestCachedForSymbol) {
                        if (end_time === undefined || end_time === 'current') {
                            const cushionMs = LATE_CANDLE_CUSHION_MINUTES * 60 * 1000;
                            if (endMs - latestCachedForSymbol <= cushionMs) {
                                console.log(`Bypassing late historical fetch for ${symbol}: latest cached candle within cushion of ${LATE_CANDLE_CUSHION_MINUTES} minutes.`);
                            } else {
                                try {
                                    const diagCacheEndRange = latestCachedForSymbol + 60000;
                                    console.log(`Checking Historical Late Range - ${latestCachedForSymbol + 60000} to ${endMs}...`);
                                    const laterCandles = await fetchHistorical1mCandles(symbol, latestCachedForSymbol + 60000, endMs); // 1 minute after to avoid overlap
                                    if (laterCandles.length > 0) {
                                        candles1m = [...candles1m, ...laterCandles];
                                        if (save_cache) {
                                            await batchInsertCandles(laterCandles, symbol, '1m');
                                        }
                                    }
                                } catch (err) {
                                    console.error(`Failed to fetch later historical data for ${symbol}:`, err.message);
                                    // Continue with existing data, no error sent to client
                                }
                            }
                        } else {
                            // If end_time is specified, always try to fetch
                            try {
                                const diagCacheEndRange = latestCachedForSymbol + 60000;
                                console.log(`Checking Historical Late Range - ${latestCachedForSymbol + 60000} to ${endMs}...`);
                                const laterCandles = await fetchHistorical1mCandles(symbol, latestCachedForSymbol + 60000, endMs); // 1 minute after to avoid overlap
                                if (laterCandles.length > 0) {
                                    candles1m = [...candles1m, ...laterCandles];
                                    if (save_cache) {
                                        await batchInsertCandles(laterCandles, symbol, '1m');
                                    }
                                }
                            } catch (err) {
                                console.error(`Failed to fetch later historical data for ${symbol}:`, err.message);
                                // Continue with existing data, no error sent to client
                            }
                        }
                    }

                    // Sort the combined candles
                    candles1m.sort((a, b) => a.timestamp - b.timestamp);
                }

                // Check if live data is needed for initial dataset
                const latestCachedForSymbol = candles1m.length > 0 ? Math.max(...candles1m.map(c => c.timestamp)) : startMs;
                if (end_time === 'current' || endMs > latestCachedForSymbol) {
                    console.log(`Live data required for ${symbol} from ${new Date(latestCachedForSymbol + 60000).toISOString()} to ${end_time === 'current' ? 'current' : new Date(endMs).toISOString()}`);
                    try {
                        const liveCandles = await fetchLive1mCandles([symbol], latestCachedForSymbol + 60000, endMs);
                        if (liveCandles.length > 0) {
                            candles1m = [...candles1m, ...liveCandles];
                            if (save_cache) {
                                await batchInsertCandles(liveCandles, symbol, '1m');
                                console.log(`Added ${liveCandles.length} live OHLCV-1m candles to CANDLES cache for ${symbol}`);
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to fetch live data for ${symbol}:`, err.message);
                        // Continue with existing data, no error sent to client
                    }
                    // Sort again after adding live data
                    candles1m.sort((a, b) => a.timestamp - b.timestamp);
                }

                // Serve each requested timeframe
                for (const timeframe of timeframes) {
                    let candlesToServe;
                    if (timeframe === '1m') {
                        candlesToServe = candles1m.filter(c => c.timestamp >= startMs && c.timestamp <= endMs);
                    } else {
                        candlesToServe = aggregateCandles(symbol, timeframe, startMs, endMs, candles1m);
                    }
                    console.log(`Starting to send ${candlesToServe.length} ${timeframe} candles for ${symbol} to ${sendto}`);
                    candlesToServe.forEach(ws.outputFunc);
                }

                // Initialize open candles for live data if needed
                if (live_data !== 'none') {
                    if (!ws.open1mCandles) ws.open1mCandles = new Map();
                    if (!ws.openCandles) ws.openCandles = new Map();

                    const candles1mForSymbol = candles1m.filter(c => c.instrument === symbol);
                    const last1mCandle = candles1mForSymbol[candles1mForSymbol.length - 1];
                    const next1mStart = last1mCandle ? last1mCandle.timestamp + 60000 : Math.floor(now / 60000) * 60000;
                    console.log(`DEBUG: next 1m candle time for ${symbol}: ${new Date(next1mStart).toISOString()}`);  // Log 1: Expected start time
                    ws.open1mCandles.set(symbol, {
                        timestamp: next1mStart,
                        open: null,
                        high: null,
                        low: null,
                        close: null,
                        volume: 0,
                        instrument: symbol,
                        timeframe: '1m',
                        source: 'T',
                        isClosed: false,
                        firstUpdate: true  // Flag to log when candle starts processing
                    });

                    const openCandlesForSymbol = new Map();
                    for (const timeframe of timeframes) {
                        const candlesToServe = aggregateCandles(symbol, timeframe, startMs, endMs, candles1mForSymbol);
                        const lastCandle = candlesToServe[candlesToServe.length - 1];
                        let openCandle;
                        if (lastCandle && !lastCandle.isClosed) {
                            openCandle = { ...lastCandle, source: 'T' };
                        } else {
                            const intervalMs = parseTimeframeMs(timeframe);
                            const currentStart = Math.floor(next1mStart / intervalMs) * intervalMs;
                            openCandle = {
                                timestamp: currentStart,
                                open: null,
                                high: null,
                                low: null,
                                close: null,
                                volume: 0,
                                instrument: symbol,
                                timeframe,
                                source: 'T',
                                isClosed: false
                            };
                        }
                        openCandlesForSymbol.set(timeframe, openCandle);
                    }
                    ws.openCandles.set(symbol, openCandlesForSymbol);

                    // Track the next1mStart for this symbol
                    next1mStarts[symbol] = next1mStart;
                }
            }

            // Start live trades subscription if live_data is not "none"
            if (live_data !== 'none') {
                ws.isLiveActive = true;
                const instruments = Object.keys(symbolSubscriptions);
                // Find the earliest next1mStart across all symbols
                const earliestNext1mStart = Math.min(...Object.values(next1mStarts));
                const startTs = earliestNext1mStart * 1e6; // Convert to nanoseconds for Databento API
                console.log(`Live trades subscription will start from: ${new Date(earliestNext1mStart).toLocaleString()}`);

                // Define processTradeForClient with diagnostics and live updates
                const processTradeForClient = (trade) => {
                    if (ws.isProcessingTimeframeChange) {
                        ws.tradeQueue.push(trade);
                        return;
                    }
                    console.log(`Trade for ${trade.instrument} at ${new Date(trade.timestamp).toISOString()}`);  // Log 3: Each trade tick
                    const instrument = trade.instrument;
                    if (!ws.activeSubscriptions[instrument]) return;

                    // Only process trades that are on or after the instrument's next1mStart
                    const next1mStart = next1mStarts[instrument];
                    if (trade.timestamp < next1mStart) {
                        return; // Trade is before the start of the next candle, ignore
                    }

                    // Update 1m open candle (always tracked for caching)
                    const open1mCandle = ws.open1mCandles.get(instrument);
                    if (trade.timestamp >= open1mCandle.timestamp + 60000) {
                        // Close current 1m candle
                        open1mCandle.isClosed = true;
                        // Send the closed 1m candle if subscribed
                        if (ws.activeSubscriptions[instrument].includes('1m')) {
                            ws.outputFunc(open1mCandle); // Push final closed candle
                        }
                        // Cache it (only if it's not a "null" candle)
                        batchInsertCandles([open1mCandle], instrument, '1m').catch(err => console.error('Error caching 1m candle:', err));
                        // Start new open 1m candle
                        const newStart = Math.floor(trade.timestamp / 60000) * 60000;
                        ws.open1mCandles.set(instrument, {
                            timestamp: newStart,
                            open: trade.price,
                            high: trade.price,
                            low: trade.price,
                            close: trade.price,
                            volume: trade.size,
                            instrument,
                            timeframe: '1m',
                            source: 'T',
                            isClosed: false,
                            firstUpdate: true  // Reset flag for new candle
                        });
                        // Send the new 1m candle if subscribed
                        if (ws.activeSubscriptions[instrument].includes('1m')) {
                            ws.outputFunc(ws.open1mCandles.get(instrument));
                        }
                    } else {
                        // Update current open 1m candle
                        if (open1mCandle.firstUpdate) {
                            console.log(`DEBUG: next 1m time reached for instrument ${instrument}, candle started`);  // Log 2: Candle processing begins
                            open1mCandle.firstUpdate = false;
                        }
                        if (open1mCandle.open === null) {
                            open1mCandle.open = trade.price;
                        }
                        open1mCandle.high = Math.max(open1mCandle.high || trade.price, trade.price);
                        open1mCandle.low = Math.min(open1mCandle.low || trade.price, trade.price);
                        open1mCandle.close = trade.price;
                        open1mCandle.volume += trade.size;
                        // Send the updated 1m candle if subscribed
                        if (ws.activeSubscriptions[instrument].includes('1m')) {
                            ws.outputFunc(open1mCandle);
                        }
                    }

                    // Update open candles for requested timeframes (excluding 1m)
                    const openCandlesForSymbol = ws.openCandles.get(instrument);
                    if (openCandlesForSymbol) {
                        for (const [timeframe, openCandle] of openCandlesForSymbol) {
                            if (timeframe === '1m') continue; // Skip 1m to avoid duplication
                            const intervalMs = parseTimeframeMs(timeframe);
                            if (trade.timestamp >= openCandle.timestamp + intervalMs) {
                                // Close current open candle
                                openCandle.isClosed = true;
                                ws.outputFunc(openCandle); // Send final version to client
                                // Start new open candle
                                const newStart = Math.floor(trade.timestamp / intervalMs) * intervalMs;
                                openCandlesForSymbol.set(timeframe, {
                                    timestamp: newStart,
                                    open: trade.price,
                                    high: trade.price,
                                    low: trade.price,
                                    close: trade.price,
                                    volume: trade.size,
                                    instrument,
                                    timeframe,
                                    source: 'T',
                                    isClosed: false
                                });
                                ws.outputFunc(openCandlesForSymbol.get(timeframe)); // Send new open candle
                                console.log(`Updated open ${timeframe} candle for ${instrument}: ${JSON.stringify(openCandlesForSymbol.get(timeframe))}`);
                            } else {
                                // Update current open candle
                                if (openCandle.open === null) {
                                    openCandle.open = trade.price;
                                }
                                openCandle.high = Math.max(openCandle.high || trade.price, trade.price);
                                openCandle.low = Math.min(openCandle.low || trade.price, trade.price);
                                openCandle.close = trade.price;
                                openCandle.volume += trade.size;
                                ws.outputFunc(openCandle); // Send updated candle to client
                                // console.log(`   Updated open ${timeframe} candle for ${instrument}: ${JSON.stringify(openCandle)}\n `);
                            }
                        }
                    }
                };

                // Start live trades subscription
                console.log(`Live trades subscription started for ${live_data} seconds or until client disconnects`);
                ws.liveClient = await startLiveTradesSubscription(instruments, startTs, processTradeForClient);

                if (typeof live_data === 'number') {
                    setTimeout(() => {
                        if (ws.liveClient) {
                            ws.liveClient.destroy();
                            ws.liveClient = null;
                            ws.isLiveActive = false;
                            console.log(`Live trades subscription stopped after ${live_data} seconds`);
                            if (ws.sendto === 'log' && ws.logFileStream) {
                                ws.logFileStream.end();
                                ws.logFileStream = null;
                            }
                        }
                    }, live_data * 1000);
                }
            }
        } else if (action === 'add_timeframe') {
            if (!ws.isLiveActive) {
                ws.send(JSON.stringify({ mtyp: 'error', message: 'Cannot add timeframe: no active live data subscription' }));
                return;
            }
            const { instrument, timeframe } = request;
            if (!instrument || !timeframe) {
                ws.send(JSON.stringify({ mtyp: 'error', message: 'Missing instrument or timeframe' }));
                return;
            }
            if (!ws.activeSubscriptions[instrument]) {
                ws.send(JSON.stringify({ mtyp: 'error', message: `Instrument ${instrument} not subscribed` }));
                return;
            }
            if (ws.activeSubscriptions[instrument].includes(timeframe)) {
                ws.send(JSON.stringify({ mtyp: 'ctrl', message: `Timeframe ${timeframe} for ${instrument} already being sent` }));
                return;
            }

            // Add to active subscriptions
            ws.activeSubscriptions[instrument].push(timeframe);

            // Use original startMs and current time as endMs for consistency with get_data
            const startMs = ws.startMs;
            const endMs = Date.now();

            let candles1m = await getCached1mCandles(instrument, startMs, endMs);
            if (candles1m.length === 0) {
                try {
                    candles1m = await fetchHistorical1mCandles(instrument, startMs, endMs);
                    await batchInsertCandles(candles1m, instrument, '1m');
                } catch (err) {
                    console.error(`Failed to fetch historical data for ${instrument}:`, err.message);
                    ws.send(JSON.stringify({ mtyp: 'error', message: `Failed to fetch historical data for ${instrument}` }));
                    return;
                }
            } else {
                const earliestCached = Math.min(...candles1m.map(c => c.timestamp));
                const latestCached = Math.max(...candles1m.map(c => c.timestamp));
                if (startMs < earliestCached) {
                    try {
                        const earlierCandles = await fetchHistorical1mCandles(instrument, startMs, earliestCached - 60000);
                        if (earlierCandles.length > 0) {
                            candles1m = [...earlierCandles, ...candles1m];
                            await batchInsertCandles(earlierCandles, instrument, '1m');
                        }
                    } catch (err) {
                        console.error(`Failed to fetch earlier historical data for ${instrument}:`, err.message);
                    }
                }
                if (endMs > latestCached) {
                    // Set flag before fetching live candles
                    ws.isProcessingTimeframeChange = true;
                    try {
                        const laterCandles = await fetchLive1mCandles([instrument], latestCached + 60000, endMs);
                        if (laterCandles.length > 0) {
                            candles1m = [...candles1m, ...laterCandles];
                            await batchInsertCandles(laterCandles, instrument, '1m');
                        }
                    } catch (err) {
                        console.error(`Failed to fetch live data for ${instrument}:`, err.message);
                    }
                }
                candles1m.sort((a, b) => a.timestamp - b.timestamp);
            }

            // Aggregate and send historical candles using the stored outputFunc
            const aggregatedCandles = aggregateCandles(instrument, timeframe, startMs, endMs, candles1m);
            ws.send(JSON.stringify({ mtyp: 'ctrl', message: `Starting streaming ${timeframe} for ${instrument}` }));
            aggregatedCandles.forEach(ws.outputFunc);

            // Initialize live candle with inclusion of open 1m candle
            const openCandlesForSymbol = ws.openCandles.get(instrument) || new Map();
            const lastAggregatedCandle = aggregatedCandles[aggregatedCandles.length - 1];
            const intervalMs = parseTimeframeMs(timeframe);
            const currentTime = Date.now();
            let liveCandle;

            if (lastAggregatedCandle && !lastAggregatedCandle.isClosed && currentTime < lastAggregatedCandle.timestamp + intervalMs) {
                // Continue with the last open aggregated candle
                liveCandle = { ...lastAggregatedCandle, source: 'T' };
            } else {
                // Start a new live candle at the CURRENT appropriate interval
                const currentStart = Math.floor(currentTime / intervalMs) * intervalMs;
                liveCandle = {
                    timestamp: currentStart,
                    open: null,
                    high: null,
                    low: null,
                    close: null,
                    volume: 0,
                    instrument,
                    timeframe,
                    source: 'T',
                    isClosed: false
                };
            }

            // Include open 1m candle if it falls within this interval
            const open1mCandle = ws.open1mCandles.get(instrument);
            if (open1mCandle && open1mCandle.timestamp >= liveCandle.timestamp && open1mCandle.timestamp < liveCandle.timestamp + intervalMs) {
                if (liveCandle.open === null && open1mCandle.open !== null) {
                    liveCandle.open = open1mCandle.open;
                }
                liveCandle.high = Math.max(liveCandle.high || open1mCandle.high || -Infinity, open1mCandle.high || -Infinity);
                liveCandle.low = Math.min(liveCandle.low || open1mCandle.low || Infinity, open1mCandle.low || Infinity);
                liveCandle.close = open1mCandle.close || liveCandle.close;
                liveCandle.volume += open1mCandle.volume || 0;
            }

            openCandlesForSymbol.set(timeframe, liveCandle);
            ws.openCandles.set(instrument, openCandlesForSymbol);

            // Reset the flag to false
            ws.isProcessingTimeframeChange = false;

            // Process any queued trades 
            while (ws.tradeQueue.length > 0) {
                const queuedTrade = ws.tradeQueue.shift();
                processTradeForClient(queuedTrade);
            }
        } else if (action === 'remove_timeframe') {
            if (!ws.isLiveActive) {
                ws.send(JSON.stringify({ mtyp: 'error', message: 'Cannot remove timeframe: no active live data subscription' }));
                return;
            }
            const { instrument, timeframe } = request;
            if (!instrument || !timeframe) {
                ws.send(JSON.stringify({ mtyp: 'error', message: 'Missing instrument or timeframe' }));
                return;
            }
            if (!ws.activeSubscriptions[instrument]) {
                ws.send(JSON.stringify({ mtyp: 'error', message: `Instrument ${instrument} not subscribed` }));
                return;
            }
            const index = ws.activeSubscriptions[instrument].indexOf(timeframe);
            if (index === -1) {
                ws.send(JSON.stringify({ mtyp: 'ctrl', message: `Timeframe ${timeframe} for ${instrument} not being sent` }));
                return;
            }

            // Remove from active subscriptions
            ws.activeSubscriptions[instrument].splice(index, 1);

            // Free live candle aggregation
            const openCandlesForSymbol = ws.openCandles.get(instrument);
            if (openCandlesForSymbol) {
                openCandlesForSymbol.delete(timeframe);
            }

            // Send control message (via WebSocket, consistent with existing behavior)
            ws.send(JSON.stringify({ mtyp: 'ctrl', message: `Stopped streaming ${timeframe} for ${instrument}` }));
        } else if (action === 'save_client_settings') {
            // New action to save client settings
            const { client_id, new_values } = request;
            if (!client_id || !new_values || typeof new_values !== 'object') {
                ws.send(JSON.stringify({ mtyp: 'error', message: 'Invalid or missing client_id or new_values' }));
                return;
            }
            const settingsValue = JSON.stringify(new_values);
            db.run(
                'INSERT OR REPLACE INTO CLIENT_SETTINGS (client_id, client_settings) VALUES (?, ?)',
                [client_id, settingsValue],
                (err) => {
                    if (err) {
                        console.error(`Error saving client settings for ${client_id}:`, err.message);
                        ws.send(JSON.stringify({ mtyp: 'error', message: 'Database error saving client settings' }));
                    } else {
                        console.log(`Client settings for ${client_id} saved successfully.`);
                        ws.send(JSON.stringify({ mtyp: 'ctrl', action: 'save_client_settings_response', message: 'Client settings saved successfully' }));
                    }
                }
            );
        } else if (action === 'get_client_settings') {
            // New action to retrieve client settings
            const { client_id } = request;
            if (!client_id) {
                ws.send(JSON.stringify({ mtyp: 'error', message: 'Missing client_id' }));
                return;
            }
            db.get('SELECT client_settings FROM CLIENT_SETTINGS WHERE client_id = ?', [client_id], (err, row) => {
                if (err) {
                    console.error(`Error fetching client settings for ${client_id}:`, err.message);
                    ws.send(JSON.stringify({ mtyp: 'error', message: 'Database error fetching client settings' }));
                } else if (row) {
                    const settingsValue = JSON.parse(row.client_settings);
                    ws.send(JSON.stringify({ mtyp: 'ctrl', action: 'client_settings_response', settings: settingsValue }));
                } else {
                    ws.send(JSON.stringify({ mtyp: 'ctrl', action: 'client_settings_response', settings: null, message: 'No settings found for client' }));
                }
            });
        } else if (action === 'delete_anno') {
            // Handle annotation deletion
            const { clientid, unique } = request;
            
            if (!clientid || !unique) {
                ws.send(JSON.stringify({ mtyp: 'error', message: 'Missing clientid or unique identifier' }));
                return;
            }
            
            // Build the WHERE clause based on clientid and unique values
            let whereClause = [];
            let params = [];
            
            // Add clientid to WHERE clause if not 'all'
            if (clientid !== 'all') {
                whereClause.push('client_id = ?');
                params.push(clientid);
            }
            
            // Add unique_id to WHERE clause if not 'all'
            if (unique !== 'all') {
                whereClause.push('unique_id = ?');
                params.push(unique);
            }
            
            // Build the final query
            let query = 'DELETE FROM ANNOTATIONS';
            if (whereClause.length > 0) {
                query += ' WHERE ' + whereClause.join(' AND ');
            }
            
            // Execute the query
            db.run(query, params, function(err) {
                if (err) {
                    console.error('Error deleting annotation:', err.message);
                    ws.send(JSON.stringify({ mtyp: 'error', message: 'Database error deleting annotation' }));
                } else {
                    console.log(`Deleted ${this.changes} annotation(s) with query: ${query}`, params);
                    ws.send(JSON.stringify({ 
                        mtyp: 'ctrl', 
                        action: 'delete_anno_response', 
                        deleted: this.changes,
                        clientid: clientid,
                        unique: unique,
                        message: `Deleted ${this.changes} annotation(s)` 
                    }));
                }
            });
        } else {
            console.log(`${action} is an unknown action.`)
            ws.send(JSON.stringify({ mtyp: 'error', message: 'Unknown action' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (ws.liveClient) ws.liveClient.destroy();
        if (ws.logFileStream) {
            ws.logFileStream.end();
            ws.logFileStream = null;
        }
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
    });
});

// Handle server errors and shutdown
wss.on('error', (err) => console.error('WebSocket server error:', err.message));

process.on('SIGINT', () => {
    console.log('Shutting down server...');

    // Close all WebSocket client connections
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.close(1000, 'Server shutting down'); // Send close frame to clients
        }
    });

    // Stop live data streaming for all connected clients
    wss.clients.forEach(client => {
        if (client.liveClient) {
            client.liveClient.destroy(); // Destroy the live data feed for this client
            client.liveClient = null; // Clear reference
        }
    });

    // Close the database
    db.close((err) => {
        if (err) console.error('Error closing database:', err);
        console.log('Database closed');

        // Close the WebSocket server
        wss.close(() => {
            console.log('WebSocket server closed');
            process.exit(0); // Exit cleanly
        });
    });
});