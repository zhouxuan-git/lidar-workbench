(() => {
  'use strict';

  const wordmark = document.getElementById('brand-wordmark');
  let frame = 0;

  function renderWordmark() {
    wordmark.toggleAttribute('data-compact', window.scrollY > 28);
    frame = 0;
  }

  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(renderWordmark);
  }, {passive:true});
  window.addEventListener('pageshow', renderWordmark);
  renderWordmark();
})();
