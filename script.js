// === THREE.JS COFFEE RIPPLE BACKGROUND === //

let scene, camera, renderer, material, mesh, clock;

function initCoffee() {
  const canvas = document.getElementById("coffee-canvas");

  scene = new THREE.Scene();
  camera = new THREE.Camera();

  renderer = new THREE.WebGLRenderer({ canvas: canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  clock = new THREE.Clock();

  const geometry = new THREE.PlaneGeometry(2, 2);

  material = new THREE.ShaderMaterial({
    uniforms: {
      u_time: { value: 0 },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_scroll: { value: 0 },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    vertexShader: document.getElementById("vertexShader")?.textContent,
    fragmentShader: document.getElementById("fragmentShader")?.textContent
  });

  fetch("coffee-shader.vert")
    .then(res => res.text())
    .then(v => {
      material.vertexShader = v;
      material.needsUpdate = true;
    });

  fetch("coffee-shader.frag")
    .then(res => res.text())
    .then(f => {
      material.fragmentShader = f;
      material.needsUpdate = true;
    });

  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  animate();
}

function animate() {
  requestAnimationFrame(animate);

  material.uniforms.u_time.value = clock.getElapsedTime();

  renderer.render(scene, camera);
}

window.addEventListener("mousemove", (e) => {
  material.uniforms.u_mouse.value.set(
    e.clientX / window.innerWidth,
    1 - e.clientY / window.innerHeight
  );
});

window.addEventListener("scroll", () => {
  material.uniforms.u_scroll.value = window.scrollY * 0.002;
});

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  material.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
});

initCoffee();
