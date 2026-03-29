// Inject the interceptor directly into the DOM
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    this.remove(); // Clean up the DOM after injection
};
(document.head || document.documentElement).appendChild(script);

console.log('💉 [FedEx Helper - Content] Interceptor script injected into main world.');

// Listen for the payload from inject.js
window.addEventListener('message', function(event) {
    if (event.source !== window || !event.data || event.data.type !== 'FEDEX_XHR_INTERCEPT') return;

    console.log('📦 [FedEx Helper - Content] Received payload. Saving to local storage...');

    // Save the raw JSON string to Chrome's local storage
    chrome.storage.local.set({ latestFedExData: event.data.data }, function() {
        console.log('💾 [FedEx Helper - Content] Data successfully saved for popup access.');
    });
});
