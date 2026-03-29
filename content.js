// --- 1. Construct the On-Screen UI Overlay ---
const overlayHTML = `
  <div id="fedex-helper-overlay" style="position: fixed; top: 60px; right: 20px; width: 420px; max-height: 85vh; background: #f9f9fb; border: 2px solid #4d148c; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); z-index: 999999; display: flex; flex-direction: column; font-family: 'Segoe UI', Tahoma, sans-serif; overflow: hidden;">
    
    <div style="background: #4d148c; color: white; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; font-size: 16px;">FedEx Agent Assistant</h2>
        <button id="fedex-toggle-btn" style="background: none; border: none; color: white; cursor: pointer; font-size: 14px; font-weight: bold;">[ MINIMIZE ]</button>
    </div>

    <div id="fedex-content-area" style="padding: 15px; overflow-y: auto; flex-grow: 1;">
        <div id="fedex-status" style="margin-bottom: 15px; font-size: 14px; color: #333;">Waiting for tracking data...</div>
        
        <div id="fedex-exception-container" style="display:none; background: #fff3cd; border: 1px solid #ffeeba; border-left: 5px solid #ff9800; padding: 12px; margin-bottom: 15px; border-radius: 4px;"></div>
        
        <h3 style="font-size: 14px; margin: 0 0 8px 0; color: #333;">Recent Scan History</h3>
        <div id="fedex-history-container" style="max-height: 250px; overflow-y: auto; background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 12px;">
            <div style="padding: 10px; color: #777;">No history loaded yet.</div>
        </div>

        <h3 style="font-size: 14px; margin: 15px 0 8px 0; color: #333;">Live Debug Stream</h3>
        <div id="fedex-debug-console" style="background: #1e1e1e; color: #00ff00; font-family: monospace; font-size: 11px; padding: 10px; height: 120px; overflow-y: auto; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word;"></div>
    </div>
  </div>
`;

document.body.insertAdjacentHTML('beforeend', overlayHTML);

// --- 2. Logging & UI Setup ---
const debugConsole = document.getElementById('fedex-debug-console');
const contentArea = document.getElementById('fedex-content-area');
const toggleBtn = document.getElementById('fedex-toggle-btn');

function uiLog(msg) {
    const time = new Date().toLocaleTimeString();
    debugConsole.innerHTML += `<span style="color:#888;">[${time}]</span> ${msg}\n`;
    debugConsole.scrollTop = debugConsole.scrollHeight; // Auto-scroll to bottom
}

toggleBtn.addEventListener('click', () => {
    if (contentArea.style.display === 'none') {
        contentArea.style.display = 'block';
        toggleBtn.innerText = '[ MINIMIZE ]';
    } else {
        contentArea.style.display = 'none';
        toggleBtn.innerText = '[ EXPAND ]';
    }
});

// --- 3. Inject the Network Interceptor ---
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() { this.remove(); };
(document.head || document.documentElement).appendChild(script);
uiLog('⚙️ [Content] Overlay mounted. Injecting XHR interceptor...');

