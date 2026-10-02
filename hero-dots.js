/* Subtle animated network. No libraries or external requests. */
(() => {
  'use strict';

  // Video/image background sections are excluded; each other region gets its own canvas.
  const regions = document.querySelectorAll('.site-header, .site-footer, main > .section:not(.section-has-bg), main.section:not(.section-has-bg)');
  regions.forEach(hero => {
  if (hero.querySelector('video')) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'site-dots';
  canvas.setAttribute('aria-hidden', 'true');
  hero.classList.add('dot-region');
  hero.prepend(canvas);
  const context = canvas.getContext('2d');
  if (!context) return;
  const colors = ['#39788a', '#4b8392'];
  const pointer = { x: 0, y: 0, active: false };
  let width = 0;
  let height = 0;
  let dots = [];
  let frame = 0;
  let lastTime = 0;
  let visible = true;

  function resize() {
    const bounds = hero.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(85, Math.max(18, Math.round(width * height / 14000)));
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      offsetX: 0,
      offsetY: 0,
      radius: 0.85 + Math.random() * 0.45,
      opacity: 0.28 + Math.random() * 0.1,
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
          const force = (1 - distance / 150) * 18;
          targetX = dx / (distance || 1) * force;
          targetY = dy / (distance || 1) * force;
        }
      }
      const ease = seconds > 0 ? 1 - Math.exp(-seconds * 7) : 1;
      dot.offsetX += (targetX - dot.offsetX) * ease;
      dot.offsetY += (targetY - dot.offsetY) * ease;
    }

    // Nearby nodes form a fine, slowly changing mesh with gently fading edges.
    const reach = Math.min(200, Math.max(145, width * 0.16));
    context.strokeStyle = '#39788a';
    context.lineWidth = 1;
    for (let i = 0; i < dots.length; i++) {
      const a = dots[i];
      for (let j = i + 1; j < dots.length; j++) {
        const b = dots[j];
        const ax = a.x + a.offsetX;
        const ay = a.y + a.offsetY;
        const bx = b.x + b.offsetX;
        const by = b.y + b.offsetY;
        const distance = Math.hypot(ax - bx, ay - by);
        if (distance >= reach) continue;
        context.globalAlpha = 0.34 * (1 - distance / reach);
        context.beginPath();
        context.moveTo(ax, ay);
        context.lineTo(bx, by);
        context.stroke();
      }
    }

    for (const dot of dots) {
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
    if (visible && !document.hidden) {
      frame = requestAnimationFrame(animate);
    }
  }

  hero.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const bounds = hero.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { pointer.active = false; });
  document.addEventListener('visibilitychange', syncAnimation);
  new ResizeObserver(resize).observe(hero);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    syncAnimation();
  }).observe(hero);
  resize();
  syncAnimation();
  });
})();

