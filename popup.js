// popup.js — Aura v2

// ── Mini wave animation ──────────────────────────────
const canvas = document.getElementById('miniWave');
const ctx = canvas.getContext('2d');
let t = 0;

function resizeCanvas() {
  canvas.width  = canvas.offsetWidth  * devicePixelRatio;
  canvas.height = canvas.offsetHeight * devicePixelRatio;
}
resizeCanvas();

function drawMiniWave() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const waves = [
    { amp: 0.30, freq: 0.018, speed: 0.014, color: 'rgba(124,58,237,0.45)',  phase: 0   },
    { amp: 0.20, freq: 0.027, speed: 0.021, color: 'rgba(167,139,250,0.30)', phase: 1.5 },
    { amp: 0.13, freq: 0.040, speed: 0.029, color: 'rgba(244,114,182,0.22)', phase: 3.0 },
  ];
  waves.forEach(wv => {
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const y = h / 2
        + Math.sin(x * wv.freq + t * wv.speed + wv.phase) * h * wv.amp
        + Math.sin(x * wv.freq * 2.1 + t * wv.speed * 1.6 + wv.phase) * h * wv.amp * 0.22;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, wv.color); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fill();
  });
  t++;
  requestAnimationFrame(drawMiniWave);
}
drawMiniWave();

// ── Preset selection ─────────────────────────────────
let selectedPreset = 'waves';
document.querySelectorAll('.preset-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedPreset = chip.dataset.preset;
  });
});

// ── Media check ──────────────────────────────────────
async function checkMedia() {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // Simple heuristic: tab is audible or title suggests media
    if (tab.audible) {
      dot.classList.remove('no-media');
      txt.textContent = 'Audio playing — ready';
    } else {
      dot.classList.add('no-media');
      txt.textContent = 'No audio detected in tab';
    }
  } catch (e) {
    txt.textContent = 'Could not access tab';
  }
}
checkMedia();

// ── Launch ───────────────────────────────────────────
document.getElementById('launchBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const btn = document.getElementById('launchBtn');
  btn.textContent = 'Opening…';
  btn.style.opacity = '0.7';

  chrome.runtime.sendMessage(
    { type: 'OPEN_VISUALIZER', tabId: tab.id, preset: selectedPreset },
    () => { window.close(); }
  );
});
