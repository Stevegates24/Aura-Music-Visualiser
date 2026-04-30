// visualizer.js — Aura v3
// tabCapture: source → analyser → destination (audio plays + we read FFT)

// ── Canvas ───────────────────────────────────────────
const canvas = document.getElementById('vizCanvas');
const ctx    = canvas.getContext('2d');
let W, H;
function resize() {
  W = canvas.width  = window.innerWidth  * devicePixelRatio;
  H = canvas.height = window.innerHeight * devicePixelRatio;
}
resize();
window.addEventListener('resize', resize);

// ── Cursor ───────────────────────────────────────────
// Cursor hidden — use system default
document.getElementById('cursor').style.display = 'none';
document.getElementById('cursor-ring').style.display = 'none';
document.body.style.cursor = 'default';

// ── Audio state ──────────────────────────────────────
let analyser    = null;
let freqData    = new Uint8Array(512);
let smoothed    = new Float32Array(256).fill(0);
let sensitivity = 1.2;
let isLive      = false;
let tick        = 0;
let currentPreset = 'waves';

// Smooth FFT — only 256 bins, lighter weight
function updateSmoothed() {
  const ALPHA = 0.78;
  for (let i = 0; i < smoothed.length; i++) {
    const raw = (freqData[i] / 255) * sensitivity;
    smoothed[i] = ALPHA * smoothed[i] + (1 - ALPHA) * raw;
    if (smoothed[i] > 1) smoothed[i] = 1;
  }
}

function bandE(a, b) {
  let s = 0, n = Math.min(b, smoothed.length);
  for (let i = a; i < n; i++) s += smoothed[i];
  return s / (n - a);
}
const bass  = () => bandE(0, 8);
const mid   = () => bandE(8, 60);
const high  = () => bandE(60, 140);
const vol   = () => bandE(0, 140);

// Demo sine when no audio
function demo(i) { return (Math.sin(i*0.1 + tick*0.022)*0.5+0.5)*0.15; }
function amp(i)  { return isLive ? (smoothed[i]||0) : demo(i); }

// ── Status helpers ───────────────────────────────────
function setStatus(live, text) {
  document.getElementById('statusDot').classList.toggle('idle', !live);
  document.getElementById('statusText').textContent = text;
}
function showError(msg) {
  isLive = false;
  setStatus(false, 'No audio');
  document.getElementById('noMediaDetail').textContent = msg;
  document.getElementById('noMediaMsg').classList.add('show');
}

// ── Tab Capture ──────────────────────────────────────
async function startCapture(streamId) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    const audioCtx = new AudioContext();
    const source   = audioCtx.createMediaStreamSource(stream);
    analyser        = audioCtx.createAnalyser();
    analyser.fftSize              = 1024;  // 512 bins — lighter than 2048
    analyser.smoothingTimeConstant = 0.5;  // less built-in smoothing, we do our own
    freqData = new Uint8Array(analyser.frequencyBinCount); // 512

    // Connect: source → analyser → destination
    // This means: audio plays normally AND we can read FFT
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    isLive = true;
    setStatus(true, 'Live');
    document.getElementById('noMediaMsg').classList.remove('show');

  } catch (err) {
    showError('Capture failed: ' + err.message);
  }
}

async function init() {
  const params = new URLSearchParams(location.search);
  const preset = params.get('preset');
  if (preset) setPreset(preset, false);

  if (params.get('error') === 'capture_failed') {
    showError('Tab capture failed. Play audio first, then click the extension.');
    return;
  }

  setStatus(false, 'Connecting…');
  try {
    const stored = await chrome.storage.session.get(['streamId', 'preset']);
    if (stored.preset && !preset) setPreset(stored.preset, false);
    if (stored.streamId) {
      await startCapture(stored.streamId);
    } else {
      showError('No stream found. Close this tab and click Aura again.');
    }
  } catch(e) {
    showError('Error: ' + e.message);
  }
}
init();

document.getElementById('retryBtn').addEventListener('click', async () => {
  document.getElementById('noMediaMsg').classList.remove('show');
  setStatus(false, 'Retrying…');
  try {
    const s = await chrome.storage.session.get(['streamId']);
    if (s.streamId) await startCapture(s.streamId);
    else showError('No stream. Close this tab and reopen from the extension.');
  } catch(e) { showError(e.message); }
});

