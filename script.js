// Wait until GSAP and ScrollTrigger are loaded
function ready(cb){
  if(window.gsap && window.gsap.core) return cb();
  const int = setInterval(()=>{ if(window.gsap && window.gsap.core){ clearInterval(int); cb(); } }, 50);
  // fallback timeout: 5s then run anyway
  setTimeout(()=> { if(window.gsap && window.gsap.core) { clearInterval(int); cb(); } }, 5000);
}

ready(()=> {
  gsap.registerPlugin(ScrollTrigger);

  const liquidGroup = document.getElementById('liquidGroup');
  const streamGroup = document.getElementById('streamGroup');
  const dropsGroup = document.getElementById('dropsGroup');
  const overlay = document.getElementById('overlay');
  const site = document.getElementById('site');
  const glassWrap = document.getElementById('glass-wrap');
  const skipBtn = document.getElementById('skipBtn');

  // starting positions (matches SVG transform values)
  const startY = 840; // initial translateY (liquid offscreen bottom)
  const endY = 40;    // when "full", bring group up so top of liquid fills glass (tweak if needed)

  // create a GSAP timeline that represents the "pour" animation
  // we'll scrub this timeline with ScrollTrigger
  const tl = gsap.timeline({ paused: true });

  // 1) stream appears and drops appear quickly
  tl.to(streamGroup, { autoAlpha: 1, duration: 0.5 }, 0);
  tl.to(dropsGroup, { autoAlpha: 1, duration: 0.45 }, 0);

  // 2) liquid rises (translateY of the liquidGroup)
  tl.to(liquidGroup, { attr: { transform: `translate(0, ${endY})` }, ease: 'power2.out', duration: 3 }, 0);

  // 3) stronger wobble and wave movement near mid-fill for realism (looping subtle)
  tl.to('#wave', { x: 20, y: -6, repeat: 3, yoyo: true, ease: 'sine.inOut', duration: 0.8 }, 0.5);

  // 4) slight 3D tilt effect on the glass wrapper
  tl.to(glassWrap, { rotation: 4, transformOrigin: '50% 50%', ease: 'power1.inOut', duration: 1.8 }, 0.6);

  // 5) finish: hide stream/drops and settle wave
  tl.to(streamGroup, { autoAlpha: 0, duration: 0.4 }, 2.6);
  tl.to(dropsGroup, { autoAlpha: 0, duration: 0.4 }, 2.6);

  // optional: small bounce to final wave
  tl.to('#wave', { x: 0, y: 0, ease: 'elastic.out(1, 0.6)', duration: 0.8 }, 2.6);

  // When timeline completes (fully filled), reveal site
  tl.call(()=> {
    // fade out overlay
    gsap.to(overlay, { autoAlpha: 0, duration: 0.9, ease: 'power2.out' });
    site.classList.remove('hidden');
    site.classList.add('visible');
    // remove overlay from flow after animation
    setTimeout(()=> overlay.style.display = 'none', 1000);
  }, null, '+=0');

  // ScrollTrigger to scrub timeline: control how much scroll needed by "end"
  // set end to "+=3000" (px) on desktop and lower on mobile
  const isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 720;
  const endDistance = isMobile ? 1400 : 2400; // tune these for feel
  ScrollTrigger.create({
    animation: tl,
    trigger: document.body,
    start: 'top top',
    end: `+=${endDistance}`,
    scrub: 0.6,
    anticipatePin: 1,
    onUpdate: self => {
      // show/hide elements based on progress
      // keep the overlay pointer events disabled until finish
      if(self.progress > 0.02) {
        overlay.style.pointerEvents = 'none';
      }
    }
  });

  // Skip button: instantly complete timeline and show content
  skipBtn.addEventListener('click', ()=> {
    tl.progress(1);
  });

  // Keyboard skip
  window.addEventListener('keydown', e => {
    if(e.key === 's' || e.key === ' ') {
      tl.progress(1);
    }
  });

  // mobile usability: if user doesn't scroll after 6s, show "tap to pour" overlay instruction
  let idleTimer = setTimeout(()=> {
    // small pulse to indicate interaction if user hasn't scrolled
    gsap.fromTo('#skipBtn', { scale: 1 }, { scale: 1.07, duration: 1, yoyo: true, repeat: 3, ease: 'sine.inOut' });
  }, 6000);
});
