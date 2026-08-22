(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const navButtons = [...document.querySelectorAll('[data-go]')];
  const dots = document.getElementById('dots');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  let index = 0;

  slides.forEach((_, i) => {
    const dot = document.createElement('span');
    if (i === 0) dot.classList.add('on');
    dots.appendChild(dot);
  });

  const setSlide = (nextIndex) => {
    index = Math.max(0, Math.min(slides.length - 1, nextIndex));
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === index);
    });
    navButtons.forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.go) === index);
    });
    [...dots.children].forEach((dot, i) => {
      dot.classList.toggle('on', i === index);
    });
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    history.replaceState(null, '', `#${index}`);
  };

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => setSlide(Number(btn.dataset.go)));
  });

  prev.addEventListener('click', () => setSlide(index - 1));
  next.addEventListener('click', () => setSlide(index + 1));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      setSlide(index + 1);
    }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      setSlide(index - 1);
    }
  });

  document.querySelectorAll('.node-head').forEach((button) => {
    button.addEventListener('click', () => {
      const node = button.closest('.node');
      if (!node) return;
      const open = node.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
    });
  });

  const fromHash = Number((location.hash || '#0').slice(1));
  setSlide(Number.isFinite(fromHash) ? fromHash : 0);
})();