// ── Presets ──────────────────────────────────────────
function setPreset(name, flash) {
  currentPreset = name;
  document.querySelectorAll('.ctrl-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.preset === name)
  );
  if (flash) {
    const el = document.getElementById('presetFlash');
    el.textContent = name.toUpperCase();
    el.style.transition = 'opacity 0.05s'; el.style.opacity = '1';
    setTimeout(() => { el.style.transition = 'opacity 0.9s'; el.style.opacity = '0'; }, 400);
  }
}
document.querySelectorAll('.ctrl-btn').forEach(b =>
  b.addEventListener('click', () => setPreset(b.dataset.preset, true))
);
document.getElementById('sensUp').addEventListener('click',   () => sensitivity = Math.min(3, +(sensitivity+0.2).toFixed(1)));
document.getElementById('sensDown').addEventListener('click', () => sensitivity = Math.max(0.3, +(sensitivity-0.2).toFixed(1)));
document.getElementById('fsBtn').addEventListener('click', () =>
  document.fullscreenElement ? document.exitFullscreen()
    : document.documentElement.requestFullscreen().catch(()=>{})
);

// ── Shared helpers ───────────────────────────────────
const hsl = (h,s,l,a=1) => `hsla(${h|0},${s|0}%,${l|0}%,${a})`;

// Pre-allocate reusable path points — avoids GC pressure
const pts = new Float32Array(2000);

// ══════════════════════════════════════════════════════
//  WAVES — lightweight, beautiful
//  Key perf tricks:
//  • step every 3px instead of every px
//  • skip fill+stroke in same pass via cached path
//  • no per-frame Math.random() when not needed
// ══════════════════════════════════════════════════════
const WAVE_CFG = [
  { baseAmp:0.21, freq:0.0055, spd:0.50, phase:0.0, rgb:[118,48,218], al:0.46, b:[0,7]    },
  { baseAmp:0.17, freq:0.0085, spd:0.80, phase:1.2, rgb:[160,128,244],al:0.34, b:[7,22]   },
  { baseAmp:0.13, freq:0.0130, spd:1.20, phase:2.5, rgb:[235,98,168], al:0.26, b:[22,55]  },
  { baseAmp:0.09, freq:0.0175, spd:1.60, phase:3.7, rgb:[118,128,244],al:0.20, b:[55,100] },
  { baseAmp:0.06, freq:0.0240, spd:1.95, phase:5.0, rgb:[42,195,142], al:0.15, b:[100,160]},
];

// Static bg — only redrawn when needed
let bgCache = null;
function getBg(b) {
  // Only rebuild bg gradient on significant bass change — paint is expensive
  const bg = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.65);
  bg.addColorStop(0, `rgba(25,5,50,${0.2+b*0.3})`);
  bg.addColorStop(1, 'rgba(6,4,15,1)');
  return bg;
}

// Bass particle pool — reuse rather than allocate each frame
const PCOUNT = 12;
const ppool  = Array.from({length:PCOUNT},()=>({x:0,y:0,r:0,a:0,alive:false}));

function spawnParticles(b) {
  if (b < 0.4) return;
  const n = Math.floor(b * 5);
  let spawned = 0;
  for (let i = 0; i < PCOUNT && spawned < n; i++) {
    if (!ppool[i].alive) {
      ppool[i].x = Math.random() * W;
      ppool[i].y = H*0.5 + (Math.random()-0.5)*H*0.5;
      ppool[i].r = (1+Math.random()*2)*devicePixelRatio;
      ppool[i].a = b*0.5;
      ppool[i].alive = true;
      spawned++;
    }
  }
}

