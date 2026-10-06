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
  let elapsed = 0;
  let columns = 0;
  let rows = 0;

  function resize() {
    const bounds = hero.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    // One node per gently jittered lattice position. Bounded motion preserves
    // even coverage instead of letting freely drifting particles form clusters.
    columns = Math.max(2, Math.round(width / 135));
    rows = Math.max(1, Math.round(height / 135));
    const cellX = width / columns;
    const cellY = height / rows;
    dots = Array.from({ length: (columns + 1) * (rows + 1) }, (_, index) => {
      const column = index % (columns + 1);
      const row = Math.floor(index / (columns + 1));
      const baseX = column * cellX + (Math.random() - 0.5) * cellX * 0.30;
      const baseY = row * cellY + (Math.random() - 0.5) * cellY * 0.30;
      return {
      x: baseX, y: baseY, baseX, baseY,
      phase: Math.random() * Math.PI * 2,
      amplitude: Math.min(10, cellX * 0.08, cellY * 0.08),
      offsetX: 0,
      offsetY: 0,
      radius: 0.85 + Math.random() * 0.45,
      opacity: 0.28 + Math.random() * 0.1,
      color: colors[Math.floor(Math.random() * colors.length)]
    }; });
    draw(0);
  }

  function draw(seconds) {
    context.clearRect(0, 0, width, height);
    elapsed += seconds;
    for (const dot of dots) {
      dot.x = dot.baseX + Math.sin(elapsed * 0.23 + dot.phase) * dot.amplitude;
      dot.y = dot.baseY + Math.cos(elapsed * 0.19 + dot.phase) * dot.amplitude;
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

    // Adjacent lattice nodes form an evenly distributed triangular mesh.
    context.strokeStyle = '#39788a';
    context.lineWidth = 1;
    for (let i = 0; i < dots.length; i++) {
      const a = dots[i];
      const column = i % (columns + 1);
      const row = Math.floor(i / (columns + 1));
      const neighbors = [];
      if (column < columns) neighbors.push(i + 1);
      if (row < rows) {
        neighbors.push(i + columns + 1);
        if ((column + row) % 2 === 0 && column < columns) neighbors.push(i + columns + 2);
        else if (column > 0) neighbors.push(i + columns);
      }
      for (const j of neighbors) {
        const b = dots[j];
        const ax = a.x + a.offsetX;
        const ay = a.y + a.offsetY;
        const bx = b.x + b.offsetX;
        const by = b.y + b.offsetY;
        context.globalAlpha = 0.14 + 0.025 * Math.sin(elapsed * 0.2 + a.phase);
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
