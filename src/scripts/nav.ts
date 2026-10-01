/** The navigation bar gets a background once the page scrolls under it. */
export function mountNav(nav: HTMLElement) {
  const update = () => nav.toggleAttribute('data-scrolled', window.scrollY > 8)
  window.addEventListener('scroll', update, { passive: true })
  update()
}

document.querySelectorAll<HTMLElement>('[data-nav]').forEach(mountNav)
