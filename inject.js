(function() {
    // Helper function to send logs directly to the UI overlay
    function streamLog(message) {
        window.postMessage({ type: 'FEDEX_DEBUG_LOG', data: message }, '*');
        console.log(message); // Keep it in the native console too
    }

    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function(method, url) {
        this._url = url;
        return open.apply(this, arguments);
    };

    XHR.send = function() {
        this.addEventListener('load', function() {
            if (this._url && this._url.includes('aura.ApexAction.execute=1')) {
                streamLog(`🚀 [Inject] Intercepted ApexAction request.`);
                try {
                    window.postMessage({ type: 'FEDEX_XHR_INTERCEPT', data: this.responseText }, '*');
                    streamLog('✅ [Inject] Payload piped to overlay UI.');
                } catch (e) {
                    streamLog(`❌ [Inject] Error sending payload: ${e.message}`);
                }
            }
        });
        return send.apply(this, arguments);
    };
    
    streamLog('💉 [Inject] XHR Interceptor locked and loaded.');
})();
