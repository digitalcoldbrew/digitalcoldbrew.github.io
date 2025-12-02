// GSAP + ScrollTrigger approach with gesture accumulation and skip
gsap.registerPlugin(ScrollTrigger);

// elements
const overlay = document.getElementById('intro-overlay');
const liquidLayer = document.getElementById('liquid-layer');
const pourStream = document.getElementById('pour-stream');
const drops = document.getElementById('drops');
const site = document.getElementById('site');
const skipBtn = document.getElementById('skip-btn');
const hint = document.getElementById('hint');
const yearEl = document.getElementById('year');
if(yearEl) yearEl.textContent = new Date().getFullYear();

// config
const SCROLL_FACTOR = 3.0; // how many viewport-heights to require
let accumulated = 0;
let maxNeeded = window.innerHeight * SCROLL_FACTOR;
let finished = false;

// easing helper
const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));

// animate liquid by adjusting group translateY with GSAP for smoothness
function setProgress(progress){
  // progress 0..1 -> translateY 820 -> 0 (matches SVG initial)
  const start = 820, end = 0;
  const y = start - (start-end) * progress;
  gsap.to(liquidLayer, { duration: 0.45, attr: { transform: `translate(0,${y})` }, ease: "power3.out" });
  // wave subtle x offset
  gsap.to("#wave1", { duration: 0.7, x: -40 + progress*40, ease: "sine.inOut" });
  gsap.to("#wave2", { duration: 0.7, x: -20 + progress*20, ease: "sine.inOut" });
  gsap.to("#wave3", { duration: 0.7, x: -60 + progress*60, ease: "sine.inOut" });

  // pour/drops opacity
  const showPour = progress > 0.02 && progress < 0.96;
  gsap.to(pourStream, { duration:0.35, opacity: showPour ? 1 : 0, ease:"power1.out" });
  gsap.to(drops, { duration:0.25, opacity: (progress>0.12 && progress<0.92) ? 1 : 0 });

  // rotate overlay a bit
  const rot = (progress - 0.5) * 12;
  gsap.to("#glass-scene", { duration: 0.6, rotation: rot, transformOrigin: "center center", ease: "power1.out" });

  // if full
  if(progress >= 1 && !finished){
    finished = true;
    // fade overlay and reveal site
    gsap.to(overlay, { duration: 0.9, opacity: 0, pointerEvents: "none", onComplete: ()=> {
      overlay.style.display = "none";
      site.classList.remove('hidden');
      site.classList.add('visible');
    }});
  }
}

// input handling (wheel, touch, pointer)
function addAccum(delta){
  if(finished) return;
  accumulated = clamp(accumulated + Math.abs(delta), 0, maxNeeded);
  const p = clamp(accumulated / maxNeeded, 0, 1);
  setProgress(p);
  if(hint) hint.style.opacity = '0';
}

window.addEventListener('wheel', e => {
  addAccum(e.deltaY);
}, { passive: true });

// touch
let lastTouchY = null;
window.addEventListener('touchstart', e => {
  lastTouchY = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchmove', e => {
  if(!lastTouchY) return;
  const y = e.touches[0].clientY;
  const dy = lastTouchY - y;
  // only upward swipes fill
  if(dy > 0) addAccum(dy * 0.7);
  lastTouchY = y;
}, { passive: true });
window.addEventListener('touchend', () => { lastTouchY = null; });

// pointer drag
let isDown = false, lastY = null;
window.addEventListener('pointerdown', e => { isDown = true; lastY = e.clientY; }, { passive: true });
window.addEventListener('pointermove', e => {
  if(!isDown) return;
  const dy = lastY - e.clientY;
  if(dy>0) addAccum(dy*0.6);
  lastY = e.clientY;
}, { passive: true });
window.addEventListener('pointerup', ()=> { isDown=false; lastY=null; }, { passive:true });

// skip button
skipBtn.addEventListener('click', ()=> {
  accumulated = maxNeeded;
  setProgress(1);
});

// resize recalc
window.addEventListener('resize', ()=> {
  maxNeeded = window.innerHeight * SCROLL_FACTOR;
});

// keyboard skip: space or s
window.addEventListener('keydown', (e)=> {
  if(e.key === ' ' || e.key.toLowerCase() === 's') {
    accumulated = maxNeeded;
    setProgress(1);
  }
});
