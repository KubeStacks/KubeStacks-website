/**
 * "Helm releases, read in place": a release's history, and the diff of its values between
 * the current revision and the one picked.
 */
import { escapeHtml } from '../../lib/html'

/** The values diff from each earlier revision to revision 3: [mark, line]. */
const DIFFS: Record<string, [' ' | '+' | '-', string][]> = {
  '2': [
    [' ', 'image:'],
    ['-', '  tag: v3.9.0'],
    ['+', '  tag: v3.9.1'],
    [' ', 'replicaCount: 3'],
    ['+', 'host: www.shop.example.com'],
  ],
  '1': [
    [' ', 'image:'],
    ['-', '  tag: v3.8.0'],
    ['+', '  tag: v3.9.1'],
    ['-', 'replicaCount: 2'],
    ['+', 'replicaCount: 3'],
    ['+', 'host: www.shop.example.com'],
  ],
}

const CLASSES = { ' ': '', '+': 'add', '-': 'del' }

export function mountHelm(root: HTMLElement) {
  const diff = root.querySelector('pre')!
  const from = root.querySelector('[data-from]')!
  const stat = root.querySelector('[data-stat]')!
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button[data-rev]')]

  function show(rev: string) {
    const lines = DIFFS[rev]!
    const added = lines.filter(([mark]) => mark === '+').length
    const removed = lines.filter(([mark]) => mark === '-').length
    from.textContent = rev
    stat.innerHTML = `<ins>+${added}</ins> <del>−${removed}</del>`
    diff.innerHTML = lines
      .map(([mark, line]) => `<span class="${CLASSES[mark]}">${mark} ${escapeHtml(line)}</span>`)
      .join('')
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.rev === rev))
  }

  for (const b of buttons) b.addEventListener('click', () => show(b.dataset.rev!))
  show('2')
}

document.querySelectorAll<HTMLElement>('[data-helm]').forEach(mountHelm)
