# 🎵 Aura — Music Visualizer Chrome Extension

A premium, aesthetic music visualizer that reacts to any audio playing in your browser tabs.
**[→ Visit the extension webpage](https://stevegates24.github.io/Aura-Music-Visualiser/)**
---

## ✨ Presets

| Preset | Description |
|--------|-------------|
| **Waves** | Layered fluid waves inspired by the index.html aesthetic — purple/pink/indigo, audio-reactive amplitudes |
| **Bars** | Symmetric spectrum bars growing from center, rainbow-hued with glow |
| **Plasma** | Psychedelic fluid plasma driven by bass, mid, and high frequencies |
| **Orbit** | Radial spectrum with orbiting particles around a central orb |
| **Aurora** | Northern lights curtains swaying to the music above a glowing horizon |

---

## 🚀 Installation (Chrome / Chromium)

1. **Download** — clone or download this folder to your computer
2. **Open Chrome Extensions** — go to `chrome://extensions`
3. **Enable Developer Mode** — toggle it on (top-right corner)
4. **Load Unpacked** — click the button and select the `music-visualizer-ext` folder
5. **Done** — the Aura icon appears in your toolbar

---

## 🎧 Usage

1. Open a tab with music — YouTube, Spotify Web Player, SoundCloud, etc.
2. **Start playing** your music
3. Click the **Aura icon** in the toolbar
4. Choose a preset in the popup
5. Click **Open Visualizer** — a new full-page tab opens
6. Switch presets anytime using the top preset selector
7. Adjust sensitivity with the **+/−** buttons on the right
8. Press the **Fullscreen** button for an immersive experience

---

## 🔧 How It Works

- A **content script** is injected into media tabs that captures audio via the Web Audio API `createMediaElementSource`
- The content script streams `Uint8Array` FFT frequency data to the visualizer page via Chrome's `chrome.tabs.connect` port API
- The visualizer page receives this data and renders one of 5 canvas-based presets at 60fps
- If no audio is detected, a subtle **demo mode** animates the visuals at low amplitude

---

## ⚠️ Notes

- The extension needs permission to access tab audio — you'll be prompted on first use
- **Spotify Web Player** works; the native Spotify desktop app does not (it's not a browser tab)
- If the visualizer shows "No audio detected", make sure music is **playing** (not paused) before opening the visualizer
- Some sites that load audio in iframes may not be captured

---

## 🎨 Tech Stack

- Manifest V3 Chrome Extension
- Web Audio API (`AnalyserNode`, `createMediaElementSource`)
- HTML5 Canvas 2D for all visualizations
- Zero dependencies — pure vanilla JS

---

*MIT License*
