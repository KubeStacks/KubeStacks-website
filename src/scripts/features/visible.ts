/** Shared by the feature demos: they animate only while on screen, and never with reduced motion. */
export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Runs `tick` every `interval` ms while `el` is on screen; the first tick comes after `first`. */
export function whileVisible(el: Element, interval: number, tick: () => void, first = interval) {
  if (reducedMotion) return
  let timer = 0
  const loop = () => {
    tick()
    timer = window.setTimeout(loop, interval)
  }
  new IntersectionObserver(([entry]) => {
    window.clearTimeout(timer)
    if (entry!.isIntersecting) timer = window.setTimeout(loop, first)
  }).observe(el)
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