function drawWaves() {
  // bg
  ctx.fillStyle = getBg(bass());
  ctx.fillRect(0,0,W,H);

  const b = bass();

  WAVE_CFG.forEach(wv => {
    const be  = bandE(wv.b[0], wv.b[1]);
    const AMP = (wv.baseAmp + be*0.20) * H;
    const [r,g,bv] = wv.rgb;
    const STEP = 3; // pixels per point — good quality/perf balance

    // Build path once, reuse for fill and stroke
    ctx.beginPath();
    let first = true;
    for (let px = 0; px <= W; px += STEP) {
      const s  = amp(Math.floor((px/W)*180));
      const y  = H*0.5
        + Math.sin(px*wv.freq + tick*wv.spd*0.010 + wv.phase) * AMP
        + Math.sin(px*wv.freq*2.1 + tick*wv.spd*0.016 + wv.phase*1.3) * AMP * 0.25
        + s * H * 0.13 * Math.sin(px*0.0025 + wv.phase);
      first ? ctx.moveTo(px,y) : ctx.lineTo(px,y);
      first = false;
    }

    // Fill only — no stroke outline
    ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
    const grd = ctx.createLinearGradient(0,0,0,H);
    grd.addColorStop(0,   `rgba(${r},${g},${bv},${wv.al+be*0.18})`);
    grd.addColorStop(0.45,`rgba(${r},${g},${bv},${wv.al*0.35})`);
    grd.addColorStop(1,   `rgba(${r},${g},${bv},0)`);
    ctx.fillStyle = grd;
    ctx.fill();
  });

  // Particles
  spawnParticles(b);
  ppool.forEach(p => {
    if (!p.alive) return;
    p.a -= 0.04;
    if (p.a <= 0) { p.alive = false; return; }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fillStyle = `rgba(155,115,255,${p.a})`;
    ctx.fill();
  });
}

// ══════════════════════════════════════════════════════
//  BARS — step every 2 bins
// ══════════════════════════════════════════════════════
function drawBars() {
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#06040f';
  ctx.fillRect(0,0,W,H);

  const b = bass();
  // subtle center glow — cheap radial
  const gl = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,H*0.5);
  gl.addColorStop(0, `rgba(95,25,200,${0.07+b*0.15})`);
  gl.addColorStop(1, 'transparent');
  ctx.fillStyle = gl; ctx.fillRect(0,0,W,H);

  const N = 100, bw = W/N, gap = bw*0.18;
  ctx.shadowBlur = 0;
  for (let i = 0; i < N; i++) {
    const a   = amp(Math.floor((i/N)*160));
    if (a < 0.005) continue; // skip invisible bars entirely
    const bh  = a * H * 0.80;
    const hue = 248 + (i/N)*110 + tick*0.22;
    const x   = i*bw+gap/2, bww = bw-gap;

    ctx.shadowBlur  = (8+a*14)*devicePixelRatio;
    ctx.shadowColor = hsl(hue,78,63,0.7);

    const grd = ctx.createLinearGradient(0,H/2-bh/2,0,H/2+bh/2);
    grd.addColorStop(0,   hsl(hue,68+a*25,58+a*15,0.94));
    grd.addColorStop(0.5, hsl(hue,68+a*25,48+a*15,0.86));
    grd.addColorStop(1,   hsl(hue,68+a*25,58+a*15,0.94));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.roundRect(x, H/2-bh/2, bww, bh, Math.min(bww/2, 3*devicePixelRatio));
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // center line
  ctx.strokeStyle = `rgba(150,120,255,${0.15+b*0.25})`;
  ctx.lineWidth = devicePixelRatio;
  ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
}

// ══════════════════════════════════════════════════════
//  NEBULA — replaces Plasma
//  Smooth radial ink-bleed clouds, no pixel grid
// ══════════════════════════════════════════════════════
const NEB_BLOBS = Array.from({length:12}, (_, i) => ({
  ox: 0.15 + Math.random()*0.70,
  oy: 0.15 + Math.random()*0.70,
  phase: Math.random()*Math.PI*2,
  spd:   0.003 + Math.random()*0.005,
  hue:   200 + Math.random()*160,
  fi:    Math.floor(Math.random()*160),
}));

