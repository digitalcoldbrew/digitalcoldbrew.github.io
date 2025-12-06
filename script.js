// script.js
//  - three.js animated shader background + particles
//  - simple floating card parallax & GSAP scroll animations
// Note: this uses three.min.js and gsap loaded from CDN in index.html

(() => {
  // Basic scene + camera + renderer
  const canvas = document.getElementById('hero-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 6);

  // TIME uniform
  const clock = new THREE.Clock();

  // Shader plane (wavy color background)
  const planeGeo = new THREE.PlaneGeometry(16, 9, 64, 64);

  const vert = `
    varying vec2 vUv;
    uniform float uTime;
    void main() {
      vUv = uv;
      vec3 p = position;
      float freq = 1.6;
      float amp = 0.35;
      p.z += sin((p.x+uTime*0.8)*freq)*amp + cos((p.y-uTime*0.5)*freq)*amp*0.6;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
    }
  `;

  const frag = `
    varying vec2 vUv;
    uniform float uTime;
    void main(){
      // gradient
      vec3 col1 = vec3(0.02, 0.09, 0.12);
      vec3 col2 = vec3(0.05, 0.35, 0.28);
      vec3 col3 = vec3(0.9, 0.4, 0.45);
      float g = smoothstep(0.0,1.0,vUv.y + 0.1*sin(uTime*0.2 + vUv.x*6.0));
      vec3 color = mix(col1, col2, g);
      color = mix(color, col3, pow(vUv.x, 2.0)*0.12);
      // vignette
      float vign = smoothstep(0.7, 0.15, distance(vUv, vec2(0.5)));
      color *= (1.0 - 0.5 * vign);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const planeMat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uTime: { value: 0 }
    },
    side: THREE.DoubleSide
  });

  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.scale.set(1.2,1.2,1);
  plane.rotation.x = -0.05;
  plane.position.z = -2;
  scene.add(plane);

  // Particles system (subtle)
  const particleCount = 350;
  const pGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i*3+0] = (Math.random() - 0.5) * 14;
    positions[i*3+1] = (Math.random() - 0.5) * 8;
    positions[i*3+2] = (Math.random() - 0.5) * 6;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.035, transparent: true, opacity: 0.65 });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // Simple responsive resize
  function onResize(){
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize, { passive: true });

  // Mouse parallax for camera
  const mouse = { x:0, y:0 };
  window.addEventListener('mousemove', (e)=>{
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  // Animate
  function animate(){
    const t = clock.getElapsedTime();
    planeMat.uniforms.uTime.value = t;
    // subtle particle animation
    particles.rotation.y = t * 0.02;
    // camera slight parallax
    camera.position.x += (mouse.x * 0.8 - camera.position.x) * 0.05;
    camera.position.y += (-mouse.y * 0.6 - camera.position.y) * 0.05;
    camera.lookAt(0,0,0);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  // --- UI: floating card parallax
  const card = document.getElementById('floating-card');
  // map mouse to card transform
  window.addEventListener('mousemove', (e)=>{
    const rx = (e.clientX / window.innerWidth) - 0.5;
    const ry = (e.clientY / window.innerHeight) - 0.5;
    if(card){
      card.style.transform = `translate3d(${rx * 18}px, ${ry * 18}px, 0) rotateX(${ -ry * 6 }deg) rotateY(${ rx * 8 }deg)`;
    }
  });

  // GSAP entry animations
  gsap.registerPlugin(ScrollTrigger);
  gsap.from(".hero-left h1", { y: 40, opacity:0, duration:1.05, ease:"power3.out", delay:0.2 });
  gsap.from(".lead", { y: 20, opacity:0, duration:0.9, ease:"power3.out", delay:0.45 });
  gsap.from(".btn", { y: 12, opacity:0, duration:0.7, stagger:0.08, delay:0.7 });

  // reveal on scroll for cards
  gsap.utils.toArray('.card').forEach((el)=>{
    gsap.from(el, {
      scrollTrigger:{ trigger: el, start: "top 80%" },
      y: 30, opacity: 0, duration: 0.9, ease: "power3.out"
    });
  });

})();
