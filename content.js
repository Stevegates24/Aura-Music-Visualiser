// content.js — Aura Music Visualizer
// Injected into every tab to detect and capture audio

(function () {
  if (window.__auraInjected) return;
  window.__auraInjected = true;

  let audioCtx = null;
  let analyser = null;
  let source = null;
  let dataArray = null;
  let animFrame = null;
  let streamPort = null;

  function getMediaElements() {
    return Array.from(document.querySelectorAll('audio, video')).filter(el => !el.paused && el.duration > 0);
  }

  function hasMedia() {
    return getMediaElements().length > 0;
  }

  function setupAnalyser(mediaEl) {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();

      if (source) {
        try { source.disconnect(); } catch(e) {}
      }

      source = audioCtx.createMediaElementSource(mediaEl);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      dataArray = new Uint8Array(analyser.frequencyBinCount);
      return true;
    } catch (e) {
      console.warn('[Aura] Could not capture audio:', e.message);
      return false;
    }
  }

  function startStreaming(port) {
    streamPort = port;
    const els = getMediaElements();
    if (els.length === 0) return false;

    const ok = setupAnalyser(els[0]);
    if (!ok) return false;

    function sendFrame() {
      if (!streamPort) return;
      analyser.getByteFrequencyData(dataArray);
      // Only send every other frame to reduce overhead
      try {
        streamPort.postMessage({
          type: 'AUDIO_DATA',
          data: Array.from(dataArray.slice(0, 512))
        });
      } catch (e) {
        stopStreaming();
        return;
      }
      animFrame = requestAnimationFrame(sendFrame);
    }
    sendFrame();
    return true;
  }

  function stopStreaming() {
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = null;
    streamPort = null;
  }

  // Long-lived connection from visualizer page
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'aura-audio') return;

    port.onMessage.addListener((msg) => {
      if (msg.type === 'START_STREAM') {
        const started = startStreaming(port);
        port.postMessage({ type: 'STREAM_STATUS', ok: started, hasMedia: hasMedia() });
      }
      if (msg.type === 'CHECK_MEDIA') {
        port.postMessage({ type: 'MEDIA_STATUS', hasMedia: hasMedia() });
      }
    });

    port.onDisconnect.addListener(stopStreaming);
  });

  // Short message listener for quick checks
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'CHECK_MEDIA') {
      sendResponse({ hasMedia: hasMedia() });
    }
    return true;
  });
})();
