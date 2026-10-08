/* Align only Girls' Space's painted title to the approved neighboring Poetry
   title. Keep the original title box, subtitle flow and all card geometry. */
(() => {
  const target = document.querySelector('#homePage .girls-space-card h2');
  const reference = document.querySelector('#homePage article:has(img[src="art_poetry.webp"]) h2');
  if (!target || !reference) return;
  function alignTitle() {
    if (!target.getClientRects().length || !reference.getClientRects().length) return;
    const offset = parseFloat(target.style.getPropertyValue('--girls-title-offset')) || 0;
    const titleArt = target.closest('article').querySelector('.art');
    const referenceArt = reference.closest('article').querySelector('.art');
    const targetY = target.getBoundingClientRect().top - offset - titleArt.getBoundingClientRect().bottom;
    const referenceY = reference.getBoundingClientRect().top - referenceArt.getBoundingClientRect().bottom;
    target.style.setProperty('--girls-title-offset', `${referenceY - targetY}px`);
  }
  const observer = new ResizeObserver(alignTitle);
  observer.observe(target.closest('.strip'));
  observer.observe(target.closest('.copy'));
  observer.observe(reference.closest('.copy'));
  document.fonts.ready.then(alignTitle);
})();
