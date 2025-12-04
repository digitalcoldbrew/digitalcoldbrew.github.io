// Full GPU Fluid Simulation (stable fluid) for "coffee" dye
// Works with embedded shaders in index.html (vertexShader/fragmentShader used only for final render).
// This file implements the simulation pipeline and final render.

(() => {
  // Basic helpers
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  // Simulation resolution (lower for better perf)
  const SIM_RES_BASE = isMobile ? 256 : 512; // simulation grid size (square)
  const DYE_RES_BASE = isMobile ? 512 : 1024; // dye render resolution

  // three.js setup
  let renderer, scene, camera, quadMesh;
  let simWidth, simHeight, dyeWidth, dyeHeight;

  // FBO (render target) helper
  function createFBO(width, height, filtering = THREE.LinearFilter, type = THREE.UnsignedByteType) {
    const rt = new THREE.WebGLRenderTarget(width, height, {
      minFilter: filtering,
      magFilter: filtering,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      type: type,
    });
    rt.texture.format = THREE.RGBAFormat;
    return rt;
  }

  // Ping-pong helper
  class DoubleFBO {
    constructor(w, h, filtering, type) {
      this.read = createFBO(w, h, filtering, type);
      this.write = createFBO(w, h, filtering, type);
    }
    swap() {
      const t = this.read; this.read = this.write; this.write = t;
    }
  }

  // Shaders as strings (we keep them inline so GitHub Pages works)
  // Vertex pass-through
  const passVert = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position,1.0); }
  `;

  // Advect shader (moves quantity by velocity)
  const advectFrag = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uSource; // quantity to advect (vel or dye)
    uniform sampler2D uVelocity;
    uniform float dt;
    uniform vec2 texelSize;
    uniform float dissipation;
    void main(){
      vec2 coord = vUv;
      vec2 vel = texture2D(uVelocity, coord).xy;
      vec2 prev = coord - dt * vel * texelSize;
      vec4 result = texture2D(uSource, prev);
      gl_FragColor = result * dissipation;
    }
  `;

  // Divergence shader
  const divergenceFrag = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform vec2 texelSize;
    void main(){
      float L = texture2D(uVelocity, vUv - vec2(texelSize.x,0)).x;
      float R = texture2D(uVelocity, vUv + vec2(texelSize.x,0)).x;
      float B = texture2D(uVelocity, vUv - vec2(0,texelSize.y)).y;
      float T = texture2D(uVelocity, vUv + vec2(0,texelSize.y)).y;
      float div = 0.5 * ((R - L) + (T - B));
      gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }
  `;

  // Jacobi pressure solve
  const jacobiFrag = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    uniform vec2 texelSize;
    void main(){
      float L = texture2D(uPressure, vUv - vec2(texelSize.x,0)).x;
      float R = texture2D(uPressure, vUv + vec2(texelSize.x,0)).x;
      float B = texture2D(uPressure, vUv - vec2(0,texelSize.y)).x;
      float T = texture2D(uPressure, vUv + vec2(0,texelSize.y)).x;
      float div = texture2D(uDivergence, vUv).x;
      float p = (L + R + B + T - div) * 0.25;
      gl_FragColor = vec4(p,0.0,0.0,1.0);
    }
  `;

  // Gradient Subtract (make velocity divergence-free)
  const gradientFrag = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uPressure;
    uniform vec2 texelSize;
    void main(){
      float L = texture2D(uPressure, vUv - vec2(texelSize.x,0)).x;
      float R = texture2D(uPressure, vUv + vec2(texelSize.x,0)).x;
      float B = texture2D(uPressure, vUv - vec2(0,texelSize.y)).x;
      float T = texture2D(uPressure, vUv + vec2(0,texelSize.y)).x;
      vec2 vel = texture2D(uVelocity, vUv).xy;
      vec2 grad = vec2(R - L, T - B) * 0.5;
      vec2 newVel = vel - grad;
      gl_FragColor = vec4(newVel, 0.0, 1.0);
    }
  `;

  // Apply "splat" - add impulse to velocity and dye
  const splatFrag = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform vec2 point; // normalized coordinate
    uniform vec3 color;
    uniform float radius;
    void main(){
      vec4 cur = texture2D(uTarget, vUv);
      float d = distance(vUv, point);
      float a = exp(-d * d / radius);
      vec3 col = cur.rgb + color * a;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // Render dye to screen (composite)
  const displayFrag = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uDye;
    uniform float time;
    void main(){
      vec4 d = texture2D(uDye, vUv);
      // color grading for coffee tone
      vec3 color = d.rgb;
      // slight vignetting
      float r = length(vUv - 0.5);
      color *= smoothstep(0.9, 0.3, r);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  // Utility to create a shader material
  function createMaterial(fragmentShaderSource, uniforms = {}) {
    return new THREE.RawShaderMaterial({
      uniforms: uniforms,
      vertexShader: passVert,
      fragmentShader: fragmentShaderSource,
    });
  }

  // Full pipeline state
  let velocityFBO, dyeFBO, dyeTempFBO, divergenceFBO, pressureFBO;

  // Mesh used for ping-pong passes
  function makePassScene(material) {
    const passScene = new THREE.Scene();
    const quadGeo = new THREE.PlaneBufferGeometry(2,2);
    const quad = new THREE.Mesh(quadGeo, material);
    passScene.add(quad);
    return { scene: passScene, mesh: quad };
  }

  // Build simulation: init renderer, FBOs, materials
  function init() {
    const canvas = document.getElementById('coffee-canvas');
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(DPR);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    camera = new THREE.Camera();
    camera.position.z = 1;

    // simulation resolution based on screen size
    simWidth = Math.max(32, Math.floor(SIM_RES_BASE * (window.innerWidth / 1200)));
    simHeight = Math.max(32, Math.floor(SIM_RES_BASE * (window.innerHeight / 800)));
    dyeWidth = Math.max(128, Math.floor(DYE_RES_BASE * (window.innerWidth / 1200)));
    dyeHeight = Math.max(128, Math.floor(DYE_RES_BASE * (window.innerHeight / 800)));

    // create FBOs
    velocityFBO = new DoubleFBO(simWidth, simHeight, THREE.LinearFilter, THREE.FloatType);
    dyeFBO = new DoubleFBO(dyeWidth, dyeHeight, THREE.LinearFilter, THREE.UnsignedByteType);
    divergenceFBO = createFBO(simWidth, simHeight, THREE.LinearFilter, THREE.FloatType);
    pressureFBO = new DoubleFBO(simWidth, simHeight, THREE.LinearFilter, THREE.FloatType);

    // materials for passes
    const advectMat = createMaterial(advectFrag, {
      uSource: { value: null },
      uVelocity: { value: null },
      dt: { value: 0.016 },
      texelSize: { value: new THREE.Vector2(1.0 / simWidth, 1.0 / simHeight) },
      dissipation: { value: 0.99 }
    });
    const divergenceMat = createMaterial(divergenceFrag, {
      uVelocity: { value: null },
      texelSize: { value: new THREE.Vector2(1.0 / simWidth, 1.0 / simHeight) }
    });
    const jacobiMat = createMaterial(jacobiFrag, {
      uPressure: { value: null },
      uDivergence: { value: null },
      texelSize: { value: new THREE.Vector2(1.0 / simWidth, 1.0 / simHeight) }
    });
    const gradientMat = createMaterial(gradientFrag, {
      uVelocity: { value: null },
      uPressure: { value: null },
      texelSize: { value: new THREE.Vector2(1.0 / simWidth, 1.0 / simHeight) }
    });

    const splatMat = createMaterial(splatFrag, {
      uTarget: { value: null },
      point: { value: new THREE.Vector2(0.5, 0.5) },
      color: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
      radius: { value: 0.05 }
    });

    const displayMat = createMaterial(displayFrag, {
      uDye: { value: null },
      time: { value: 0.0 }
    });

    // Scenes for each pass
    const advectVel = makePassScene(advectMat);
    const advectDye = makePassScene(createMaterial(advectFrag, {
      uSource: { value: null },
      uVelocity: { value: null },
      dt: { value: 0.016 },
      texelSize: { value: new THREE.Vector2(1.0 / dyeWidth, 1.0 / dyeHeight) },
      dissipation: { value: 0.995 }
    }));

    const divergencePass = makePassScene(divergenceMat);
    const jacobiPass = makePassScene(jacobiMat);
    const gradientPass = makePassScene(gradientMat);
    const splatPass = makePassScene(splatMat);
    const displayPass = makePassScene(displayMat);

    // store pass references
    const passes = {
      advectVel, advectDye, divergencePass, jacobiPass, gradientPass, splatPass, displayPass,
      materials: { advectMat, divergenceMat, jacobiMat, gradientMat, splatMat, displayMat }
    };

    // bind helpers in outer scope
    window._FLUID = { passes, velocityFBO, dyeFBO, pressureFBO, divergenceFBO, simWidth, simHeight, dyeWidth, dyeHeight };

    // create a quad in main scene that will display the final dye (we'll render displayPass to screen)
    quadMesh = displayPass.mesh;

    // initial clear
    renderer.setRenderTarget(velocityFBO.read); renderer.clearColor();
    renderer.setRenderTarget(velocityFBO.write); renderer.clearColor();
    renderer.setRenderTarget(dyeFBO.read); renderer.clearColor();
    renderer.setRenderTarget(dyeFBO.write); renderer.clearColor();
    renderer.setRenderTarget(pressureFBO.read); renderer.clearColor();
    renderer.setRenderTarget(pressureFBO.write); renderer.clearColor();
    renderer.setRenderTarget(null);

    // store time bookkeeping
    window._FLUID._last = performance.now();
    window._FLUID._dt = 0.016;

    // attach interaction handlers
    setupInteraction();
    // run loop
    requestAnimationFrame(step);
  }

  // small helper to render a pass into a target
  function renderPass(passScene, target) {
    renderer.setRenderTarget(target);
    renderer.render(passScene.scene, camera);
    renderer.setRenderTarget(null);
  }

  // perform a simulation step
  function step(now) {
    const st = window._FLUID;
    st._dt = Math.min((now - (st._last || now)) / 1000, 0.033);
    st._last = now;

    // ----- ADVECT VELOCITY -----
    // advect velocity by itself
    const advVelMat = st.passes.advectVel.mesh.material;
    advVelMat.uniforms.uVelocity.value = st.velocityFBO.read.texture;
    advVelMat.uniforms.uSource.value = st.velocityFBO.read.texture;
    advVelMat.uniforms.dt.value = st._dt;
    renderPass(st.passes.advectVel, st.velocityFBO.write);
    st.velocityFBO.swap();

    // ----- ADVECT DYE -----
    const advDyeMat = st.passes.advectDye.mesh.material;
    advDyeMat.uniforms.uVelocity.value = st.velocityFBO.read.texture;
    advDyeMat.uniforms.uSource.value = st.dyeFBO.read.texture;
    advDyeMat.uniforms.dt.value = st._dt;
    renderPass(st.passes.advectDye, st.dyeFBO.write);
    st.dyeFBO.swap();

    // ----- DIVERGENCE -----
    const divMat = st.passes.divergencePass.mesh.material;
    divMat.uniforms.uVelocity.value = st.velocityFBO.read.texture;
    renderPass(st.passes.divergencePass, st.divergenceFBO);

    // ----- JACOBI (pressure solve) -----
    // clear pressure
    // perform several iterations
    for (let i = 0; i < 20; i++) {
      const jac = st.passes.jacobiPass.mesh.material;
      jac.uniforms.uPressure.value = st.pressureFBO.read.texture;
      jac.uniforms.uDivergence.value = st.divergenceFBO.texture || st.divergenceFBO.texture;
      renderPass(st.passes.jacobiPass, st.pressureFBO.write);
      st.pressureFBO.swap();
    }

    // ----- GRADIENT SUBTRACT -----
    const grad = st.passes.gradientPass.mesh.material;
    grad.uniforms.uVelocity.value = st.velocityFBO.read.texture;
    grad.uniforms.uPressure.value = st.pressureFBO.read.texture;
    renderPass(st.passes.gradientPass, st.velocityFBO.write);
    st.velocityFBO.swap();

    // ----- RENDER FINAL DYE TO SCREEN -----
    const disp = st.passes.displayPass.mesh.material;
    disp.uniforms.uDye.value = st.dyeFBO.read.texture;
    disp.uniforms.time.value = now * 0.001;
    renderer.setRenderTarget(null);
    renderer.render(st.passes.displayPass.scene, camera);

    requestAnimationFrame(step);
  }

  // Interaction (splat on mouse)
  function setupInteraction() {
    const st = window._FLUID;
    const canvas = renderer.domElement;
    let lastX = -1, lastY = -1;

    function splat(x, y, dx = 0, dy = 0) {
      // coords normalized
      const nx = x / canvas.clientWidth;
      const ny = 1.0 - y / canvas.clientHeight;

      // velocity splat into velocity FBO
      const splatMat = st.passes.splatPass.mesh.material;
      // small velocity color to pack into xy of velocity texture
      const vel = new THREE.Vector3(dx * 300.0, dy * 300.0, 0.0);
      splatMat.uniforms.uTarget.value = st.velocityFBO.read.texture;
      splatMat.uniforms.point.value.set(nx, ny);
      splatMat.uniforms.color.value.copy(vel);
      splatMat.uniforms.radius.value = 0.02;
      renderPass(st.passes.splatPass, st.velocityFBO.write);
      st.velocityFBO.swap();

      // dye splat
      const color = new THREE.Vector3(0.42, 0.28, 0.16); // coffee brown
      const splatDyeMat = st.passes.splatPass.mesh.material;
      splatDyeMat.uniforms.uTarget.value = st.dyeFBO.read.texture;
      splatDyeMat.uniforms.point.value.set(nx, ny);
      splatDyeMat.uniforms.color.value.copy(color);
      splatDyeMat.uniforms.radius.value = 0.055;
      renderPass(st.passes.splatPass, st.dyeFBO.write);
      st.dyeFBO.swap();
    }

    function onMove(e) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      if (lastX >= 0) {
        const dx = (x - lastX) / (window.innerWidth) ;
        const dy = (y - lastY) / (window.innerHeight) ;
        splat(x, y, dx, dy);
      } else {
        splat(x, y, 0, 0);
      }
      lastX = x; lastY = y;
    }

    function onDown(e) {
      onMove(e);
    }

    function onUp() {
      lastX = -1; lastY = -1;
    }

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchend', onUp);
    window.addEventListener('scroll', () => {
      // on scroll create a vertical splat center screen to add energy
      const x = window.innerWidth * 0.5;
      const y = window.innerHeight * 0.25 + (window.scrollY % window.innerHeight);
      splat(x, y, 0, -0.25);
    });
  }

  // resize handler
  function onResize() {
    if (!renderer) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('resize', onResize);

  // init on load
  window.addEventListener('load', init);
})();
