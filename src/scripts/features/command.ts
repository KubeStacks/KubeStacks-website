/**
 * "⌘K goes anywhere": the app's command palette over the demo cluster. It types searches on
 * its own while it's on screen, until someone clicks into it; then it's theirs to search.
 */
import { DEMO_CLUSTER, OTHER_CLUSTERS } from '../../lib/demo-cluster'
import { escapeHtml } from '../../lib/html'
import { icon, type Health, type IconName } from '../../lib/icons'
import { reducedMotion } from './visible'

interface Entry {
  group: string
  name: string
  meta: string
  /** Objects show their health; views, namespaces and clusters an icon. */
  lead: { health: Health } | { icon: IconName }
}

const views: [string, string, IconName][] = [
  ['Overview', '⌘1', 'layout-grid'],
  ['Workloads', 'G W', 'layers'],
  ['Pods', 'G P', 'box'],
  ['Metrics', 'G U', 'chart-line'],
  ['Helm releases', 'G H', 'ship-wheel'],
  ['Nodes', 'G N', 'boxes'],
  ['Events', 'G E', 'scroll-text'],
]

const objects: [string, string, Health][] = [
  ['checkout', 'Deployment · shop', 'warning'],
  ['cart', 'Deployment · shop', 'healthy'],
  ['storefront', 'Deployment · shop', 'healthy'],
  ['recommendations', 'Deployment · shop', 'critical'],
  ['redis', 'StatefulSet · data', 'warning'],
  ['postgres', 'StatefulSet · data', 'healthy'],
  ['grafana', 'Deployment · monitoring', 'healthy'],
  ['db-migrate', 'Job · batch', 'critical'],
  ['nightly-reports', 'CronJob · batch', 'healthy'],
  ['checkout-jzhdh6j29h-hqnnn', 'Pod · shop', 'critical'],
  ['checkout-jzhdh6j29h-lnk52', 'Pod · shop', 'healthy'],
  ['redis-0', 'Pod · data', 'healthy'],
  ['redis-1', 'Pod · data', 'warning'],
  ['checkout', 'Service · shop', 'healthy'],
  ['redis', 'Service · data', 'healthy'],
]

const nodes: [string, string, Health][] = [
  ['control-plane-1', 'Node · Ready', 'healthy'],
  ['worker-1', 'Node · Ready', 'healthy'],
  ['worker-2', 'Node · MemoryPressure', 'warning'],
  ['worker-3', 'Node · NotReady', 'critical'],
]

const namespaces = ['shop', 'data', 'monitoring', 'batch', 'kube-system', 'default']

const INDEX: Entry[] = [
  ...views.map(([name, meta, i]) => ({ group: 'Views', name, meta, lead: { icon: i } })),
  ...objects.map(([name, meta, health]) => ({ group: 'Objects', name, meta, lead: { health } })),
  ...nodes.map(([name, meta, health]) => ({ group: 'Nodes', name, meta, lead: { health } })),
  ...namespaces.map((name) => ({
    group: 'Namespaces',
    name,
    meta: 'Namespace',
    lead: { icon: 'layout-grid' as IconName },
  })),
  ...[DEMO_CLUSTER, ...OTHER_CLUSTERS].map(({ name, kubernetes }) => ({
    group: 'Clusters',
    name,
    meta: `Kubernetes ${kubernetes}`,
    lead: { icon: 'layers' as IconName },
  })),
]

/** What the palette types on its own, in turn. */
const DEMO_QUERIES = ['chec', 'worker', 'redis', 'prod']

/** The list's fixed height holds seven rows, group headings included. */
const ROWS = 7

/** Matches for a query, at most what fits; an empty query lists the views. */
export function search(query: string): Entry[] {
  const q = query.trim().toLowerCase()
  const found = q
    ? INDEX.filter((e) => e.name.toLowerCase().includes(q) || e.meta.toLowerCase().includes(q))
    : INDEX.filter((e) => e.group === 'Views')
  let rows = 0
  let group = ''
  return found.filter((e) => {
    rows += e.group === group ? 1 : 2
    group = e.group
    return rows <= ROWS
  })
}

const highlight = (name: string, q: string) => {
  const at = q ? name.toLowerCase().indexOf(q) : -1
  if (at < 0) return escapeHtml(name)
  return `${escapeHtml(name.slice(0, at))}<mark>${escapeHtml(name.slice(at, at + q.length))}</mark>${escapeHtml(name.slice(at + q.length))}`
}

export function mountCommand(root: HTMLElement) {
  const input = root.querySelector('input')!
  const list = root.querySelector('ul')!
  let results: Entry[] = []
  let selected = 0
  let demo = 0

  function render() {
    const q = input.value.trim().toLowerCase()
    results = search(q)
    selected = Math.min(selected, results.length - 1)
    if (results.length === 0) {
      list.innerHTML = `<li class="p-empty">Nothing matches “${escapeHtml(input.value)}” in ${DEMO_CLUSTER.name}.</li>`
      return
    }
    let group = ''
    list.innerHTML = results
      .map((e, i) => {
        const heading =
          e.group === group ? '' : `<li class="p-group" role="presentation">${e.group}</li>`
        group = e.group
        const lead =
          'health' in e.lead
            ? `<span class="dot" data-health="${e.lead.health}"></span>`
            : icon(e.lead.icon)
        return `${heading}<li class="p-item" role="option" aria-selected="${i === selected}" data-i="${i}">${lead}<span class="p-name">${highlight(e.name, q)}</span><span class="p-meta">${escapeHtml(e.meta)}</span></li>`
      })
      .join('')
  }

  // Typing on its own: a search, a couple of moves down the results, then the next one.
  let playing = !reducedMotion
  let onScreen = false
  let timer = 0
  const after = (ms: number, fn: () => void) => (timer = window.setTimeout(fn, ms))

  function play() {
    const word = DEMO_QUERIES[demo++ % DEMO_QUERIES.length]!
    input.value = ''
    selected = 0
    render()
    let typed = 0
    const type = () => {
      input.value = word.slice(0, ++typed)
      render()
      if (typed < word.length) after(90 + Math.random() * 90, type)
      else after(900, () => move(Math.min(2, results.length - 1)))
    }
    const move = (left: number) => {
      if (left === 0) return after(1500, play)
      selected++
      render()
      after(650, () => move(left - 1))
    }
    after(400, type)
  }

  function takeOver() {
    if (!playing) return
    playing = false
    window.clearTimeout(timer)
    input.value = ''
    selected = 0
    render()
  }

  input.addEventListener('pointerdown', takeOver)
  input.addEventListener('focus', takeOver)
  input.addEventListener('input', () => {
    selected = 0
    render()
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      selected = (selected + step + results.length) % Math.max(1, results.length)
      render()
    } else if (e.key === 'Escape') {
      input.value = ''
      render()
      input.blur()
    }
  })
  list.addEventListener('pointermove', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
    if (playing || !item || Number(item.dataset.i) === selected) return
    selected = Number(item.dataset.i)
    render()
  })

  // It types while it's on screen and the tab shows; out of sight, it waits, and starts the
  // next search when it's back.
  const resume = () => {
    window.clearTimeout(timer)
    if (playing && onScreen && !document.hidden) play()
  }
  new IntersectionObserver(([entry]) => {
    onScreen = entry!.isIntersecting
    resume()
  }).observe(root)
  document.addEventListener('visibilitychange', resume)

  render()
}

document.querySelectorAll<HTMLElement>('[data-command]').forEach(mountCommand)
