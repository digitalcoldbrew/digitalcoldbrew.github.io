// GSAP + ScrollTrigger implementations for animations 1..7 (shorter, subtler sweep)
gsap.registerPlugin(ScrollTrigger);

// small helpers
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const year = $('#year'); if(year) year.textContent = new Date().getFullYear();

// ---------- 1) Intro pinned scrubbed timeline (shorter duration ~2x viewport) ----------
(function introTimeline(){
  const intro = $('#intro');
  const bg = document.querySelector('.intro-bg');
  const sweep = document.querySelector('.light-sweep');
  const hint = document.querySelector('.hint');
  const skipBtn = document.getElementById('intro-skip');

  // timeline: scale bg lightly, subtle sweep, lighten mid, then fade
  const tl = gsap.timeline({ paused: true });

  tl.to(bg, { scale: 1.06, duration: 1.2, ease: "power2.inOut" }, 0);
  tl.to(sweep, { xPercent: 220, opacity: 0.28, duration: 1.2, ease: "power2.inOut" }, 0.1);
  tl.to('.brand-title', { y: -12, opacity: 1, duration: 0.7, ease: "power2.out" }, 0.05);
  tl.to('.lead', { y: -8, opacity: 1, duration: 0.7, ease: "power2.out" }, 0.08);

  // small settle
  tl.to(bg, { scale: 1.02, duration: 0.9, ease: "power3.inOut" }, 1.0);

  // final: fade out intro quicker (shorter)
  tl.to(intro, { opacity: 0, duration: 0.6, pointerEvents: 'none', onComplete() {
    intro.style.display = 'none';
  }}, 1.9);

  // Create ScrollTrigger that pins the intro and scrubs the timeline (shorter end)
  ScrollTrigger.create({
    animation: tl,
    trigger: intro,
    start: 'top top',
    end: () => `+=${window.innerHeight * 2}`, // shorter: ~2x viewport
    scrub: 0.55,
    pin: true,
    anticipatePin: 1,
    onUpdate: self => {
      if (self.progress > 0.01 && hint) gsap.to(hint, { opacity: 0, duration: 0.18 });
    }
  });

  // skip functionality
  if (skipBtn) skipBtn.addEventListener('click', ()=> tl.progress(1));
})();

// ---------- 2) Fade-in sections on scroll (global) ----------
(function fadeSections(){
  const sections = gsap.utils.toArray('.fade-section, .cards-section, .hero-section');
  sections.forEach(section=>{
    gsap.from(section, {
      y: 24,
      opacity: 0,
      duration: 0.85,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 82%',
        end: 'bottom 40%',
        toggleActions: 'play none none none'
      }
    });
  });
})();

// ---------- 3) Hero parallax ----------
(function heroParallax(){
  const heroImg = document.querySelector('.hero-media img');
  if(!heroImg) return;
  gsap.to(heroImg, {
    y: -100,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero-section',
      start: 'top bottom',
      end: 'bottom top',
      scrub: 0.6
    }
  });
})();

// ---------- 4) Sticky/pinned panels ----------
(function stickyPanels(){
  const wrap = document.querySelector('.sticky-wrap');
  if(!wrap) return;
  const panels = gsap.utils.toArray('.sticky-panel');
  panels.forEach(p=> p.style.opacity = 0);

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '.sticky-wrap',
      start: 'top top',
      end: () => `+=${window.innerHeight * panels.length}`,
      scrub: 0.55,
      pin: true,
      anticipatePin: 1
    }
  });

  panels.forEach((p,i)=>{
    tl.to(p, { opacity:1, y:0, duration:0.6, ease:'power2.out' });
    tl.to(p, { opacity:0, duration:0.45, delay:0.55 });
  });
})();

// ---------- 5) Staggered card reveal ----------
(function cardReveal(){
  const cards = gsap.utils.toArray('.card');
  gsap.set(cards, { y: 18, opacity: 0 });
  gsap.to(cards, {
    y: 0, opacity: 1, duration: 0.85, ease: 'power2.out', stagger: 0.16,
    scrollTrigger: {
      trigger: '.card-grid',
      start: 'top 82%',
      end: 'bottom 40%',
      toggleActions: 'play none none none'
    }
  });
})();

// ---------- 6) Card hover & pointer tilt ----------
(function cardHoverTilt(){
  const cards = $$('.card');
  cards.forEach(card=>{
    const img = card.querySelector('img');
    card.addEventListener('mousemove', e=>{
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (py - 0.5) * 5.5;
      const ry = (px - 0.5) * -5.5;
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
      if(img) img.style.transform = 'scale(1.05)';
    });
    card.addEventListener('mouseleave', ()=>{
      card.style.transform = '';
      if(img) img.style.transform = '';
    });
  });
})();

// ---------- 7) subtle scroll-linked 3D tilt for hero container ----------
(function subtleTilt(){
  const container = document.querySelector('.hero-section');
  if(!container) return;
  ScrollTrigger.create({
    trigger: container,
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
    onUpdate: self => {
      const r = (self.progress - 0.5) * 5;
      container.style.transform = `rotateX(${r/3}deg) rotateZ(${r}deg)`;
    }
  });
})();

// refresh on load/resize
window.addEventListener('load', ()=> ScrollTrigger.refresh());
window.addEventListener('resize', ()=> ScrollTrigger.refresh());
