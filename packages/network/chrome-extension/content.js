// ============================================================================
// MYCA SOVEREIGN WALLET CONTENT SCRIPT
// Bridges isolated Chrome Extension world with webpage DOM context
// ============================================================================

(function () {
  try {
    const container = document.head || document.documentElement;
    const script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.src = chrome.runtime.getURL('inpage.js');
    
    // Inject at the very beginning of the document
    container.insertBefore(script, container.firstChild);
    
    script.onload = function () {
      script.remove(); // Clean up DOM element while preserving execution context
    };
  } catch (err) {
    console.error('Failed to inject MYCA inpage provider:', err);
  }
})();
