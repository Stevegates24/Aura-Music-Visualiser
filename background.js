// background.js — Aura v2
// Uses tabCapture (non-destructive) instead of MediaElementSource

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OPEN_VISUALIZER') {
    const tabId = msg.tabId;

    // Get a capture stream ID for the tab — must be called from background
    // while the tab is still the active/focused tab
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      if (chrome.runtime.lastError || !streamId) {
        // Open visualizer anyway, it will show error
        chrome.tabs.create({
          url: chrome.runtime.getURL('visualizer.html')
            + '?preset=' + (msg.preset || 'waves')
            + '&error=capture_failed'
        });
        sendResponse({ ok: false });
        return;
      }

      // Store streamId so visualizer page can pick it up
      chrome.storage.session.set({
        streamId,
        preset: msg.preset || 'waves',
        sourceTabId: tabId
      }, () => {
        chrome.tabs.create({
          url: chrome.runtime.getURL('visualizer.html')
            + '?preset=' + (msg.preset || 'waves')
        });
      });

      sendResponse({ ok: true, streamId });
    });

    return true; // keep channel open for async response
  }
});
