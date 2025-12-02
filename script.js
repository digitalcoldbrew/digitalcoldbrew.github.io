// small accessible interactions
document.getElementById('year').textContent = new Date().getFullYear();
const toggle = document.getElementById('menu-toggle');
const navList = document.getElementById('nav-list');
toggle && toggle.addEventListener('click', () => {
  const open = navList.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
});

// Demo contact form (no server) - show a friendly message
document.getElementById('contactForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const status = document.getElementById('formStatus');
  status.textContent = 'Thanks! Your message was received (demo). We will contact you soon.';
  e.target.reset();
});
