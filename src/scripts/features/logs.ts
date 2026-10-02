/**
 * "Logs from every pod, in order": the checkout deployment's three pods, merged as they
 * write. The healthy one takes orders; the two crash-looping ones keep trying to start.
 */
import { escapeHtml } from '../../lib/html'
import { glide, whileVisible } from './visible'

const POD_COLORS: Record<string, string> = {
  hqnnn: 'var(--series-1)',
  lnk52: 'var(--series-2)',
  pwkd2: 'var(--series-3)',
}

/** What a crash-looping pod writes on each attempt: [level, message, fields]. */
const CRASH: [string, string, string][] = [
  ['INFO', 'starting checkout', 'version=v1.14.0'],
  ['INFO', 'loading config', 'path=/etc/checkout/config.yaml'],
  ['ERROR', 'config: STRIPE_API_KEY is not set', ''],
  ['ERROR', 'exiting', 'code=1'],
]

/** Lines kept: enough to fill the panel, which fades out the oldest at the top. */
const KEPT = 14

const pad = (n: number) => String(n).padStart(2, '0')
const id = () => Math.random().toString(16).slice(2, 12)

export function mountLogs(root: HTMLElement) {
  const list = root.querySelector('ol')!
  const chips = [...root.querySelectorAll<HTMLElement>('.chip')]
  const counts = new Map(
    [...root.querySelectorAll<HTMLElement>('[data-count]')].map((el) => [el.dataset.count!, el]),
  )
  let clock = 10 * 3600 + 13 * 60 + 2
  let crashing = 'hqnnn'
  let attempt = 0

  /** Counts a line under its pod or level; a count that gains a digit makes room smoothly. */
  function count(key: string) {
    const el = counts.get(key)!
    const before = chips.map((c) => c.getBoundingClientRect())
    el.textContent = String(Number(el.textContent) + 1)
    glide(chips, before, 320)
  }

  function write(level: string, pod: string, message: string, fields: string, live: boolean) {
    const li = document.createElement('li')
    li.dataset.level = level.toLowerCase()
    li.innerHTML = `<span class="l-time">${pad(Math.floor(clock / 3600))}:${pad(Math.floor(clock / 60) % 60)}:${pad(clock % 60)}</span><span class="l-pod" style="border-color:${POD_COLORS[pod]}">${pod}</span><span class="l-level">${level}</span><span class="l-msg">${escapeHtml(message)}</span><span class="l-kv">${escapeHtml(fields)}</span>`
    list.append(li)
    while (list.children.length > KEPT) list.firstElementChild!.remove()
    if (!live) return
    // The new line pushes the others up a line: the list glides there, as a log view scrolls.
    li.className = 'new'
    list.animate([{ transform: `translateY(${li.offsetHeight}px)` }, { transform: 'none' }], {
      duration: 360,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    })
    count(pod)
    if (level !== 'INFO') count(level === 'WARN' ? 'warn' : 'error')
  }

  function next(live: boolean) {
    clock += 1 + Math.floor(Math.random() * 2)
    // Mostly orders from the healthy pod; now and then a crashing one tries to start.
    if (attempt > 0 || Math.random() < 0.12) {
      const [level, message, fields] = CRASH[attempt]!
      write(level, crashing, message, fields, live)
      attempt = (attempt + 1) % CRASH.length
      if (attempt === 0) crashing = crashing === 'hqnnn' ? 'pwkd2' : 'hqnnn'
    } else if (Math.random() < 0.14) {
      write(
        'WARN',
        'lnk52',
        'payment declined',
        `order=ord_${id()} reason=insufficient_funds`,
        live,
      )
    } else {
      const items = 1 + Math.floor(Math.random() * 5)
      const total = 900 + Math.floor(Math.random() * 7000)
      write(
        'INFO',
        'lnk52',
        'order placed',
        `order=ord_${id()} items=${items} total_cents=${total}`,
        live,
      )
    }
  }

  for (let i = 0; i < 12; i++) next(false)
  whileVisible(root, 850, () => next(true))
}

document.querySelectorAll<HTMLElement>('[data-logs]').forEach(mountLogs)