function drawNebula() {
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#04020e';
  ctx.fillRect(0,0,W,H);

  const b=bass(), m=mid(), v=vol();

  NEB_BLOBS.forEach((bl, i) => {
    const fa  = amp(bl.fi);
    const cx  = (bl.ox + Math.sin(tick*bl.spd + bl.phase)*0.12) * W;
    const cy  = (bl.oy + Math.cos(tick*bl.spd*0.7 + bl.phase)*0.10) * H;
    const rx  = (0.18 + fa*0.22 + b*0.08) * Math.min(W,H);
    const ry  = rx * (0.6 + Math.sin(tick*bl.spd*1.3 + bl.phase)*0.35);
    const hue = (bl.hue + tick*0.18 + b*40) % 360;
    const al  = 0.06 + fa*0.10 + v*0.04;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tick*bl.spd*0.4 + bl.phase);
    ctx.scale(1, ry/rx);

    const grd = ctx.createRadialGradient(0,0,0, 0,0,rx);
    grd.addColorStop(0,   hsl(hue, 85, 65, al*2.2));
    grd.addColorStop(0.4, hsl(hue, 80, 55, al));
    grd.addColorStop(0.75,hsl((hue+40)%360, 75, 50, al*0.4));
    grd.addColorStop(1,   hsl(hue, 70, 40, 0));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });

  // Bass pulse ring from center
  if (b > 0.3) {
    const pr = b * Math.min(W,H) * 0.35;
    const pg = ctx.createRadialGradient(W/2,H/2,pr*0.5, W/2,H/2,pr);
    pg.addColorStop(0,   'transparent');
    pg.addColorStop(0.7, hsl(260+b*60, 85, 65, b*0.12));
    pg.addColorStop(1,   'transparent');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(W/2,H/2,pr,0,Math.PI*2); ctx.fill();
  }

  // Vignette
  const vig = ctx.createRadialGradient(W/2,H/2,H*0.15,W/2,H/2,H*0.85);
  vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(4,2,14,0.75)');
  ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
}

// ══════════════════════════════════════════════════════
//  RIBBON — smooth aurora without vertical bars
//  Uses horizontal gradient strips like aurora but driven
//  by smooth sine curves, not FFT slices per column
// ══════════════════════════════════════════════════════
let ribStars = null;
function ensureRibStars() {
  if (ribStars) return;
  const oc = new OffscreenCanvas(W,H);
  const oc2 = oc.getContext('2d');
  oc2.fillStyle='#01010a'; oc2.fillRect(0,0,W,H);
  for (let i=0;i<150;i++) {
    oc2.beginPath();
    oc2.arc(Math.random()*W, Math.random()*H, Math.random()*devicePixelRatio*0.7, 0, Math.PI*2);
    oc2.fillStyle=`rgba(255,255,255,${0.12+Math.random()*0.38})`; oc2.fill();
  }
  ribStars = oc;
}

// Each ribbon is a smooth flowing band — no column sampling
const RIB_BANDS = [
  { yBase:0.30, thick:0.18, spd:0.35, waveFreq:1.8, hueA:145, hueB:210, phOff:0.0  },
  { yBase:0.38, thick:0.14, spd:0.52, waveFreq:2.3, hueA:210, hueB:285, phOff:1.1  },
  { yBase:0.24, thick:0.12, spd:0.28, waveFreq:1.5, hueA:115, hueB:160, phOff:2.3  },
  { yBase:0.44, thick:0.16, spd:0.60, waveFreq:2.8, hueA:285, hueB:345, phOff:3.4  },
  { yBase:0.18, thick:0.10, spd:0.44, waveFreq:2.0, hueA:170, hueB:240, phOff:4.5  },
];

