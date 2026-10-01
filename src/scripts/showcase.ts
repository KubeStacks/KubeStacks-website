/**
 * The app window: tabs switch between the app's views, with the arrow keys or with the
 * app's own shortcuts (G, then a letter). Each view has a screenshot per theme.
 */
const ARMED_FOR = 1200

export function mountShowcase(root: HTMLElement) {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')]

  // Every view loads up front (the window sits right under the hero), so switching never
  // shows a blank frame: the current theme's screenshots, and the open view's in the other.
  function preload() {
    const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
    const other = theme === 'light' ? 'dark' : 'light'
    const images = root.querySelectorAll<HTMLImageElement>(
      `.view img[data-variant="${theme}"], .view[data-active="true"] img[data-variant="${other}"]`,
    )
    for (const img of images) img.loading = 'eager'
  }

  function select(tab: HTMLButtonElement) {
    const id = tab.dataset.view
    for (const t of tabs) {
      t.setAttribute('aria-selected', String(t === tab))
      t.tabIndex = t === tab ? 0 : -1
    }
    for (const v of root.querySelectorAll<HTMLElement>('.view'))
      v.dataset.active = String(v.dataset.view === id)
    for (const c of root.querySelectorAll<HTMLElement>('[data-caption]'))
      c.hidden = c.dataset.caption !== id
    preload()
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab))
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      e.preventDefault()
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]!
      select(next)
      next.focus()
    })
  })

  preload()
  window.addEventListener('themechange', preload)

  // G, then a letter, as in the app: whatever key follows G ends the sequence. Not while
  // typing, and not with other keys held.
  let armed = -Infinity
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target as Element).closest('input, textarea'))
      return
    if (e.timeStamp - armed > ARMED_FOR) {
      if (e.key.toUpperCase() === 'G') armed = e.timeStamp
      return
    }
    armed = -Infinity
    const tab = tabs.find((t) => t.dataset.key === e.key.toUpperCase())
    if (!tab) return
    select(tab)
    const r = root.getBoundingClientRect()
    if (r.top > innerHeight / 2 || r.bottom < innerHeight * 0.3)
      root.scrollIntoView({ behavior: 'smooth' })
  })
}

document.querySelectorAll<HTMLElement>('[data-showcase]').forEach(mountShowcase)
