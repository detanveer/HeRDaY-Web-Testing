/* One Home-derived logo renderer. Page classes retain their existing header slots. */
const HerDayLogo = Object.freeze({
  asset: 'logo_herday.webp',
  html(className = '') {
    return `<img class="herday-shared-logo ${className}" src="${this.asset}" alt="HerDay">`;
  },
  mount(root = document) {
    root.querySelectorAll('[data-herday-logo]').forEach(slot => {
      const template = document.createElement('template');
      template.innerHTML = this.html(slot.className);
      slot.replaceWith(template.content.firstElementChild);
    });
  }
});
HerDayLogo.mount();