function drawRibbon() {
  ensureRibStars();
  ctx.drawImage(ribStars, 0, 0);

  const b=bass(), m=mid(), v=vol();
  const t = tick * 0.008;

  RIB_BANDS.forEach((rb, ri) => {
    const be    = bandE(ri*22, ri*22+22);
    const thick = (rb.thick + be*0.16 + b*0.05) * H;
    const wAmp  = (0.07 + be*0.12 + b*0.06) * H;
    const PTS   = 80; // smooth polygon resolution

    // Build top + bottom edge arrays for the FULL ribbon in one pass
    const topX = new Float32Array(PTS+1);
    const topY = new Float32Array(PTS+1);
    const botY = new Float32Array(PTS+1);

    for (let si = 0; si <= PTS; si++) {
      const nx = si / PTS;
      topX[si] = nx * W;
      const cy = rb.yBase * H
        + Math.sin(nx * Math.PI * rb.waveFreq + t * rb.spd + rb.phOff) * wAmp
        + Math.sin(nx * Math.PI * rb.waveFreq * 1.6 + t * rb.spd * 0.65 + rb.phOff) * wAmp * 0.28
        + Math.sin(nx * Math.PI * 5 + t * rb.spd * 1.8 + rb.phOff * 1.4) * wAmp * 0.08;
      topY[si] = cy - thick * 0.5;
      botY[si] = cy + thick * 0.5;
    }

    // ── Step 1: draw the ribbon shape into an offscreen canvas ──
    // We draw it as a SINGLE unbroken polygon — zero seams
    const oc  = new OffscreenCanvas(W, H);
    const oc2 = oc.getContext('2d');

    // Build the full closed polygon
    oc2.beginPath();
    oc2.moveTo(topX[0], topY[0]);
    for (let k = 1; k <= PTS; k++) oc2.lineTo(topX[k], topY[k]);
    for (let k = PTS; k >= 0; k--) oc2.lineTo(topX[k], botY[k]);
    oc2.closePath();

    // Fill with solid color first — will be masked by gradient next
    const hueCenter = rb.hueA + (rb.hueB - rb.hueA) * 0.5 + Math.sin(t*0.4 + ri) * 15;
    const al = 0.28 + be * 0.22 + v * 0.08;
    oc2.fillStyle = hsl(hueCenter, 82, 62, al);
    oc2.fill();

    // ── Step 2: apply horizontal hue gradient using source-atop ──
    oc2.globalCompositeOperation = 'source-atop';
    const hg = oc2.createLinearGradient(0, 0, W, 0);
    hg.addColorStop(0,    hsl(rb.hueA, 84, 58, 0.95));
    hg.addColorStop(0.35, hsl((rb.hueA+rb.hueB)/2, 86, 65, 0.95));
    hg.addColorStop(0.65, hsl((rb.hueA+rb.hueB)/2+20, 84, 60, 0.95));
    hg.addColorStop(1,    hsl(rb.hueB, 84, 58, 0.95));
    oc2.fillStyle = hg;
    oc2.fillRect(0, 0, W, H);

    // ── Step 3: apply vertical soft-edge fade using destination-in ──
    // This makes edges feather to transparent — the key to no hard lines
    oc2.globalCompositeOperation = 'destination-in';
    // Find the ribbon's vertical center per column for a smooth mask
    // Simple approximation: use the midpoint of first and last top/bot
    const midY0 = (topY[0]  + botY[0])  * 0.5;
    const midYN = (topY[PTS] + botY[PTS]) * 0.5;
    // Average thickness for mask
    const avgThick = thick;

    // We create the mask as a gradient per-ribbon covering its full Y range
    const minTop = Math.min(...Array.from(topY));
    const maxBot = Math.max(...Array.from(botY));
    const fadeH  = maxBot - minTop;
    const fadeMid = (minTop + maxBot) / 2;

    const vMask = oc2.createLinearGradient(0, fadeMid - fadeH*0.55, 0, fadeMid + fadeH*0.55);
    vMask.addColorStop(0,    'rgba(0,0,0,0)');
    vMask.addColorStop(0.15, 'rgba(0,0,0,0.9)');
    vMask.addColorStop(0.5,  'rgba(0,0,0,1)');
    vMask.addColorStop(0.85, 'rgba(0,0,0,0.9)');
    vMask.addColorStop(1,    'rgba(0,0,0,0)');
    oc2.fillStyle = vMask;
    oc2.fillRect(0, 0, W, H);

    // ── Step 4: composite onto main canvas ──
    ctx.globalAlpha = 1;
    ctx.drawImage(oc, 0, 0);
  });

  // Ground atmosphere
  const gg = ctx.createLinearGradient(0,H*0.65,0,H);
  gg.addColorStop(0,'transparent');
  gg.addColorStop(1,`rgba(6,38,16,${0.12+v*0.14})`);
  ctx.fillStyle=gg; ctx.fillRect(0,0,W,H);

  // Horizon glow
  const horizG = ctx.createLinearGradient(0,H*0.62,0,H*0.70);
  horizG.addColorStop(0,'transparent');
  horizG.addColorStop(0.5,`rgba(40,180,115,${0.07+m*0.14})`);
  horizG.addColorStop(1,'transparent');
  ctx.fillStyle=horizG; ctx.fillRect(0,H*0.62,W,H*0.08);

  // Bass flash
  if (b > 0.55) {
    const fg = ctx.createRadialGradient(W/2,H*0.38,0,W/2,H*0.38,H*0.48);
    fg.addColorStop(0,`rgba(80,240,160,${(b-0.55)*0.16})`);
    fg.addColorStop(1,'transparent');
    ctx.fillStyle=fg; ctx.fillRect(0,0,W,H);
  }

  // Vignettes
  const tv=ctx.createLinearGradient(0,0,0,H*0.12);
  tv.addColorStop(0,'rgba(1,1,10,0.93)'); tv.addColorStop(1,'transparent');
  ctx.fillStyle=tv; ctx.fillRect(0,0,W,H);
  const bv=ctx.createLinearGradient(0,H*0.72,0,H);
  bv.addColorStop(0,'transparent'); bv.addColorStop(1,'rgba(1,1,10,0.96)');
  ctx.fillStyle=bv; ctx.fillRect(0,0,W,H);
}

