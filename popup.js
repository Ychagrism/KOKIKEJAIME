document.addEventListener('DOMContentLoaded', async () => {
    console.log('🖥️ [FedEx Helper - Popup] Initialized. Fetching rules and data...');
    const exceptionMap = await fetchExceptionCodes();

    chrome.storage.local.get(['latestFedExData'], function(result) {
        if (!result.latestFedExData) {
            console.log('📭 [FedEx Helper - Popup] No tracking data found in storage.');
            return;
        }

        try {
            console.log('🛠️ [FedEx Helper - Popup] Parsing intercepted JSON...');
            const rawData = JSON.parse(result.latestFedExData);
            
            // The actual payload is hidden inside actions[0].returnValue.returnValue as a string
            if (!rawData.actions || !rawData.actions[0] || !rawData.actions[0].returnValue) return;
            const nestedJsonString = rawData.actions[0].returnValue.returnValue;
            const parsedData = JSON.parse(nestedJsonString);

            const scanHistory = parsedData.scanHistory || [];
            const trackingNumber = parsedData.shipmentStatus?.trackingNbr || 'Unknown';

            document.getElementById('status').innerHTML = `<strong>Active Tracking:</strong> ${trackingNumber}`;

            // Find the most recent exception code (iterating from the top of the history array)
            let latestException = null;
            for (let scan of scanHistory) {
                if (scan.scanExceptionCode && scan.scanExceptionCode.trim() !== "") {
                    latestException = scan;
                    break;
                }
            }

            // Render Exception Action Box
            if (latestException) {
                const code = latestException.scanExceptionCode.trim();
                console.log(`⚠️ [FedEx Helper - Popup] Found Exception Code: ${code}`);
                
                const exInfo = exceptionMap[code];
                const exContainer = document.getElementById('exception-container');
                exContainer.style.display = 'block';

                if (exInfo) {
                    exContainer.innerHTML = `
                        <div class="exception-card">
                            <strong style="font-size: 15px;">🚨 Exception ${code}: ${exInfo.whatYouWillSee}</strong><br>
                            <div style="margin-top: 5px; font-size: 13px;"><strong>Meaning:</strong> ${exInfo.whatItMeans}</div>
                            <div class="action-step">
                                <strong>Agent Action Required:</strong><br> ${exInfo.whatToDo}
                            </div>
                        </div>
                    `;
                } else {
                    // Fallback if code isn't in the CSV
                    exContainer.innerHTML = `
                        <div class="exception-card">
                            <strong>🚨 Unmapped Exception Code: ${code}</strong><br>
                            <div style="margin-top: 5px; font-size: 13px;"><strong>System Desc:</strong> ${latestException.scanExceptionDesc}</div>
                            <div class="action-step">Code not found in Exception Map. Escalate to team lead if unsure.</div>
                        </div>
                    `;
                }
            }

            // Render the timeline
            const histContainer = document.getElementById('history-container');
            histContainer.innerHTML = scanHistory.map(scan => {
                const hasException = scan.scanExceptionCode && scan.scanExceptionCode.trim() !== "";
                return `
                <div class="history-item">
                    <span class="badge ${hasException ? 'badge-alert' : ''}">${scan.scanDate} ${scan.scanTime}</span>
                    <strong>${scan.scanStatus}</strong> 
                    <span style="color: #666;">(${scan.stationLocation || 'System'})</span>
                    ${hasException ? `<br><span style="color:#d32f2f; font-weight: bold;">↳ Exception Code: ${scan.scanExceptionCode} - ${scan.scanExceptionDesc}</span>` : ''}
                </div>
            `}).join('');
            
            console.log('✅ [FedEx Helper - Popup] Render complete.');

        } catch (e) {
            console.error('💥 [FedEx Helper - Popup] JSON Parse Error:', e);
            document.getElementById('status').innerText = 'Error processing tracking data. Check console.';
        }
    });
});

// Helper function to read and parse the CSV file
async function fetchExceptionCodes() {
    try {
        const url = chrome.runtime.getURL("Exception codes.csv");
        const response = await fetch(url);
        const text = await response.text();
        
        const lines = text.split('\n');
        const map = {};
        
        // Skip header row (i=1)
        for(let i = 1; i < lines.length; i++) {
            if(!lines[i].trim()) continue;
            // This Regex cleanly splits CSVs while ignoring commas inside quotation marks
            const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            
            if(row.length >= 4) {
                const code = row[1].replace(/"/g, '').trim();
                map[code] = {
                    whatYouWillSee: row[0].replace(/"/g, '').trim(),
                    whatItMeans: row[2].replace(/"/g, '').trim(),
                    whatToDo: row[3].replace(/"/g, '').trim()
                };
            }
        }
        console.log(`📊 [FedEx Helper - Popup] Loaded ${Object.keys(map).length} exception rules from CSV.`);
        return map;
    } catch (e) {
        console.error('💥 [FedEx Helper - Popup] Failed to load Exception codes.csv', e);
        return {};
    }
}
