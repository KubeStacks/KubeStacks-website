/**
 * The app's icons are Lucide's, so the site's are too. Each is an SVG string, usable in
 * Astro templates (set:html) and in client scripts alike. They're imported one file at a
 * time as raw text, so only these ship, and the dev server never has to bundle the whole set.
 */
import ArrowRight from 'lucide-static/icons/arrow-right.svg?raw'
import ArrowUpRight from 'lucide-static/icons/arrow-up-right.svg?raw'
import BookOpen from 'lucide-static/icons/book-open.svg?raw'
import Box from 'lucide-static/icons/box.svg?raw'
import Boxes from 'lucide-static/icons/boxes.svg?raw'
import ChartLine from 'lucide-static/icons/chart-line.svg?raw'
import Check from 'lucide-static/icons/check.svg?raw'
import CircleCheck from 'lucide-static/icons/circle-check.svg?raw'
import CircleDashed from 'lucide-static/icons/circle-dashed.svg?raw'
import CircleMinus from 'lucide-static/icons/circle-minus.svg?raw'
import CircleX from 'lucide-static/icons/circle-x.svg?raw'
import Container from 'lucide-static/icons/container.svg?raw'
import Copy from 'lucide-static/icons/copy.svg?raw'
import Download from 'lucide-static/icons/download.svg?raw'
import Gauge from 'lucide-static/icons/gauge.svg?raw'
import KeyRound from 'lucide-static/icons/key-round.svg?raw'
import Layers from 'lucide-static/icons/layers.svg?raw'
import LayoutGrid from 'lucide-static/icons/layout-grid.svg?raw'
import Library from 'lucide-static/icons/library.svg?raw'
import Link from 'lucide-static/icons/link.svg?raw'
import ListChecks from 'lucide-static/icons/list-checks.svg?raw'
import Lock from 'lucide-static/icons/lock.svg?raw'
import LogIn from 'lucide-static/icons/log-in.svg?raw'
import Minus from 'lucide-static/icons/minus.svg?raw'
import Monitor from 'lucide-static/icons/monitor.svg?raw'
import Moon from 'lucide-static/icons/moon.svg?raw'
import Play from 'lucide-static/icons/play.svg?raw'
import Plug from 'lucide-static/icons/plug.svg?raw'
import Plus from 'lucide-static/icons/plus.svg?raw'
import RotateCw from 'lucide-static/icons/rotate-cw.svg?raw'
import ScrollText from 'lucide-static/icons/scroll-text.svg?raw'
import Search from 'lucide-static/icons/search.svg?raw'
import Server from 'lucide-static/icons/server.svg?raw'
import ShieldCheck from 'lucide-static/icons/shield-check.svg?raw'
import ShipWheel from 'lucide-static/icons/ship-wheel.svg?raw'
import SquareTerminal from 'lucide-static/icons/square-terminal.svg?raw'
import Sun from 'lucide-static/icons/sun.svg?raw'
import TriangleAlert from 'lucide-static/icons/triangle-alert.svg?raw'
import Undo2 from 'lucide-static/icons/undo-2.svg?raw'
import WifiOff from 'lucide-static/icons/wifi-off.svg?raw'

const ICONS = {
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  'book-open': BookOpen,
  box: Box,
  boxes: Boxes,
  'chart-line': ChartLine,
  check: Check,
  'circle-check': CircleCheck,
  'circle-dashed': CircleDashed,
  'circle-minus': CircleMinus,
  'circle-x': CircleX,
  container: Container,
  copy: Copy,
  download: Download,
  gauge: Gauge,
  'key-round': KeyRound,
  layers: Layers,
  'layout-grid': LayoutGrid,
  library: Library,
  link: Link,
  'list-checks': ListChecks,
  lock: Lock,
  'log-in': LogIn,
  minus: Minus,
  monitor: Monitor,
  moon: Moon,
  play: Play,
  plug: Plug,
  plus: Plus,
  'rotate-cw': RotateCw,
  'scroll-text': ScrollText,
  search: Search,
  server: Server,
  'shield-check': ShieldCheck,
  'ship-wheel': ShipWheel,
  'square-terminal': SquareTerminal,
  sun: Sun,
  'triangle-alert': TriangleAlert,
  'undo-2': Undo2,
  'wifi-off': WifiOff,
} as const

export type IconName = keyof typeof ICONS

export function icon(name: IconName, strokeWidth = 2): string {
  const svg = ICONS[name]
    .replace(/<!--[^]*?-->/, '')
    .replace(/\s*\n\s*/g, ' ')
    .trim()
  // Only the root element's size and class go; shapes inside keep theirs.
  const open = svg.slice(0, svg.indexOf('>') + 1)
  const root = open
    .replace(/\s(class|width|height)="[^"]*"/g, '')
    .replace('stroke-width="2"', `stroke-width="${strokeWidth}"`)
    .replace('<svg', '<svg aria-hidden="true" focusable="false"')
  return root + svg.slice(open.length)
}

export type Health = 'healthy' | 'progressing' | 'warning' | 'critical' | 'neutral'

export const HEALTH_ICON: Record<Health, IconName> = {
  healthy: 'circle-check',
  progressing: 'circle-dashed',
  warning: 'triangle-alert',
  critical: 'circle-x',
  neutral: 'circle-minus',
}

/** The app's StatusPill as markup. */
export function pill(health: Health, label: string): string {
  return `<span class="pill" data-health="${health}">${icon(HEALTH_ICON[health], 2.25)}<span>${label}</span></span>`
}
