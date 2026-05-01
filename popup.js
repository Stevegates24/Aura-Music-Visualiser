// popup.js — Aura v4

// Mini wave
const canvas = document.getElementById('wc');
const ctx2 = canvas.getContext('2d');
let t = 0;
function resizeC() { canvas.width = canvas.offsetWidth*devicePixelRatio; canvas.height = canvas.offsetHeight*devicePixelRatio; }
resizeC();

function drawWave() {
  const w=canvas.width, h=canvas.height;
  ctx2.clearRect(0,0,w,h);
  [{amp:.28,fr:.017,sp:.013,col:'rgba(124,58,237,0.42)',ph:0},
   {amp:.19,fr:.026,sp:.020,col:'rgba(167,139,250,0.28)',ph:1.5},
   {amp:.12,fr:.038,sp:.028,col:'rgba(244,114,182,0.20)',ph:3}
  ].forEach(v=>{
    ctx2.beginPath();
    for(let x=0;x<=w;x++){
      const y=h/2+Math.sin(x*v.fr+t*v.sp+v.ph)*h*v.amp+Math.sin(x*v.fr*2.1+t*v.sp*1.6+v.ph)*h*v.amp*.22;
      x===0?ctx2.moveTo(x,y):ctx2.lineTo(x,y);
    }
    ctx2.lineTo(w,h);ctx2.lineTo(0,h);ctx2.closePath();
    const g=ctx2.createLinearGradient(0,0,0,h);
    g.addColorStop(0,v.col);g.addColorStop(1,'transparent');
    ctx2.fillStyle=g;ctx2.fill();
  });
  t++;
  requestAnimationFrame(drawWave);
}
drawWave();

// Preset selection
let sel = 'waves';
document.querySelectorAll('.chip').forEach(c=>{
  c.addEventListener('click',()=>{
    document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));
    c.classList.add('active');
    sel = c.dataset.p;
  });
});

// Media check
async function check() {
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab) return;
    const dot = document.getElementById('sd');
    const txt = document.getElementById('st');
    if (tab.audible) {
      dot.classList.remove('idle');
      // Show shortened tab title
      let title = (tab.title||'').replace(/ - YouTube$/,'').replace(/ \| Spotify.*/,'').trim();
      txt.textContent = title.length>30 ? title.slice(0,28)+'…' : (title||'Audio playing');
    } else {
      dot.classList.add('idle');
      txt.textContent = 'No audio in this tab';
    }
  } catch(e) { document.getElementById('st').textContent = 'Cannot access tab'; }
}
check();

// Launch
document.getElementById('lb').addEventListener('click', async ()=>{
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!tab) return;
  const btn = document.getElementById('lb');
  btn.textContent = 'Opening…'; btn.style.opacity='0.7';
  chrome.runtime.sendMessage({type:'OPEN_VISUALIZER', tabId:tab.id, preset:sel}, ()=>window.close());
});
