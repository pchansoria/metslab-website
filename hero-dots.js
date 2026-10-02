/* Decorative, dot-only particle field. No libraries or external requests. */
(() => {
  'use strict';

  const canvas = document.querySelector('.hero-dots');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const hero = canvas.closest('.hero');
  const toggle = hero.querySelector('.motion-toggle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const colors = ['#168c9b', '#2878a2', '#65aba9'];
  const pointer = { x: 0, y: 0, active: false };
  let width = 0;
  let height = 0;
  let dots = [];
  let frame = 0;
  let lastTime = 0;
  let visible = true;
  let paused = reducedMotion.matches;

  function resize() {
    const bounds = hero.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(240, Math.max(70, Math.round(width * height / 4000)));
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.5) * 14,
      offsetX: 0,
      offsetY: 0,
      radius: 1.5 + Math.random() * 2.8,
      opacity: 0.22 + Math.random() * 0.28,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    draw(0);
  }

  function draw(seconds) {
    context.clearRect(0, 0, width, height);
    for (const dot of dots) {
      dot.x = (dot.x + dot.vx * seconds + width) % width;
      dot.y = (dot.y + dot.vy * seconds + height) % height;
      let targetX = 0;
      let targetY = 0;
      if (pointer.active && seconds > 0) {
        const dx = dot.x - pointer.x;
        const dy = dot.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 150) {
          const force = (1 - distance / 150) * 48;
          targetX = dx / (distance || 1) * force;
          targetY = dy / (distance || 1) * force;
        }
      }
      const ease = seconds > 0 ? 1 - Math.exp(-seconds * 7) : 1;
      dot.offsetX += (targetX - dot.offsetX) * ease;
      dot.offsetY += (targetY - dot.offsetY) * ease;
      context.globalAlpha = dot.opacity;
      context.fillStyle = dot.color;
      context.beginPath();
      context.arc(dot.x + dot.offsetX, dot.y + dot.offsetY, dot.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function animate(time) {
    draw(lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0);
    lastTime = time;
    frame = requestAnimationFrame(animate);
  }

  function syncAnimation() {
    cancelAnimationFrame(frame);
    lastTime = 0;
    const staticMode = paused;
    toggle.hidden = false;
    toggle.textContent = paused ? 'Resume animation' : 'Pause animation';
    toggle.setAttribute('aria-pressed', String(paused));
    if (!staticMode && visible && !document.hidden) {
      frame = requestAnimationFrame(animate);
    } else if (staticMode) {
      draw(0);
    }
  }

  hero.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || paused) return;
    const bounds = hero.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { pointer.active = false; });
  toggle.addEventListener('click', () => {
    paused = !paused;
    pointer.active = false;
    syncAnimation();
  });
  reducedMotion.addEventListener('change', () => {
    paused = reducedMotion.matches;
    pointer.active = false;
    syncAnimation();
  });
  document.addEventListener('visibilitychange', syncAnimation);
  new ResizeObserver(resize).observe(hero);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    syncAnimation();
  }).observe(hero);
  resize();
  syncAnimation();
})();