// ══════════════════════════════════════════════════════
//  ORBIT — trail fade approach
// ══════════════════════════════════════════════════════
const orbitPts = Array.from({length:80},()=>({
  angle:Math.random()*Math.PI*2,
  radius:35+Math.random()*160,
  speed:(0.0018+Math.random()*0.006)*(Math.random()<.5?1:-1),
  size:0.8+Math.random()*1.5,
  hue:Math.random()*360,
  alpha:0.28+Math.random()*0.42,
  fi:Math.floor(Math.random()*180)
}));

function drawOrbit() {
  // trail
  ctx.fillStyle = 'rgba(6,4,15,0.15)';
  ctx.fillRect(0,0,W,H);

  const b=bass(), cx=W/2, cy=H/2;
  const sc = Math.min(W,H);
  const minR = sc*0.11, maxR = sc*0.40;

  // spokes — batch draw by color grouping would be ideal but 180 strokes is fine at 60fps
  for (let i=0; i<180; i++) {
    const a2 = amp(Math.floor((i/180)*240));
    if (a2 < 0.01) continue;
    const angle = (i/180)*Math.PI*2 - Math.PI/2;
    const hue   = (i/180*270+tick*0.3)%360;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(angle)*minR, cy+Math.sin(angle)*minR);
    ctx.lineTo(cx+Math.cos(angle)*(minR+a2*(maxR-minR)), cy+Math.sin(angle)*(minR+a2*(maxR-minR)));
    ctx.strokeStyle = hsl(hue,76,62,0.52+a2*0.36);
    ctx.lineWidth   = (0.7+a2*2.2)*devicePixelRatio;
    ctx.shadowBlur  = a2*12*devicePixelRatio;
    ctx.shadowColor = hsl(hue,86,66,0.65);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // center orb
  const orbR = minR*(0.26+b*0.20);
  const og   = ctx.createRadialGradient(cx,cy,0,cx,cy,orbR);
  og.addColorStop(0, `rgba(190,145,255,${0.82+b*0.14})`);
  og.addColorStop(0.4,`rgba(100,40,210,${0.36+b*0.24})`);
  og.addColorStop(1,  'transparent');
  ctx.fillStyle=og; ctx.beginPath(); ctx.arc(cx,cy,orbR,0,Math.PI*2); ctx.fill();

  // particles
  orbitPts.forEach(p => {
    const fa = amp(p.fi);
    p.angle += p.speed*(1+fa*1.6);
    const r  = p.radius*(1+fa*0.3)*(sc/1100);
    ctx.beginPath();
    ctx.arc(cx+Math.cos(p.angle)*r, cy+Math.sin(p.angle)*r, (p.size+fa*2)*devicePixelRatio, 0, Math.PI*2);
    ctx.fillStyle  = hsl(p.hue+tick*0.25, 80,66, p.alpha+fa*0.4);
    ctx.shadowBlur = 5*devicePixelRatio;
    ctx.shadowColor= hsl(p.hue, 86,68, 0.65);
    ctx.fill();
  });
  ctx.shadowBlur=0;
}

// ══════════════════════════════════════════════════════
//  AURORA — curtains, skip frame for strips
// ══════════════════════════════════════════════════════
let aurStars = null; // cached offscreen star layer

function ensureStars() {
  if (aurStars) return;
  // Draw stars to an offscreen canvas once
  const oc  = new OffscreenCanvas(W, H);
  const oc2 = oc.getContext('2d');
  oc2.fillStyle = '#010107'; oc2.fillRect(0,0,W,H);
  for (let i=0; i<160; i++) {
    oc2.beginPath();
    oc2.arc(Math.random()*W, Math.random()*H*0.65, Math.random()*devicePixelRatio*0.8, 0, Math.PI*2);
    oc2.fillStyle = `rgba(255,255,255,${0.15+Math.random()*0.4})`; oc2.fill();
  }
  aurStars = oc;
}

