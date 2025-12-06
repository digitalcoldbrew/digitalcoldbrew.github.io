(async function(){

async function fetchOrNull(path){
  try{
    const r = await fetch(path);
    if(!r.ok) return null;
    return await r.text();
  }catch(e){ return null; }
}

const vert = await fetchOrNull("coffee-shader.vert");
const frag = await fetchOrNull("coffee-shader.frag");

const vertexShader = vert || "varying vec2 vUv; uniform float uTime; void main(){vUv=uv;vec3 p=position;p.z+=sin((p.x+uTime)*2.)*0.3;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}";

const fragmentShader = frag || "varying vec2 vUv; uniform float uTime; void main(){gl_FragColor=vec4(0.1,0.2,0.3,1.);}";

const canvas = document.getElementById("hero-canvas");
const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.setPixelRatio(devicePixelRatio);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48,window.innerWidth/window.innerHeight,0.1,1000);
camera.position.z=6;

const clock = new THREE.Clock();

const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(16,9,80,80),
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms:{uTime:{value:0}}
  })
);
plane.position.z=-3;
scene.add(plane);

// Particles
const pGeo = new THREE.BufferGeometry();
const pCount = 500;
const pos = new Float32Array(pCount*3);
for(let i=0;i<pCount;i++){
  pos[i*3]=(Math.random()-0.5)*16;
  pos[i*3+1]=(Math.random()-0.5)*10;
  pos[i*3+2]=(Math.random()-0.5)*8;
}
pGeo.setAttribute("position",new THREE.BufferAttribute(pos,3));
scene.add(new THREE.Points(pGeo,new THREE.PointsMaterial({size:0.03,opacity:0.6,transparent:true})));

// Lights
scene.add(new THREE.AmbientLight(0xffffff,0.28));
const dl=new THREE.DirectionalLight(0xffffff,0.6);
dl.position.set(4,4,4);
scene.add(dl);

// Try load model.glb
let model=null;
try{
  await fetch("model.glb",{method:"HEAD"});
  const loader=new THREE.GLTFLoader();
  loader.load("model.glb",g=>{
    model=g.scene;
    model.scale.set(1.1,1.1,1.1);
    scene.add(model);
  },undefined,()=>fallback());
}catch(e){fallback();}

function fallback(){
  const geo=new THREE.TorusKnotGeometry(1,0.3,120,20);
  model=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({metalness:0.2,roughness:0.4}));
  scene.add(model);
}

window.addEventListener("resize",()=>{
  renderer.setSize(window.innerWidth,window.innerHeight);
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
});

// parallax
const mouse={x:0,y:0};
window.addEventListener("mousemove",e=>{
  mouse.x=(e.clientX/window.innerWidth)*2-1;
  mouse.y=(e.clientY/window.innerHeight)*2-1;

  const c=document.getElementById("lottie-placeholder");
  if(c){
    c.style.transform=`translate(${mouse.x*20}px, ${mouse.y*20}px)`;
  }
});

// animation loop
function animate(){
  const t = clock.getElapsedTime();
  plane.material.uniforms.uTime.value=t;

  if(model){
    model.rotation.y+=0.01;
  }

  camera.position.x += (mouse.x*0.7-camera.position.x)*0.05;
  camera.position.y += (-mouse.y*0.4-camera.position.y)*0.05;
  camera.lookAt(0,0,0);

  renderer.render(scene,camera);
  requestAnimationFrame(animate);
}
animate();

// Lottie load
try{
  let r = await fetch("logo-lottie.json",{method:"HEAD"});
  if(r.ok){
    lottie.loadAnimation({
      container:document.getElementById("lottie-placeholder"),
      renderer:"svg",
      loop:true,
      autoplay:true,
      path:"logo-lottie.json"
    });
  }
}catch(e){}

// GSAP Animations
gsap.from(".hero-left h1",{y:40,opacity:0,duration:1});
gsap.from(".service-card",{scrollTrigger:".service-card",y:40,opacity:0,stagger:0.1});
})();
