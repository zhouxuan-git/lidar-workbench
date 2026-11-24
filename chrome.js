(() => {
  'use strict';

  const wordmark = document.getElementById('brand-wordmark');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const interval = 2500;
  let timer;

  function syncTimer() {
    clearInterval(timer);
    if (reducedMotion.matches) wordmark.removeAttribute('data-compact');
    if (document.hidden || reducedMotion.matches) return;

    timer = setInterval(() => wordmark.toggleAttribute('data-compact'), interval);
  }

  document.addEventListener('visibilitychange', syncTimer);
  reducedMotion.addEventListener('change', syncTimer);
  syncTimer();
})();
