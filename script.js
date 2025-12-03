// FALLBACK script.js
// Detect GSAP/ScrollTrigger and fallback to native animation if missing.
// Paste this replacing your current script.js and commit to GitHub.

(function(){
  const hasGSAP = typeof window.gsap !== 'undefined';
  const hasST = typeof window.ScrollTrigger !== 'undefined';
  console.log('FALLBACK: hasGSAP=', hasGSAP, 'hasScrollTrigger=', hasST);

  // Helper to reveal site (same behavior used by GSAP version)
  function revealSiteNow() {
    const intro = document.getElementById('intro');
    const site = document.getElementById('site');
    if(!site) return;
    site.classList.remove('hidden');
    site.classList.add('visible');
    if(intro){
      intro.style.transition = 'opacity .8s ease';
      intro.style.opacity = '0';
      setTimeout(()=> { try{ intro.style.display='none'; }catch(e){} }, 900);
    }
  }

  // If GSAP present, do nothing here (the GSAP script should run as before)
  if(hasGSAP && hasST){
    console.log('FALLBACK: GSAP + ScrollTrigger present, falling back to original scripts.');
    return;
  }

  // If we're here, GSAP/ScrollTrigger are missing. Provide a native fallback:
  console.warn('FALLBACK: GSAP or ScrollTrigger not found. Running native fallback animation.');

  // Basic native pour: we animate the SVG group "liquid-layer" translateY from start->end
  const liquidLayer = document.getElementById('liquid-layer');
  const pourStream = document.getElementById('pour-stream');
  const drops = document.getElementById('drops');
  const hint = document.querySelector('.hint') || null;
  let progress = 0; // 0..1
  const TARGET_STEPS = 60; // steps to fill (approx). Increase for slower pour.
  let steps = 0;

  // If elements missing, just reveal site
  if(!liquidLayer){
    console.warn('FALLBACK: liquid-layer not found; revealing site.');
    revealSiteNow();
    return;
  }

  // Initialize: parse initial transform if present
  // We expect initial transform translate(0,820) in SVG; use 820 as startY.
  const START_Y = 820, END_Y = 0;

  function setLiquid(p) {
    const curY = START_Y - (START_Y - END_Y) * p;
    try {
      liquidLayer.setAttribute('transform', `translate(0, ${curY})`);
    } catch(e) {}
    if(p > 0.02 && pourStream) pourStream.style.opacity = 1; else if(p<=0.02 && pourStream) pourStream.style.opacity = 0;
    if(p > 0.12 && drops) drops.style.opacity = 1; else if(drops) drops.style.opacity = 0;
  }

  // Increment on wheel or touch gestures
  function inc(delta=1) {
    steps = Math.min(TARGET_STEPS, steps + Math.abs(delta));
    progress = Math.min(1, steps / TARGET_STEPS);
    setLiquid(progress);
    if(hint) hint.style.opacity = 0;
    if(progress >= 1){
      // finish and reveal site
      setTimeout(revealSiteNow, 400);
      // remove listeners
      window.removeEventListener('wheel', wheelHandler);
      window.removeEventListener('touchmove', touchHandler);
      window.removeEventListener('pointermove', pointerHandler);
    }
  }

  function wheelHandler(e){
    inc(Math.max(1, Math.round(Math.abs(e.deltaY)/12)));
  }
  let lastTouchY = null;
  function touchHandler(e){
    if(!e.touches || !e.touches.length) return;
    const y = e.touches[0].clientY;
    if(lastTouchY == null){ lastTouchY = y; return; }
    const dy = lastTouchY - y;
    if(dy > 0) inc(Math.round(dy/15));
    lastTouchY = y;
  }
  function pointerHandler(e){
    // support drag on desktop
    if(e.pressure === 0) return;
    inc(1);
  }

  // minimal animation loop to ease into positions
  function animateLoop(){
    // if progress is 1, stop
    if(progress >= 1) return;
    // we don't do continuous RAF; we update on gestures
    requestAnimationFrame(animateLoop);
  }
  animateLoop();

  // Attach listeners
  window.addEventListener('wheel', wheelHandler, { passive: true });
  window.addEventListener('touchmove', touchHandler, { passive: true });
  window.addEventListener('pointermove', pointerHandler, { passive: true });

  // Also provide skip via spacebar
  window.addEventListener('keydown', (e)=> {
    if(e.key === ' ' || e.key.toLowerCase() === 's') {
      steps = TARGET_STEPS; progress = 1;
      setLiquid(1);
      revealSiteNow();
    }
  });

  // Log helpful guidance for debugging
  console.info('FALLBACK: If you want the GSAP version, check network console for blocked CDN or 404 for gsap/ScrollTrigger. Type in console: typeof gsap, typeof ScrollTrigger');
})();
