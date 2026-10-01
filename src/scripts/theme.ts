/**
 * The theme switch: System, Light or Dark, as in the app's Appearance menu. The script in
 * Base.astro's <head> applies the saved choice before the first paint; this keeps the page
 * in step with the switch and with the system setting, and opens a new theme as a circle
 * from the button that chose it.
 */
type Preference = 'system' | 'light' | 'dark'
type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const ARROWS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
const root = document.documentElement
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

const resolve = (pref: Preference): Theme =>
  pref === 'system' ? (systemDark.matches ? 'dark' : 'light') : pref

/** The latest choice: the saved one (applied in <head>), until the switch is used. */
let chosen: Preference =
  root.dataset.themePref === 'light' || root.dataset.themePref === 'dark'
    ? root.dataset.themePref
    : 'system'

function apply(pref: Preference) {
  const theme = resolve(pref)
  root.dataset.themePref = pref
  document
    .querySelector('meta[name="theme-color"]')!
    .setAttribute('content', theme === 'dark' ? '#0c0c0e' : '#f5f5f6')
  for (const radio of document.querySelectorAll<HTMLElement>(
    '[data-theme-switch] [role="radio"]',
  )) {
    const on = radio.dataset.value === pref
    radio.setAttribute('aria-checked', String(on))
    radio.tabIndex = on ? 0 : -1
  }
  if (root.dataset.theme === theme) return
  root.dataset.theme = theme
  window.dispatchEvent(new CustomEvent<Theme>('themechange', { detail: theme }))
}

function choose(pref: Preference, from: HTMLElement) {
  chosen = pref
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // Storage can be off (private windows, strict settings); the choice lasts for this page.
  }
  // Without a change to show, motion or the View Transitions API, it switches at once.
  if (
    resolve(pref) === root.dataset.theme ||
    reducedMotion.matches ||
    !('startViewTransition' in document)
  ) {
    apply(pref)
    return
  }
  const r = from.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  // The latest choice, not necessarily this one: a quicker one may have been made meanwhile.
  const transition = document.startViewTransition(() => apply(chosen))
  transition.ready.then(
    () =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
          duration: 640,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      ),
    // Skipped, when another switch started before this one could: that one shows instead.
    () => {},
  )
}

export function mountThemeSwitch(el: HTMLElement) {
  const radios = [...el.querySelectorAll<HTMLElement>('[role="radio"]')]
  radios.forEach((radio, i) => {
    radio.addEventListener('click', () => choose(radio.dataset.value as Preference, radio))
    radio.addEventListener('keydown', (e) => {
      const step = ARROWS[e.key]
      if (!step) return
      e.preventDefault()
      const next = radios[(i + step + radios.length) % radios.length]!
      next.focus()
      choose(next.dataset.value as Preference, next)
    })
  })
}

// Following the system, the page changes when the system does.
systemDark.addEventListener('change', () => {
  if (chosen === 'system') apply('system')
})

document.querySelectorAll<HTMLElement>('[data-theme-switch]').forEach(mountThemeSwitch)
apply(chosen)
