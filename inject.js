(function() {
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function(method, url) {
        this._url = url;
        return open.apply(this, arguments);
    };

    XHR.send = function() {
        this.addEventListener('load', function() {
            // Note: I stripped out the "r=63" just in case Salesforce changes that number dynamically per session. 
            // It will still reliably catch the ApexAction.
            if (this._url && this._url.includes('aura.ApexAction.execute=1')) {
                console.log('🚀 [FedEx Helper - Inject] Target XHR intercepted:', this._url);
                try {
                    const responseText = this.responseText;
                    // Send the intercepted data to the content script
                    window.postMessage({ type: 'FEDEX_XHR_INTERCEPT', data: responseText }, '*');
                    console.log('✅ [FedEx Helper - Inject] Payload successfully sent to Content Script.');
                } catch (e) {
                    console.error('❌ [FedEx Helper - Inject] Error reading response:', e);
                }
            }
        });
        return send.apply(this, arguments);
    };
})();
