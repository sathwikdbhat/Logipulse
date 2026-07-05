// LogiPulse — api-config.js — Single source of truth for API base URL.

(function () {
    // Works for localhost, ngrok, and Render deployments alike
    window.API_BASE = window.location.origin;
    console.log('LogiPulse API_BASE:', window.API_BASE);
})();