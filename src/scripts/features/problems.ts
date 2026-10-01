/**
 * "Problems sort to the top": workloads change state now and then, and the list re-sorts
 * itself, failing ones first, the way the app's lists do.
 */
import { pill, type Health } from '../../lib/icons'
import { glide, whileVisible } from './visible'

const RANK: Record<Health, number> = {
  critical: 0,
  warning: 1,
  progressing: 2,
  healthy: 3,
  neutral: 4,
}

/** What happens to which workload, in turn: [name, health, status, pods]. */
const SCRIPT: [string, Health, string, string][] = [
  ['cart', 'warning', 'Degraded', '1/2'],
  ['grafana', 'critical', 'Unavailable', '0/1'],
  ['cart', 'healthy', 'Ready', '2/2'],
  ['backfill', 'neutral', 'Complete', '1/1 done'],
  ['grafana', 'healthy', 'Ready', '1/1'],
  ['backfill', 'progressing', 'Running', '0/1 done'],
]

export function mountProblems(root: HTMLElement) {
  const list = root.querySelector('ol')!

  function update(name: string, health: Health, label: string, pods: string) {
    const row = list.querySelector<HTMLElement>(`[data-name="${name}"]`)!
    row.dataset.health = health
    row.querySelector('.c-status')!.innerHTML = pill(health, label)
    row.querySelector('.c-pods')!.textContent = pods
    row.toggleAttribute('data-changed', true)
    window.setTimeout(() => row.toggleAttribute('data-changed', false), 1400)

    const rows = [...list.querySelectorAll<HTMLElement>(':scope > li')]
    const before = rows.map((r) => r.getBoundingClientRect())
    rows
      .toSorted(
        (a, b) =>
          RANK[a.dataset.health as Health] - RANK[b.dataset.health as Health] ||
          a.dataset.name!.localeCompare(b.dataset.name!),
      )
      .forEach((r) => list.append(r))
    glide(rows, before, 620)
  }

  let step = 0
  whileVisible(root, 2600, () => update(...SCRIPT[step++ % SCRIPT.length]!), 1400)
}

document.querySelectorAll<HTMLElement>('[data-problems]').forEach(mountProblems)
