/**
 * "Usage next to capacity": the overview's CPU card, with an hour of samples that keeps
 * drifting a little.
 */
import { whileVisible } from './visible'

const ALLOCATABLE = 27.5
const SAMPLES = 40
/** The sparkline's box (its SVG viewBox) and the share of capacity it spans. */
const WIDTH = 160
const HEIGHT = 44
const LOW = 0.3
const HIGH = 0.6

export function mountUsage(root: HTMLElement) {
  const pct = root.querySelector('[data-u-pct]')!
  const cores = root.querySelector('[data-u-cores]')!
  const fill = root.querySelector<HTMLElement>('[data-u-fill]')!
  const meter = root.querySelector('[role="meter"]')!
  const line = root.querySelector('[data-u-line]')!
  const area = root.querySelector('[data-u-area]')!
  const end = root.querySelector<HTMLElement>('[data-u-end]')!

  // An hour of samples around 44%, ending on the overview's 44.4%.
  const values: number[] = []
  for (let i = 0, v = 0.42; i < SAMPLES - 1; i++) {
    v += (Math.random() - 0.5) * 0.02 + (0.44 - v) * 0.15
    values.push(v)
  }
  values.push(0.444)

  function render() {
    const points = values.map((v, i) => [
      (i / (SAMPLES - 1)) * WIDTH,
      HEIGHT - ((v - LOW) / (HIGH - LOW)) * HEIGHT,
    ])
    const d = points
      .map(([x, y], i) => `${i ? 'L' : 'M'}${x!.toFixed(1)} ${y!.toFixed(1)}`)
      .join(' ')
    line.setAttribute('d', d)
    area.setAttribute('d', `${d} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`)
    const last = values.at(-1)!
    end.style.setProperty('--y', `${points.at(-1)![1]}px`)
    pct.textContent = String(Math.round(last * 100))
    cores.textContent = (last * ALLOCATABLE).toFixed(1)
    fill.style.setProperty('--v', last.toFixed(3))
    meter.setAttribute('aria-valuenow', String(Math.round(last * 100)))
  }

  render()
  whileVisible(root, 1600, () => {
    const last = values.at(-1)!
    values.shift()
    values.push(
      Math.min(0.56, Math.max(0.36, last + (Math.random() - 0.5) * 0.05 + (0.45 - last) * 0.2)),
    )
    render()
  })
}

document.querySelectorAll<HTMLElement>('[data-usage]').forEach(mountUsage)