// --- 4. Load CSV Rules ---
let exceptionMap = {};
async function fetchExceptionCodes() {
    try {
        const url = chrome.runtime.getURL("Exception codes.csv");
        const response = await fetch(url);
        const text = await response.text();
        const lines = text.split('\n');
        
        for(let i = 1; i < lines.length; i++) {
            if(!lines[i].trim()) continue;
            const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if(row.length >= 4) {
                const code = row[1].replace(/"/g, '').trim();
                exceptionMap[code] = {
                    whatYouWillSee: row[0].replace(/"/g, '').trim(),
                    whatItMeans: row[2].replace(/"/g, '').trim(),
                    whatToDo: row[3].replace(/"/g, '').trim()
                };
            }
        }
        uiLog(`📊 [Content] Loaded ${Object.keys(exceptionMap).length} exception rules from CSV.`);
    } catch (e) {
        uiLog(`💥 [Content] Failed to load CSV: ${e.message}`);
    }
}
fetchExceptionCodes();

// --- 5. Data Processing Engine ---
window.addEventListener('message', function(event) {
    if (event.source !== window || !event.data) return;

    // Handle incoming debug logs from inject.js
    if (event.data.type === 'FEDEX_DEBUG_LOG') {
        uiLog(event.data.data);
    } 
    // Handle the actual XHR payload
    else if (event.data.type === 'FEDEX_XHR_INTERCEPT') {
        uiLog('📦 [Content] Payload received. Processing...');
        
        try {
            const rawData = JSON.parse(event.data.data);
            if (!rawData.actions || !rawData.actions[0] || !rawData.actions[0].returnValue) return;
            
            const parsedData = JSON.parse(rawData.actions[0].returnValue.returnValue);
            const scanHistory = parsedData.scanHistory || [];
            const trackingNumber = parsedData.shipmentStatus?.trackingNbr || 'Unknown';

            document.getElementById('fedex-status').innerHTML = `<strong>Tracking:</strong> ${trackingNumber}`;
            
            // Find latest exception
            let latestException = null;
            for (let scan of scanHistory) {
                if (scan.scanExceptionCode && scan.scanExceptionCode.trim() !== "") {
                    latestException = scan;
                    break;
                }
            }

            // Update Exception UI
            const exContainer = document.getElementById('fedex-exception-container');
            if (latestException) {
                const code = latestException.scanExceptionCode.trim();
                uiLog(`⚠️ [Content] Exception detected: ${code}`);
                const exInfo = exceptionMap[code];
                
                exContainer.style.display = 'block';
                if (exInfo) {
                    exContainer.innerHTML = `
                        <strong style="color: #856404; font-size: 15px;">🚨 Exception ${code}: ${exInfo.whatYouWillSee}</strong><br>
                        <div style="margin-top: 5px; font-size: 13px; color: #333;"><strong>Meaning:</strong> ${exInfo.whatItMeans}</div>
                        <div style="margin-top: 8px; background: #fff; padding: 8px; border-radius: 4px; border: 1px solid #ffeeba; color: #333;">
                            <strong>Agent Action Required:</strong><br> ${exInfo.whatToDo}
                        </div>
                    `;
                } else {
                    exContainer.innerHTML = `
                        <strong style="color: #856404; font-size: 15px;">🚨 Unmapped Exception Code: ${code}</strong><br>
                        <div style="margin-top: 5px; font-size: 13px; color: #333;"><strong>System Desc:</strong> ${latestException.scanExceptionDesc}</div>
                        <div style="margin-top: 8px; background: #fff; padding: 8px; border-radius: 4px; border: 1px solid #ffeeba; color: #333;">Code not found in CSV. Escalate to team lead.</div>
                    `;
                }
            } else {
                exContainer.style.display = 'none';
                uiLog('✅ [Content] No active exceptions found.');
            }

            // Update Timeline UI
            const histContainer = document.getElementById('fedex-history-container');
            histContainer.innerHTML = scanHistory.map(scan => {
                const hasException = scan.scanExceptionCode && scan.scanExceptionCode.trim() !== "";
                const badgeColor = hasException ? '#d32f2f' : '#4d148c';
                return `
                <div style="border-bottom: 1px solid #f0f0f0; padding: 8px 10px; line-height: 1.4;">
                    <span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 10px; margin-right: 5px;">${scan.scanDate} ${scan.scanTime}</span>
                    <strong style="color: #333;">${scan.scanStatus}</strong> 
                    <span style="color: #666;">(${scan.stationLocation || 'System'})</span>
                    ${hasException ? `<br><span style="color:#d32f2f; font-weight: bold; display: inline-block; margin-top: 4px;">↳ Exception Code: ${scan.scanExceptionCode} - ${scan.scanExceptionDesc}</span>` : ''}
                </div>
            `}).join('');

            uiLog('✅ [Content] UI updated successfully.');

        } catch (e) {
            uiLog(`💥 [Content] Data Parse Error: ${e.message}`);
        }
    }
});