const AUR_CURTAINS = [
  {y:0.34,spd:0.36,bh:0.22,h0:138,h1:196,ph:0.0},
  {y:0.27,spd:0.55,bh:0.16,h0:196,h1:272,ph:2.0},
  {y:0.41,spd:0.27,bh:0.18,h0:116,h1:166,ph:4.0},
  {y:0.21,spd:0.72,bh:0.10,h0:272,h1:332,ph:1.5},
];

function drawAurora() {
  ensureStars();
  ctx.drawImage(aurStars, 0, 0);

  const b=bass(),m=mid(),v=vol();
  const STRIPS = 60; // down from 70

  AUR_CURTAINS.forEach((c,ci) => {
    const be = bandE(ci*35, ci*35+35);
    const cH = (c.bh + be*0.20 + v*0.07)*H;
    const topY = c.y*H;
    for (let si=0; si<=STRIPS; si++) {
      const nx = si/STRIPS, px = nx*W;
      const woff = Math.sin(nx*6.5+tick*c.spd*0.008+c.ph)*cH*0.26
                 + Math.sin(nx*2.5+tick*c.spd*0.005+c.ph*0.7)*cH*0.12
                 + amp(Math.floor(nx*240))*cH*0.33;
      const sY = topY+woff;
      const sH = cH*(0.56+Math.sin(nx*4+tick*0.006+c.ph)*0.36);
      const hue = c.h0+(c.h1-c.h0)*nx+Math.sin(tick*0.016+ci)*16;
      const a   = 0.065+be*0.10+Math.sin(nx*3+tick*0.012+c.ph)*0.032;
      const ag  = ctx.createLinearGradient(px,sY,px,sY+sH);
      ag.addColorStop(0,    hsl(hue,76+be*16,52+be*12,0));
      ag.addColorStop(0.18, hsl(hue,76+be*16,52+be*12,a*1.8));
      ag.addColorStop(0.42, hsl(hue,76+be*16,62+be*12,a));
      ag.addColorStop(0.72, hsl(hue,76+be*16,52+be*12,a*0.5));
      ag.addColorStop(1,    hsl(hue,76+be*16,52+be*12,0));
      ctx.fillStyle=ag; ctx.fillRect(px,sY,W/STRIPS+1,sH);
    }
  });

  // ground + horizon
  const gg=ctx.createLinearGradient(0,H*0.67,0,H);
  gg.addColorStop(0,'transparent'); gg.addColorStop(1,`rgba(8,40,18,${0.15+v*0.16})`);
  ctx.fillStyle=gg; ctx.fillRect(0,0,W,H);
  const hg=ctx.createLinearGradient(0,H*0.65,0,H*0.72);
  hg.addColorStop(0,'transparent'); hg.addColorStop(0.5,`rgba(40,185,120,${0.08+m*0.15})`); hg.addColorStop(1,'transparent');
  ctx.fillStyle=hg; ctx.fillRect(0,H*0.65,W,H*0.07);

  // vignettes
  const tv=ctx.createLinearGradient(0,0,0,H*0.13);
  tv.addColorStop(0,'rgba(1,1,7,0.9)'); tv.addColorStop(1,'transparent');
  ctx.fillStyle=tv; ctx.fillRect(0,0,W,H);
  const bv=ctx.createLinearGradient(0,H*0.72,0,H);
  bv.addColorStop(0,'transparent'); bv.addColorStop(1,'rgba(1,1,7,0.95)');
  ctx.fillStyle=bv; ctx.fillRect(0,0,W,H);
}

// ── Metrics ──────────────────────────────────────────
function updateMetrics() {
  const p = v => Math.round(v*100)+'%';
  document.getElementById('mBass').textContent = p(bass());
  document.getElementById('mMid').textContent  = p(mid());
  document.getElementById('mHigh').textContent = p(high());
  document.getElementById('mVol').textContent  = p(vol());
}

// ── Render ───────────────────────────────────────────
function render() {
  // Pull fresh FFT data every frame
  if (analyser) analyser.getByteFrequencyData(freqData);
  updateSmoothed();

  switch (currentPreset) {
    case 'waves':  drawWaves();  break;
    case 'bars':   drawBars();   break;
    case 'nebula': drawNebula(); break;
    case 'orbit':  drawOrbit();  break;
    case 'aurora': drawAurora(); break;
    case 'ribbon': drawRibbon(); break;
  }

  if (tick % 10 === 0) updateMetrics();
  tick++;
  requestAnimationFrame(render);
}
render();
