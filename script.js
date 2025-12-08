// script.js - CreativeChacha-style hero: gradient wave shader + 3D object + Lottie + GSAP reveals
(async function(){
  // ensure libs (safety) - Three loaded via index.html but this guards prod caches
  function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.async=false; s.onload=res; s.onerror=()=>rej(src); document.head.appendChild(s); }); }
  if (typeof THREE === 'undefined') await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r152/three.min.js');

  // ----- scene + renderer -----
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0); // transparent

  const scene = new THREE.Scene();

  // camera
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.8, 6);

  // lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(5,5,5); scene.add(dir);
  const rim = new THREE.DirectionalLight(0xff7a7a, 0.08); rim.position.set(-4,-2,-3); scene.add(rim);

  // ----- gradient wave shader plane (full screen) -----
  const fullscreenGeo = new THREE.PlaneGeometry(16, 9, 60, 60);
  const waveMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec2 vUv;
      uniform float uTime;
      varying float vWave;
      void main(){
        vUv = uv;
        vec3 p = position;
        float freq = 3.0;
        float amp = 0.25;
        p.z += sin((p.x*freq) + uTime*1.2) * amp * (1.0 - uv.y);
        vWave = p.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
      }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      varying float vWave;
      void main(){
        float t = uTime * 0.2;
        vec3 c1 = vec3(1.0, 0.42, 0.42); // Medium Brown
        vec3 c2 = vec3(0.43, 0.94, 0.78); // mint
        vec3 c3 = vec3(0.09, 0.14, 0.18); // dark
        float g = smoothstep(0.0, 1.0, vUv.x + 0.12 * sin(t + vUv.y * 4.0));
        vec3 col = mix(c1, c2, g);
        col = mix(col, c3, pow(vUv.y, 1.8)*0.6);
        // subtle animated noise (cheap)
        float n = sin((vUv.x+vUv.y+uTime*0.6)*6.0)*0.03;
        col += n;
        gl_FragColor = vec4(col, 1.0);
      }`,
    uniforms: { uTime: { value: 0 } },
    side: THREE.DoubleSide
  });
  const bgPlane = new THREE.Mesh(fullscreenGeo, waveMat);
  bgPlane.scale.set(1.15,1.15,1);
  bgPlane.rotation.x = -0.05;
  bgPlane.position.z = -2.2;
  scene.add(bgPlane);

  // ----- 3D object (torus knot) -----
  const geo = new THREE.TorusKnotGeometry(1.0, 0.27, 180, 32);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.25, roughness: 0.42 });
  const knot = new THREE.Mesh(geo, mat);
  knot.position.set(0, -0.2, 0);
  knot.scale.set(1.2,1.2,1.2);
  scene.add(knot);

  // color gradient using trigonometric color morph on material via per-frame color change
  const baseColor = new THREE.Color(0x88c7ff);

  // particles
  const particlesCount = 360;
  const pGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particlesCount*3);
  for (let i=0;i<particlesCount;i++){
    positions[i*3+0] = (Math.random()-0.5) * 12;
    positions[i*3+1] = (Math.random()-0.5) * 6;
    positions[i*3+2] = (Math.random()-0.5) * 8;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.03, transparent:true, opacity:0.55 });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // resize handling
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }, { passive:true });

  // mouse parallax
  const mouse = { x:0, y:0 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    const floating = document.getElementById('lottie-placeholder');
    if (floating) {
      floating.style.transform = `translate3d(${mouse.x*18}px, ${mouse.y*18}px, 0) rotateX(${ -mouse.y*6 }deg) rotateY(${ mouse.x*6 }deg)`;
    }
  }, { passive:true });

  // GLTF loader fallback (if model.glb present, attempt to load)
  if (typeof THREE.GLTFLoader !== 'undefined') {
    try {
      const head = await fetch('model.glb', { method: 'HEAD' });
      if (head.ok) {
        const loader = new THREE.GLTFLoader();
        loader.load('model.glb', (g) => {
          scene.remove(knot);
          const obj = g.scene;
          obj.scale.setScalar(1.2);
          obj.position.copy(knot.position);
          scene.add(obj);
        }, undefined, ()=>{/* ignore errors */});
      }
    } catch(e){}
  }

  // animate
  const clock = new THREE.Clock();
  function animate(){
    const t = clock.getElapsedTime();
    waveMat.uniforms.uTime.value = t;
    knot.rotation.y += 0.006;
    knot.rotation.x = Math.sin(t*0.2)*0.05;
    particles.rotation.y = t*0.02;

    // animate material color - simple looped blend
    const r = 0.5 + 0.5*Math.sin(t*0.4);
    const g = 0.5 + 0.5*Math.sin(t*0.6 + 1.0);
    const b = 0.5 + 0.5*Math.sin(t*0.8 + 2.0);
    mat.color.setRGB(0.5+r*0.5, 0.6+g*0.4, 0.7+b*0.3);

    // camera parallax
    camera.position.x += (mouse.x*0.6 - camera.position.x) * 0.04;
    camera.position.y += (-mouse.y*0.35 - camera.position.y) * 0.04;
    camera.lookAt(0,0,0);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  // GSAP reveals if available
  if (typeof gsap !== 'undefined') {
    try {
      gsap.from(".hero-left .tag", { y: 12, opacity: 0, duration: 0.6, ease: "power3.out" });
      gsap.from(".hero-left h1", { y: 30, opacity: 0, duration: 1.1, delay: 0.08, ease: "power3.out" });
      gsap.from(".sub", { y: 14, opacity: 0, duration: 0.9, delay: 0.2 });
      gsap.from(".hero-actions .btn", { y: 12, opacity: 0, duration: 0.9, delay: 0.32, stagger: 0.08 });
      gsap.from(".floating", { y: 8, opacity: 0, duration: 0.9, delay: 0.45 });
    } catch(e){}
  }

  // Lottie badge (if logo-lottie.json present)
  try {
    const res = await fetch('logo-lottie.json', { method: 'HEAD' });
    if (res.ok && typeof lottie !== 'undefined') {
      lottie.loadAnimation({
        container: document.getElementById('lottie-placeholder'),
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'logo-lottie.json'
      });
    }
  } catch(e){}

  console.info('CreativeChacha-style hero initialized.');
})();
