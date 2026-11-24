(() => {
  'use strict';

  const wordmark = document.getElementById('brand-wordmark');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animationDuration = 1200;
  const restingDuration = 2500;
  let timer;

  wordmark.style.setProperty('--wordmark-duration', animationDuration + 'ms');

  function measureText(text) {
    text.parentElement.style.setProperty('--wordmark-tail-width', text.getBoundingClientRect().width + 'px');
  }

  const sizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) measureText(entry.target);
  });
  for (const text of wordmark.querySelectorAll('.wordmark-tail > span')) {
    measureText(text);
    sizeObserver.observe(text);
  }

  function animate() {
    wordmark.toggleAttribute('data-compact');
    timer = setTimeout(animate, animationDuration + restingDuration);
  }

  function syncTimer() {
    clearTimeout(timer);
    if (reducedMotion.matches) wordmark.removeAttribute('data-compact');
    if (document.hidden || reducedMotion.matches) return;

    timer = setTimeout(animate, restingDuration);
  }

  document.addEventListener('visibilitychange', syncTimer);
  reducedMotion.addEventListener('change', syncTimer);
  syncTimer();
})();
