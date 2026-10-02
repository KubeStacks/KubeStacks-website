/** Shared by the feature demos: they animate only while on screen, and never with reduced motion. */
export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Runs `tick` every `interval` ms while `el` is on screen and the tab is showing; the first
 * tick comes `first` ms after it shows.
 */
export function whileVisible(el: Element, interval: number, tick: () => void, first = interval) {
  if (reducedMotion) return
  let timer = 0
  let onScreen = false
  const loop = () => {
    tick()
    timer = window.setTimeout(loop, interval)
  }
  const update = () => {
    window.clearTimeout(timer)
    if (onScreen && !document.hidden) timer = window.setTimeout(loop, first)
  }
  new IntersectionObserver(([entry]) => {
    onScreen = entry!.isIntersecting
    update()
  }).observe(el)
  document.addEventListener('visibilitychange', update)
}

/** Moves elements from where they were (`before`) to where they are now, smoothly. */
export function glide(elements: HTMLElement[], before: DOMRect[], duration: number) {
  elements.forEach((el, i) => {
    const now = el.getBoundingClientRect()
    const dx = before[i]!.left - now.left
    const dy = before[i]!.top - now.top
    if (!dx && !dy) return
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
      duration,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    })
  })
}
