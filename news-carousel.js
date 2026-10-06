(() => {
  const track = document.querySelector('.news-grid');
  const previous = document.querySelector('[data-news-prev]');
  const next = document.querySelector('[data-news-next]');
  if (!track || !previous || !next) return;
  function update() {
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  }
  function advance(direction) {
    const card = track.querySelector('.news-card');
    const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap);
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  }
  previous.addEventListener('click', () => advance(-1));
  next.addEventListener('click', () => advance(1));
  track.addEventListener('scroll', update, { passive: true });
  track.addEventListener('keydown', event => {
    if (event.target !== track || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    advance(event.key === 'ArrowRight' ? 1 : -1);
  });
  new ResizeObserver(update).observe(track);
  update();
})();
