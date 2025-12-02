// Footer year
document.getElementById('year')?.textContent = new Date().getFullYear();

// Menu toggle for mobile
const toggle = document.getElementById('menu-toggle');
const navList = document.getElementById('nav-list');
if(toggle && navList){
  toggle.addEventListener('click', ()=>{
    const open = navList.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
}

// Parallax & slight rotation for the coffee glass on scroll
const coffee = document.getElementById('coffee-illustration');
if(coffee){
  window.addEventListener('scroll', ()=>{
    const y = window.scrollY;
    const ty = Math.min(20, y * 0.02);
    const rot = Math.min(6, y * 0.006);
    coffee.style.transform = `translateY(-${ty}px) rotate(${rot}deg)`;
  }, {passive:true});
}
