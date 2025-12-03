// GSAP + ScrollTrigger animations implementing 1..7
gsap.registerPlugin(ScrollTrigger);

// helper
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const year = $('#year'); if(year) year.textContent = new Date().getFullYear();

// 1) Intro pinned scrubbed timeline (fullscreen)
(function introTimeline(){
  const tl = gsap.timeline({ paused:true });
  // subtle scale/tilt + "liquid rise" substitute by scaling the rect inside .glass-visual
  tl.to('.glass-visual svg', { scale: 1.05, duration: 1.2, transformOrigin: "50% 50%", ease: "power2.inOut" }, 0);
  tl.to('.glass-visual svg rect', { attr:{height:1000}, duration: 2.2, ease: "power3.inOut" }, 0.2);
  tl.to('.intro-copy h1, .intro-copy .lead', { y:-18, opacity:1, stagger:0.12, duration:1, ease:"power2.out" }, 0);

  // final: shrink overlay and reveal site
  tl.to('#intro', { opacity: 0, duration: 0.9, pointerEvents: 'none', onComplete() {
    document.getElementById('intro').style.display='none';
    document.getElementById('site').classList.remove('hidden');
    document.getElementById('site').classList.add('visible');
  }}, 2.5);

  ScrollTrigger.create({
    animation: tl,
    trigger: '#intro',
    start: 'top top',
    end: () => `+=${window.innerHeight * 3}`, // ~3 screen heights
    scrub: 0.6,
    pin: true,
    anticipatePin: 1
  });

  // skip
  const skip = document.getElementById('intro-skip');
  if(skip) skip.addEventListener('click', ()=> tl.progress(1));
})();

// 2) Fade-in sections on scroll (global)
$$('.fade-section, .cards-section, .hero-section').forEach(section => {
  gsap.from(section, {
    scrollTrigger: {
      trigger: section,
      start: 'top 80%',
      end: 'bottom 40%',
      toggleActions: 'play none none none'
    },
    y: 26,
    opacity: 0,
    duration: 0.9,
    ease: 'power2.out'
  });
});

// 3) Hero parallax: image moves slower than text
(function heroParallax(){
  const heroImg = document.querySelector('.hero-media img');
  if(!heroImg) return;
  gsap.to(heroImg, {
    y: -120,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero-section',
      start: 'top bottom',
      end: 'bottom top',
      scrub: 0.6
    }
  });
})();

// 4) Sticky/pinned product block (text panels on scroll)
(function stickyPanels(){
  const sticky = document.querySelector('.sticky-wrap');
  if(!sticky) return;
  const panels = gsap.utils.toArray('.sticky-panel');
  panels.forEach((panel,i) => panel.style.opacity = 0);

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '.sticky-wrap',
      start: 'top top',
      end: () => `+=${window.innerHeight * panels.length}`,
      scrub: 0.6,
      pin: true,
      anticipatePin: 1
    }
  });
  // For each panel: fade it in, then move to next
  panels.forEach((p, i) => {
    tl.to(p, { opacity:1, y:0, duration:0.6, ease:'power2.out' });
    tl.to(p, { opacity:0, duration:0.45, delay:0.6 });
  });
})();

// 5) Staggered card reveal on scroll
(function cardReveal(){
  const cards = gsap.utils.toArray('.card');
  gsap.set(cards, { y: 20, opacity: 0 });
  gsap.to(cards, {
    y:0, opacity:1, duration:0.9, ease:'power2.out', stagger:0.18,
    scrollTrigger: {
      trigger: '.card-grid',
      start: 'top 80%',
      end: 'bottom 40%',
      toggleActions: 'play none none none'
    }
  });
})();

// 6) Hover animations for cards are in CSS (scale & image zoom). For pointer tilt effect (optional):
(function pointerTilt(){
  const cards = $$('.card');
  cards.forEach(card => {
    const img = card.querySelector('img');
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (py - 0.5) * 6;
      const ry = (px - 0.5) * -6;
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
      if(img) img.style.transform = 'scale(1.06)';
    });
    card.addEventListener('mouseleave', ()=> {
      card.style.transform = '';
      if(img) img.style.transform = '';
    });
  });
})();

// 7) Scroll-linked 3D tilt for hero & sections (subtle)
(function subtleTilt(){
  const container = document.querySelector('.hero-section');
  if(!container) return;
  ScrollTrigger.create({
    trigger: container,
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
    onUpdate: self => {
      const r = (self.progress - 0.5) * 6; // -3..3deg
      container.style.transform = `rotateX(${r/3}deg) rotateZ(${r}deg)`;
    }
  });
})();

// refresh ScrollTrigger on load/resize
window.addEventListener('load', ()=> ScrollTrigger.refresh());
window.addEventListener('resize', ()=> ScrollTrigger.refresh());
