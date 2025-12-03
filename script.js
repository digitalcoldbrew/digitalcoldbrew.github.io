// main interactions: GSAP + ScrollTrigger + Lottie + Three.js shader
gsap.registerPlugin(ScrollTrigger);

// small helpers
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const year = $('#year'); if(year) year.textContent = new Date().getFullYear();

// --------------------- WebGL Hero shader (coffee look) ---------------------
function initWebGLHero() {
  const container = document.getElementById('webgl-hero');
  if (!container) return;

  // Basic safety: if WebGL not supported, bail (fallback to CSS background)
  if (!window.WebGLRenderingContext) {
    container.style.display = 'none';
    return;
  }

  // scene, camera, renderer
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  // resize helper
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
  }
  resize();
  window.addEventListener('resize', resize);

  // plane with shader material
  const geom = new THREE.PlaneGeometry(2, 2);

  // fragment shader: simple noise + flow to emulate viscous coffee (optimized)
  const frag = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_progress; // 0..1 scrub influence
    // 2D simplex noise (small / optimized)
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
    float noise(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i+vec2(1.0,0.0));
      float c = hash(i+vec2(0.0,1.0));
      float d = hash(i+vec2(1.0,1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a,b,u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
    }
    void main(){
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      // center and aspect correction
      vec2 pos = (uv - 0.5) * vec2(u_resolution.x/u_resolution.y, 1.0);
      // base coffee color ramp
      vec3 dark = vec3(0.164,0.098,0.062); // #2a170f
      vec3 mid = vec3(0.294,0.176,0.122);  // #4b2e1f
      vec3 light = vec3(0.439,0.259,0.169); // lighter
      // flow noise
      float t = u_time * 0.2;
      float n = noise(pos * 3.0 + vec2(t * 0.8, t * 0.4));
      float n2 = noise(pos * 6.0 - vec2(t * 0.6, -t * 0.2));
      float flow = smoothstep(0.0,1.0, n * 0.6 + n2 * 0.4);
      // gradient by vertical position
      float grad = smoothstep(-0.6, 0.9, pos.y + (u_progress - 0.4) * 0.9);
      // combine
      float mixv = clamp(flow * 0.9 + grad * 0.4, 0.0, 1.0);
      vec3 color = mix(dark, mid, mixv);
      color = mix(color, light, pow(smoothstep(0.0,1.0,flow), 0.6) * 0.15);
      // vignette + subtle shine
      float vign = smoothstep(0.9, 0.2, length(pos) * 0.8);
      color *= vign;
      // final
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const mat = new THREE.ShaderMaterial({
    fragmentShader: frag,
    vertexShader: `void main(){gl_Position = vec4(position,1.0);}`,
    uniforms: {
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
      u_progress: { value: 0.0 }
    },
    transparent: true,
    depthTest: false
  });

  const mesh = new THREE.Mesh(geom, mat);
  scene.add(mesh);

  // handle resize uniform
  function resizeUniform() {
    mat.uniforms.u_resolution.value.set(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', resizeUniform);

  // render loop
  let raf;
  function render(time) {
    mat.uniforms.u_time.value = time * 0.001;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(render);
  }
  raf = requestAnimationFrame(render);

  // expose uniform setter for scroll progress
  return {
    setProgress: (p) => { mat.uniforms.u_progress.value = p; },
    destroy: () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      geom.dispose();
      mat.dispose();
      container.removeChild(renderer.domElement);
    }
  };
}

// --------------------- Lottie drop (recolor + scrub) ---------------------
function initLottieAndHero() {
  // Lottie file chosen by you (water-drop). We'll load it and recolor at runtime to coffee colors.
  // Original Lottie URL (public): user selected 'water-drop' on LottieFiles
  const LOTTIE_URL = 'https://assets6.lottiefiles.com/packages/lf20_76X7IUH8vk.json'; // your chosen asset

  const container = document.getElementById('lottie-hero');
  const intro = document.getElementById('intro');
  const pourStage = document.getElementById('pour-stage');

  // load Lottie
  let anim;
  try {
    anim = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      path: LOTTIE_URL,
      rendererSettings: { preserveAspectRatio: 'xMidYMid slice' }
    });
  } catch (e) {
    console.warn('Lottie load failed', e);
    return;
  }

  // Wait for DOM inside Lottie, then recolor all fills/strokes to coffee tones
  function recolorLottie() {
    try {
      const svg = container.querySelector('svg');
      if (!svg) return;
      // Coffee palette
      const coffeeDark = '#2a170f';
      const coffeeMid = '#4b2e1f';
      const coffeeLight = '#6b3f2a';
      // recolor common shapes: fill & stroke
      const all = svg.querySelectorAll('[fill]');
      all.forEach(node => {
        const f = node.getAttribute('fill');
        if (!f || f === 'none') return;
        // change non-transparent fills to coffee shades - simple heuristic
        node.setAttribute('fill', coffeeMid);
        node.style.fill = coffeeMid;
      });
      const strokes = svg.querySelectorAll('[stroke]');
      strokes.forEach(node => {
        const s = node.getAttribute('stroke');
        if (!s || s === 'none') return;
        node.setAttribute('stroke', coffeeDark);
        node.style.stroke = coffeeDark;
      });
      // scale drop color specifics if needed
      const circles = svg.querySelectorAll('circle, ellipse, path');
      circles.forEach((el, i) => {
        if (i % 3 === 0) {
          el.setAttribute('fill', coffeeDark);
        } else {
          el.setAttribute('fill', coffeeMid);
        }
      });
    } catch (e) {
      console.warn('Recolor Lottie failed', e);
    }
  }

  // poll until Lottie has inserted the svg
  const poll = setInterval(() => {
    if (container.querySelector('svg')) {
      clearInterval(poll);
      recolorLottie();
    }
  }, 80);

  // init WebGL hero
  const webgl = initWebGLHero();

  // Create ScrollTrigger that scrubs Lottie AND drives WebGL progress
  ScrollTrigger.create({
    trigger: '#intro',
    start: 'top top',
    end: () => `+=${window.innerHeight * 2}`, // ~2 viewports of scroll
    scrub: 0.4,
    pin: true,
    anticipatePin: 1,
    onUpdate: self => {
      // scrub lottie
      if (anim && anim.totalFrames) {
        const frame = Math.floor(self.progress * (anim.totalFrames - 1));
        try { anim.goToAndStop(frame, true); } catch (e) {}
      }
      // update webgl shader progress
      if (webgl) webgl.setProgress(self.progress);
      // also animate SVG glass liquid to match progress (if present)
      try {
        const liquidRect = document.getElementById('liquid-rect');
        const waves = document.getElementById('waves');
        if (liquidRect) {
          // map progress 0..1 to y positions (950 -> 120)
          const y = 950 - (830 * self.progress);
          liquidRect.setAttribute('y', String(y));
        }
        if (waves) {
          const waveOffset = 900 - (self.progress * 200);
          waves.setAttribute('transform', `translate(0,${waveOffset})`);
        }
        // show pour stream early and hide after fill
        const pourStream = document.getElementById('pour-stream');
        const splashes = document.getElementById('splashes');
        if (self.progress > 0.02) {
          if (pourStream) gsap.to(pourStream, { opacity: 1, duration: 0.2 });
          if (splashes) gsap.to(splashes, { opacity: 1, duration: 0.2 });
        } else {
          if (pourStream) gsap.to(pourStream, { opacity: 0, duration: 0.2 });
          if (splashes) gsap.to(splashes, { opacity: 0, duration: 0.2 });
        }
      } catch (e) { /* ignore */ }
    },
    onLeave: () => { /* after animation completes, intro will be unpinned */ }
  });

  // Make sure Lottie DOM recolor applies again if animations re-render
  window.addEventListener('resize', recolorLottie);
}

// --------------------- Global animations & small interactions ---------------------
function globalAnimations() {
  // fade-in sections
  gsap.utils.toArray('.fade-section, .cards-section, .hero-section, .section').forEach(section => {
    gsap.from(section, {
      y: 28, opacity: 0, duration: 0.9, ease: 'power2.out',
      scrollTrigger: { trigger: section, start: 'top 80%', toggleActions: 'play none none none' }
    });
  });

  // card hover tilt
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (py - 0.5) * 5.5;
      const ry = (px - 0.5) * -5.5;
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    });
    card.addEventListener('mouseleave', ()=> { card.style.transform = ''; });
  });
}

// --------------------- Initialize everything ---------------------
window.addEventListener('load', () => {
  initLottieAndHero();
  globalAnimations();
  ScrollTrigger.refresh();
});

// cleanup on resize
window.addEventListener('resize', () => {
  ScrollTrigger.refresh();
});
