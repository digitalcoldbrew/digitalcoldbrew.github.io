// script.js - safe loader + shader + fallback + lottie integration
(async function(){

  // helper: fetch text or null
  async function fetchText(path){
    try {
      const r = await fetch(path);
      if (!r.ok) return null;
      return await r.text();
    } catch(e){
      return null;
    }
  }

  // try to load external shaders (optional)
  const vertText = await fetchText('coffee-shader.vert');
  const fragText = await fetchText('coffee-shader.frag');

  const vertexShader = vertText || `
    varying vec2 vUv;
    uniform float uTime;
    void main(){
      vUv = uv;
      vec3 p = position;
      p.z += sin((p.x + uTime*0.8) * 1.6) * 0.25;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
    }
  `;

  const fragmentShader = fragText || `
    varying vec2 vUv;
    uniform float uTime;
    void main(){
      vec2 uv = vUv;
      float t = uTime * 0.15;
      vec3 warm = vec3(0.95,0.45,0.38);
      vec3 mid = vec3(0.22,0.38,0.44);
      vec3 cool = vec3(0.06,0.12,0.18);
      float g = smoothstep(0.0,1.0, uv.x + 0.05 * sin(t + uv.y * 4.0));
      vec3 base = mix(warm, mid, g);
      base = mix(base, cool, pow(uv.y, 1.6) * 0.6);
      gl_FragColor = vec4(base, 1.0);
    }
  `;

  // create renderer & scene
  const canvas = document.getElementById('hero-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0,0,6);

  // shader plane
  const planeGeo = new THREE.PlaneGeometry(16,9,80,80);
  const planeMat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uTime: { value: 0 } },
    side: THREE.DoubleSide
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.scale.set(1.12,1.12,1);
  plane.rotation.x = -0.05;
  plane.position.z = -2;
  scene.add(plane);

  // particle field
  const pCount = 420;
  const pGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(pCount * 3);
  for(let i=0;i<pCount;i++){
    positions[i*3+0] = (Math.random() - 0.5) * 18;
    positions[i*3+1] = (Math.random() - 0.5) * 10;
    positions[i*3+2] = (Math.random() - 0.5) * 8;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.028, transparent: true, opacity: 0.6 });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // simple lighting for 3D model fallback
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5,5,5);
  scene.add(dirLight);

  // resize handling
  function onResize(){
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize, { passive: true });

  // mouse parallax
  const mouse = { x: 0, y: 0 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  // try load external GLB model; if not present, create fallback geometry
  let floatingObject = null;
  async function tryLoadModel(){
    try {
      const head = await fetch('model.glb', { method: 'HEAD' });
      if (!head.ok) throw new Error('no model');
      const loader = new THREE.GLTFLoader();
      loader.load('model.glb', (gltf) => {
        floatingObject = gltf.scene;
        floatingObject.scale.setScalar(1.2);
        floatingObject.position.set(0, -0.2, 0);
        scene.add(floatingObject);
      }, undefined, (err) => {
        console.warn('GLTF load err', err);
        createFallback();
      });
    } catch(e){
      createFallback();
    }
  }

  function createFallback(){
    const geo = new THREE.TorusKnotGeometry(0.9, 0.28, 120, 20);
    const mat = new THREE.MeshStandardMaterial({ metalness: 0.12, roughness: 0.35 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, -0.2, 0);
    scene.add(mesh);
    floatingObject = mesh;
  }

  await tryLoadModel();

  // animation loop
  const clock = new THREE.Clock();
  function anim(){
    const t = clock.getElapsedTime();
    planeMat.uniforms.uTime.value = t;
    particles.rotation.y = t * 0.015;
    if (floatingObject) {
      floatingObject.rotation.y += 0.006 + Math.sin(t * 0.12) * 0.002;
      floatingObject.rotation.x += Math.sin(t * 0.07) * 0.002;
    }
    camera.position.x += (mouse.x * 0.8 - camera.position.x) * 0.05;
    camera.position.y += (-mouse.y * 0.45 - camera.position.y) * 0.05;
    camera.lookAt(0,0,0);
    renderer.render(scene, camera);
    requestAnimationFrame(anim);
  }
  anim();

  // floating card microparallax
  const floatingCard = document.getElementById('lottie-placeholder');
  window.addEventListener('mousemove', (e) => {
    const rx = (e.clientX / window.innerWidth) - 0.5;
    const ry = (e.clientY / window.innerHeight) - 0.5;
    if (floatingCard) {
      floatingCard.style.transform = `translate3d(${rx * 18}px, ${ry * 18}px, 0) rotateX(${ -ry * 6 }deg) rotateY(${ rx * 7 }deg)`;
    }
  });

  // try load Lottie animation (logo-lottie.json) if present
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
  } catch(e) { /* no lottie present - ignore */ }

  // GSAP content reveals
  if (typeof gsap !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    gsap.from(".hero-left .tag", { y: 12, opacity: 0, duration: 0.7, ease: "power3.out" });
    gsap.from(".hero-left h1", { y: 30, opacity: 0, duration: 1.1, delay: 0.08, ease: "power3.out" });
    gsap.from(".sub", { y: 18, opacity: 0, duration: 0.9, delay: 0.22 });
    gsap.from(".hero-actions .btn", { y: 12, opacity: 0, duration: 0.8, delay: 0.36, stagger: 0.08 });

    document.querySelectorAll('.section').forEach((sec)=>{
      gsap.from(sec.querySelectorAll('h2, .section-sub, .service-card, .project, .price-card, .member, .contact-form, .contact-info'), {
        scrollTrigger: { trigger: sec, start: "top 80%" },
        y: 26, opacity: 0, duration: 0.9, stagger: 0.08, ease: "power3.out"
      });
    });

    gsap.to(".price-card.recommended", { y: -4, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 2 });
  }

})();
