/**
 * ChartAnnotationExample.js
 * 
 * Example showing how to use the ChartAnnotationManager class
 * to create, update, and delete chart annotations.
 */

// Load dependencies for Node.js environment
let WebSocket;
let ChartAnnotationManager;

if (typeof window === 'undefined') {
    // Node.js environment
    WebSocket = require('ws');
    // Import ChartAnnotationManager using the exact export pattern from the original file
    const managerModule = require('./ChartAnnotationManager');
    ChartAnnotationManager = managerModule.ChartAnnotationManager;
} else {
    // Browser environment - ChartAnnotationManager is available on the window object
    // as defined in ChartAnnotationManager.js
}

// Example strategy client for Quatrain charting platform
// In an actual implementation, you would include this in your strategy code

// Demo code - this shows how you would use the ChartAnnotationManager in a strategy
function runAnnotationDemo() {
    // Step 1: Create WebSocket connection to the Chronicle server
    const wsUrl = 'ws://localhost:8080';
    
    // Create WebSocket - handle both browser and Node.js environments
    const ws = typeof window !== 'undefined' 
        ? new WebSocket(wsUrl)
        : new WebSocket(wsUrl, {
            // Optional Node.js specific options
            perMessageDeflate: false,
            maxPayload: 100 * 1024 * 1024 // 100MB max payload
        });
    
    // Step 2: Set up client information
    const clientId = 'strategy-demo-001';
    const instrument = 'ESM5';  // Example instrument
    
    // Step 3: Initialize the annotation manager
    const annoManager = new ChartAnnotationManager(ws, clientId, instrument);
    
    // Track annotations created by this demo
    const annotations = {
        supportLine: null,
        resistanceLine: null,
        trendLine: null,
        arrow: null,
        box: null
    };
    
    // Step 4: Set up event handlers for the WebSocket
    ws.addEventListener('open', function() {
        console.log('Connected to Chronicle server');
        
        // Set client ID on the server
        const clientIdMsg = {
            action: 'set_client_id',
            clientid: clientId
        };
        console.log('Sending client ID message:', clientIdMsg);
        ws.send(JSON.stringify(clientIdMsg));
        
        // Register as a strategy client
        const registerMsg = {
            action: 'register_strat',
            name: 'Strategy Example Demo',
            description: 'Strategy Demo - Using ChartAnnotationManager',
            clientid: clientId
        };
        console.log('Sending strategy registration message:', registerMsg);
        ws.send(JSON.stringify(registerMsg));
        
        // Start demo after a short delay to ensure client ID is set
        console.log('\n\n***\n*** Demo will start in 15 seconds - subscribe NOW to see messages from the server\n***\n\n');
        setTimeout(runDemo, 15000);
    });
    
    ws.addEventListener('error', function(error) {
        console.error('WebSocket error:', error);
    });
    
    ws.addEventListener('close', function() {
        console.log('Connection closed');
    });
    
    // Add message handler to see server responses
    ws.addEventListener('message', function(event) {
        console.log('Received WebSocket message:', event.data);
        try {
            const data = JSON.parse(event.data);
            console.log('Parsed message:', data);
        } catch (e) {
            console.log('Could not parse message as JSON');
        }
    });
    
    // Step 5: Actual demo with chart annotations
    function runDemo() {
        // Get current time as X-coordinate (timestamp in milliseconds)
        const now = Date.now();
        const hour = 60 * 60 * 1000;  // 1 hour in milliseconds
        
        // Example price points
        const currentPrice = 5330.75;
        const supportPrice = 5310.25;
        const resistancePrice = 5350.50;
        
        console.log('Starting annotation demo...');
        
        // Example 1: Create a horizontal support line (bidirectional)
        annotations.supportLine = annoManager.createHorizontalLine(
            supportPrice,           // price (y-coordinate)
            '#00FF00',              // green color
            'all',                  // all timeframes
            'dash',                 // dashed line
            true,                   // show label
            null                    // startTime (null for bidirectional line)
        );
        console.log('Created support line:', annotations.supportLine);
        
        // Example 2: Create a resistance horizontal line (rightward from current time)
        annotations.resistanceLine = annoManager.createHorizontalLine(
            resistancePrice,        // price (y-coordinate)
            '#FF0000',              // red color
            'all',                  // all timeframes
            'dash',                 // dashed line
            true,                   // show label
            now                     // startTime (now for rightward line)
        );
        console.log('Created resistance line:', annotations.resistanceLine);
        
        // Example 3: Create a trend line
        annotations.trendLine = annoManager.createTrendLine(
            now - 2 * hour,         // start time (2 hours ago)
            currentPrice - 15,      // start price
            now,                    // end time (now)
            currentPrice,           // end price
            '#FFAA00',              // orange color
            'all',                  // all timeframes
            'solid'                 // solid line
        );
        console.log('Created trend line:', annotations.trendLine);
        
        // Example 4: Create an up arrow
        annotations.arrow = annoManager.createArrow(
            now - 0.5 * hour,       // time (30 mins ago)
            currentPrice - 10,      // price
            'up',                   // direction
            '#00AAFF',              // light blue color
            'all',                  // all timeframes
            'L',                    // large size
            'arrow'                 // arrow style
        );
        console.log('Created up arrow:', annotations.arrow);
        
        // Example 5: Create a box annotation (potential trading range)
        annotations.box = annoManager.createBox(
            now - 3 * hour,         // start time (3 hours ago)
            supportPrice,           // bottom price (support)
            now + 2 * hour,         // end time (2 hours from now)
            resistancePrice,        // top price (resistance)
            '#AAFF00',              // lime color
            0.2,                    // 20% opacity
            'all',                  // all timeframes
            'solid'                 // solidorder
        );
        console.log('Created box annotation:', annotations.box);
        
        // Wait 1 second for console to clear before sending this notification   
        setTimeout(() => {
            console.log('\n\n       ***\n       *** All Annotations Created - Updates and Deletes Start Soon! ***\n       ***\n\n');
        }, 1000);

        // Example 6: Update the support line after a delay
        setTimeout(() => {
            console.log('\n\n       *** Updating support line... ***\n\n');
            
            // Update the support line (returns updated annotation)
            annotations.supportLine = annoManager.updateAnnotation(
                annotations.supportLine, 
                {
                    stroke: '#0000FF',      // change color to blue
                    strokeThickness: 3,     // make line thicker
                    y1: supportPrice - 5    // move the line down by 5 points
                }
            );
            
            console.log('Support line updated:', annotations.supportLine);
        }, 5000);  // 5 second delay
        
        // Example 7: Delete the trend line after a delay
        setTimeout(() => {
            console.log('\n\n       *** Deleting trend line... ***\n\n');
            
            // Delete the trend line
            annotations.trendLine = annoManager.deleteAnnotation(annotations.trendLine);
            
            // annotations.trendLine should now be null
            console.log('Trend line deleted, value is now:', annotations.trendLine);
        }, 10000);  // 10 second delay
        
        // Example 8: Combined operations - update box then change its size
        setTimeout(() => {
            console.log('\n\n       *** Updating box color... ***\n\n');
            
            // First update - change color
            annotations.box = annoManager.updateAnnotation(
                annotations.box,
                {
                    stroke: '#FF00FF'  // Change border color to magenta
                }
            );
            
            // Second update - 2 seconds later, change size
            setTimeout(() => {
                console.log('\n\n       *** Changing box size... ***\n\n');
                
                annotations.box = annoManager.updateAnnotation(
                    annotations.box,
                    {
                        y1: supportPrice - 10,   // Expand bottom edge down
                        y2: resistancePrice + 10 // Expand top edge up
                    }
                );
                
                console.log('Box resized:', annotations.box);
            }, 2000);
            
        }, 15000);  // 15 second delay
        
        // Example 9: Get all annotations and batch process them
        setTimeout(() => {
            console.log('\n\n       *** Getting all annotations... ***\n\n');
            
            annoManager.getAnnotations({}, (annotations) => {
                console.log(`Retrieved ${annotations.length} annotations`);
                
                // Example of filtering and processing annotations
                const now = Date.now();
                const oneHourMs = 60 * 60 * 1000;
                
                // Find annotations older than 1 hour
                const oldAnnotations = annotations.filter(anno => 
                    anno.object.x1 && (now - anno.object.x1 > oneHourMs)
                );
                
                console.log(`Found ${oldAnnotations.length} annotations older than 1 hour`);
                
                // Example of what you might do with these annotations
                if (oldAnnotations.length > 0) {
                    console.log('Would delete these annotations in a real strategy:');
                    oldAnnotations.forEach(anno => {
                        console.log(`- ${anno.annotype} (${anno.unique}): created at ${new Date(anno.object.x1).toLocaleString()}`);
                        // In a real strategy you might do:
                        // annoManager.deleteAnnotation(anno);
                    });
                }
            });
        }, 20000);  // 20 second delay
        
        // Example 10: Get all annotations and extract their IDs
        setTimeout(() => {
            console.log('\n\n       *** Retrieving all annotation IDs... ***\n\n');
            
            annoManager.getAnnotations({
                clientid: clientId,
                instrument: instrument
            }, (annotations) => {
                console.log(`Retrieved ${annotations.length} annotations for client ${clientId} and instrument ${instrument}`);
                
                // Extract and log the ID from each annotation's object JSON
                const annotationIds = annotations.map(annotation => annotation.object.id);
                
                console.log('All annotation IDs:');
                annotationIds.forEach((id, index) => {
                    console.log(`${index + 1}. ${id}`);
                });
                
                // Log the structure of the first annotation as reference (if available)
                if (annotations.length > 0) {
                    console.log('Sample annotation structure:');
                    console.log(`- unique: ${annotations[0].unique}`);
                    console.log(`- annotype: ${annotations[0].annotype}`);
                    console.log(`- id: ${annotations[0].object.id}`);
                    console.log(`- type: ${annotations[0].object.type}`);
                }
            });
        }, 25000);  // 25 second delay
    }
}

// In a browser environment, this function would be called when the page loads
// In a Node.js environment, it would be called directly
if (typeof window !== 'undefined') {
    // Browser environment
    window.addEventListener('DOMContentLoaded', runAnnotationDemo);
} else {
    // Node.js environment
    runAnnotationDemo();
} 