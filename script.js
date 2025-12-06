// script.js (final) - robust loader: uses embedded shader tags first, fallback to fetch()
// Full-page coffee fluid ripple background (mouse + touch + scroll)

let scene, camera, renderer, material, mesh, clock;
let uniforms = null;

// quick WebGL support check
function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

function createRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.setSize(window.innerWidth, window.innerHeight);
  return r;
}

function loadShadersFromTags() {
  const vTag = document.getElementById('vertexShader');
  const fTag = document.getElementById('fragmentShader');
  if (!vTag || !fTag) return null;
  const v = vTag.textContent && vTag.textContent.trim().length > 10 ? vTag.textContent : null;
  const f = fTag.textContent && fTag.textContent.trim().length > 10 ? fTag.textContent : null;
  if (v && f) return { vert: v, frag: f };
  return null;
}

function fetchShaders() {
  return Promise.all([
    fetch('coffee-shader.vert').then(r => r.ok ? r.text() : Promise.reject('vert fetch failed')),
    fetch('coffee-shader.frag').then(r => r.ok ? r.text() : Promise.reject('frag fetch failed'))
  ]).then(([v, f]) => ({ vert: v, frag: f }));
}

function initCoffee() {
  const canvas = document.getElementById('coffee-canvas');
  if (!canvas) return;
  if (!webglSupported()) {
    canvas.style.display = 'none';
    console.warn('WebGL not supported - canvas hidden.');
    return;
  }

  renderer = createRenderer(canvas);
  scene = new THREE.Scene();
  camera = new THREE.Camera();
  clock = new THREE.Clock();

  // uniforms
  uniforms = {
    u_time: { value: 0.0 },
    u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
    u_scroll: { value: 0.0 },
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  };

  const geometry = new THREE.PlaneGeometry(2, 2);
  // temporary material while shader loads
  material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'void main(){ gl_Position = vec4(position,1.0); }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(0.12,0.08,0.05,1.0); }',
    depthTest: false
  });

  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Try embedded tags first
  const embedded = loadShadersFromTags();
  const shaderPromise = embedded ? Promise.resolve(embedded) : fetchShaders();

  shaderPromise.then(sh => {
    material.vertexShader = sh.vert;
    material.fragmentShader = sh.frag;
    material.needsUpdate = true;
    // start animation if not already
    if (!animationRunning) startLoop();
  }).catch(err => {
    console.warn('Failed to load external shaders, embedded used if present. Error:', err);
  });

  setupInteraction();
  // start loop immediately (will show temporary color until shader loaded)
  if (!animationRunning) startLoop();
}

let animationRunning = false;
function startLoop() {
  animationRunning = true;
  function loop() {
    requestAnimationFrame(loop);
    if (uniforms) uniforms.u_time.value = clock.getElapsedTime();
    if (renderer && scene && camera) renderer.render(scene, camera);
  }
  loop();
}

// interactions
function setupInteraction() {
  // mouse
  window.addEventListener('mousemove', (e) => {
    if (!uniforms) return;
    uniforms.u_mouse.value.set(e.clientX / window.innerWidth, 1 - (e.clientY / window.innerHeight));
  }, { passive: true });

  // touch
  window.addEventListener('touchmove', (e) => {
    if (!uniforms || !e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    uniforms.u_mouse.value.set(t.clientX / window.innerWidth, 1 - (t.clientY / window.innerHeight));
  }, { passive: true });

  // scroll -> small mapped uniform
  window.addEventListener('scroll', () => {
    if (!uniforms) return;
    const s = window.scrollY || window.pageYOffset || 0;
    uniforms.u_scroll.value = Math.min(Math.max(s * 0.002, 0), 3.0);
  }, { passive: true });

  // resize
  window.addEventListener('resize', () => {
    if (!renderer || !uniforms) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
  }, { passive: true });
}

// boot safely
window.addEventListener('load', () => {
  try {
    initCoffee();
  } catch (e) {
    console.error('Coffee init crashed:', e);
  }
});
