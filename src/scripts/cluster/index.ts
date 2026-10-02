/**
 * The hero's cluster: the KubeStacks mark (three stacked plates) drawn as a live cluster.
 * The top plate holds four nodes; each pod is a cube colored by its health, the way the
 * app's Pod health card counts them. It boots, settles and rolls out on its own, and
 * failing pods can be restarted by clicking them.
 *
 * It draws only as often as it must: every frame for the intro and while it follows the
 * pointer, 30 a second while pods arrive, change or leave, 20 while only glows pulse, and
 * none while it's off screen or the tab is hidden. With reduced motion, nothing moves, so it
 * draws only when something changes.
 */
import { DEMO_CLUSTER } from '../../lib/demo-cluster'
import { escapeHtml } from '../../lib/html'
import { icon, pill, type Health } from '../../lib/icons'
import {
  MEMORY_PRESSURE_NODE,
  NODES,
  PODS,
  SLOT_ORDER,
  UNSCHEDULABLE_REASON,
  UNSCHEDULED,
  type NodeInfo,
  type PodSeed,
} from './data'
import {
  BASE,
  BASE_T,
  CUBE,
  CUBE_H,
  FLOAT,
  LAYER_GAP,
  MARGIN,
  PRINT,
  TILE,
  TILE_T,
  clamp,
  ease,
  fit,
  inside,
  project,
  slotCenter,
  tileOrigin,
  type Point,
  type View,
} from './geometry'
import {
  STATUS,
  UNSCHEDULED_LINE,
  currentPalette,
  lighten,
  mix,
  rgba,
  shade,
  type RGB,
} from './palette'

interface Pod {
  id: number
  name: string
  ns: string
  node: number
  slot: number
  health: Health
  label: string
  restarts: number
  crashLoops: number
  /** Times on the cluster's clock (ms since it started). */
  born: number
  dying: number
  /** The color it's fading from, and when the fade to its health's color started. */
  colorFrom: RGB
  colorAt: number
  /** When the ring around it last went off. */
  ring: number
  /** How far it's raised under the pointer, eased each frame. */
  lift: number
}

const HEALTHS: Health[] = ['healthy', 'progressing', 'warning', 'critical', 'neutral']

const randomSuffix = () => {
  const chars = 'bcdfghjklmnpqrstvwxz2456789'
  let s = ''
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export function mountCluster(root: HTMLElement) {
  const canvas = root.querySelector('canvas')!
  const screen = canvas.getContext('2d')!
  /** Where drawing goes: the screen, or the backdrop while it's painted (see draw). */
  let ctx = screen
  const tip = root.querySelector<HTMLElement>('[data-tip]')!
  const card = root.querySelector<HTMLElement>('.health')!
  const note = root.querySelector<HTMLElement>('[data-note]')!
  const noteCommand = note.querySelector('[data-cmd]')!
  const counts = new Map(HEALTHS.map((h) => [h, root.querySelector(`[data-count="${h}"]`)!]))
  const segments = root.querySelectorAll<HTMLElement>('[data-seg]')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let pal = currentPalette()

  // Pods drop in from the back of the plate, all "starting" (blue) at first; then each
  // settles into the health it really has, which is how a cluster looks coming up.
  const BOOT = 700
  const SETTLE = reduced ? 0 : 2100
  /** When the plates, nodes and labels have come in. */
  const INTRO = 1900
  /** How long a pod takes to drop in, fade to a new color, fade out, and ring. */
  const DROP = 520
  const FADE = 450
  const LEAVE = 380
  const RING = 900
  /** How far a pod rises under the pointer. */
  const LIFT = 0.22

  let W = 0
  let H = 0
  let dpr = 1
  let view: View = { k: 30, cx: 0, cy: 0 }
  let start = performance.now()
  let now = start
  /** Where the pointer is over the canvas (0–1), and the eased value the parallax follows. */
  const pointer = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5 }
  let hovered: Pod | null = null
  let hoveredNode: number | null = null
  let scrolled = 0
  let ready = false
  let visible = false
  let frame = 0
  let wait = 0
  let nextId = 0

  const clock = () => now - start
  const later = (ms: number, fn: () => void) => window.setTimeout(fn, ms)

  // The pods ------------------------------------------------------------------------

  const pods: Pod[] = []
  const used = NODES.map(() => new Set<number>())

  function addPod(seed: PodSeed, born: number, slot?: number): Pod {
    const s =
      seed.node === UNSCHEDULED ? 0 : (slot ?? SLOT_ORDER.find((x) => !used[seed.node]!.has(x))!)
    if (seed.node !== UNSCHEDULED) used[seed.node]!.add(s)
    const pod: Pod = {
      id: nextId++,
      name: seed.name,
      ns: seed.ns,
      node: seed.node,
      slot: s,
      health: seed.health,
      label: seed.label,
      restarts: seed.restarts ?? 0,
      crashLoops: seed.crashLoops ?? 0,
      born,
      dying: 0,
      colorFrom: STATUS[seed.health],
      colorAt: -Infinity,
      ring: -Infinity,
      lift: 0,
    }
    pods.push(pod)
    return pod
  }

  function removePod(pod: Pod) {
    pods.splice(pods.indexOf(pod), 1)
    used[pod.node]!.delete(pod.slot)
  }

  for (const seed of PODS) {
    const pod = addPod(seed, 0)
    const { x, y } = slotCenter(pod.node, pod.slot)
    // With reduced motion, the cluster is simply there, settled.
    if (reduced) continue
    pod.born = BOOT + (x + y) * 38 + Math.random() * 140
    // Show "starting" until the settle wave reaches this pod.
    pod.colorFrom = STATUS.progressing
    pod.colorAt = SETTLE + (x + y) * 30 + Math.random() * 200
  }

  function setHealth(pod: Pod, health: Health, label: string) {
    pod.colorFrom = currentColor(pod)
    pod.colorAt = clock()
    pod.health = health
    pod.label = label
    pod.ring = clock()
    wake()
  }

  /** The health a pod shows: during the boot wave, everything is still starting. */
  function shownHealth(pod: Pod): Health {
    return clock() < pod.colorAt ? 'progressing' : pod.health
  }

  function currentColor(pod: Pod): RGB {
    if (clock() < pod.colorAt) return pod.colorFrom
    // With reduced motion, a pod takes its new color at once.
    const fade = reduced ? 1 : clamp((clock() - pod.colorAt) / FADE)
    return mix(pod.colorFrom, STATUS[pod.health], ease.inOut(fade))
  }

  /** How far a pod has appeared, from its drop-in to its fade when it's removed. */
  function podAppear(pod: Pod) {
    if (reduced) return 1
    const shown = clamp((clock() - pod.born) / DROP)
    return pod.dying ? Math.min(shown, 1 - clamp((clock() - pod.dying) / LEAVE)) : shown
  }

  /** Where a pod rests: on its node, or (unscheduled) floating above the plate. */
  function restZ(pod: Pod) {
    if (pod.node !== UNSCHEDULED) return TILE_T
    return FLOAT + (reduced ? 0 : Math.sin(clock() / 800) * 0.16)
  }

  const depth = (pod: Pod) => {
    if (pod.node === UNSCHEDULED) return Infinity
    const { x, y } = slotCenter(pod.node, pod.slot)
    return x + y
  }

  // Projection ----------------------------------------------------------------------

  /**
   * World to canvas pixels, around the plate's center. Layers below the plate follow the
   * pointer less than the plate does, for a little depth.
   */
  function P(x: number, y: number, z: number, layer = 0): Point {
    const [px, py] = project(view, x, y, z)
    return [px + (pointer.sx - 0.5) * layer, py + (pointer.sy - 0.5) * layer * 0.6]
  }

  function path(points: Point[], close = true) {
    ctx.beginPath()
    ctx.moveTo(...points[0]!)
    for (const p of points.slice(1)) ctx.lineTo(...p)
    if (close) ctx.closePath()
  }

  /** Draw at (u, v), in PRINT units, flat on the plane at height z. */
  function onPlane(z: number, layer: number) {
    const [ox, oy] = P(0, 0, z, layer)
    const s = (view.k / PRINT) * dpr
    ctx.setTransform(s, s / 2, -s, s / 2, ox * dpr, oy * dpr)
  }

  const flat = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  function resize() {
    const r = canvas.getBoundingClientRect()
    W = r.width
    H = r.height
    dpr = Math.min(window.devicePixelRatio, 2)
    canvas.width = backdrop.width = Math.round(W * dpr)
    canvas.height = backdrop.height = Math.round(H * dpr)
    backdropKey = ''
    view = fit(W, H)
    placeCard()
    // Resizing clears the canvas: draw it again before the screen shows it blank.
    if (ready) draw()
  }

  /** The health card sits in the empty corner under the plate's front-right edge. */
  function placeCard() {
    if (getComputedStyle(card).position !== 'absolute') {
      card.style.left = ''
      card.style.top = ''
      return
    }
    // Its right edge stays on the page's content edge, even where the stage runs past it.
    const grid = root.parentElement!
    const contentRight =
      grid.getBoundingClientRect().right -
      parseFloat(getComputedStyle(grid).paddingRight) -
      canvas.getBoundingClientRect().left
    const { k, cx, cy } = view
    const left = Math.max(
      0,
      Math.min(contentRight - card.offsetWidth, cx + BASE * k - card.offsetWidth + k * 0.6),
    )
    const edge = cy + (cx + BASE * k - left) / 2
    card.style.left = `${left}px`
    card.style.top = `${Math.min(H - card.offsetHeight, edge + (BASE_T + LAYER_GAP * 1.2) * k)}px`
  }

  // Drawing -------------------------------------------------------------------------

  function slab(
    [x0, y0, x1, y1]: [number, number, number, number],
    [z0, z1]: [number, number],
    layer: number,
    [top, left, right]: [string | CanvasGradient, string, string],
  ): Point[] {
    const t: Point[] = [
      P(x0, y0, z1, layer),
      P(x1, y0, z1, layer),
      P(x1, y1, z1, layer),
      P(x0, y1, z1, layer),
    ]
    path([t[3]!, t[2]!, P(x1, y1, z0, layer), P(x0, y1, z0, layer)])
    ctx.fillStyle = left
    ctx.fill()
    path([t[1]!, t[2]!, P(x1, y1, z0, layer), P(x1, y0, z0, layer)])
    ctx.fillStyle = right
    ctx.fill()
    path(t)
    ctx.fillStyle = top
    ctx.fill()
    return t
  }

  function gradient(z: number, layer: number, stops: [number, string][]) {
    const g = ctx.createLinearGradient(...P(0, 0, z, layer), ...P(BASE, BASE, z, layer))
    for (const [offset, color] of stops) g.addColorStop(offset, color)
    return g
  }

  /** A flat ellipse on the plate, as glows, rings and shadows are. */
  function ellipse(at: Point, r: number, draw: () => void) {
    ctx.save()
    ctx.translate(...at)
    ctx.scale(1, 0.5)
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    draw()
    ctx.restore()
  }

  // The plates and nodes change only with the intro, the pointer, scrolling, a hovered node
  // and the theme. They're painted into this canvas when one of those does, and copied onto
  // the screen each frame: their large gradients are most of a frame's work.
  const backdrop = document.createElement('canvas')
  const backdropCtx = backdrop.getContext('2d')!
  let backdropKey = ''

  function draw() {
    const t = clock()
    const intro = (delay: number, duration = 900) =>
      reduced ? 1 : ease.outExpo(clamp((t - delay) / duration))
    const plateIn = intro(240, 1100)
    const z0 = -(1 - plateIn) * 1.5
    const key = [
      Math.min(t, INTRO),
      pointer.sx.toFixed(3),
      pointer.sy.toFixed(3),
      scrolled,
      hoveredNode,
    ]
    if (key.join() !== backdropKey) {
      backdropKey = key.join()
      ctx = backdropCtx
      paintBackdrop(intro, plateIn, z0)
      ctx = screen
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(backdrop, 0, 0)
    flat()

    const zTile = z0 + TILE_T
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = pal.glow
    for (const pod of pods) drawGlow(pod, pod.node === UNSCHEDULED ? z0 : zTile)
    ctx.globalCompositeOperation = 'source-over'

    for (const pod of pods) if (pod.node === UNSCHEDULED) drawWaiting(pod, z0)
    for (const pod of [...pods].sort((a, b) => depth(a) - depth(b))) drawPod(pod, zTile)
    ctx.globalAlpha = 1
  }

  /** The mark's lower plates, the cluster plate with its name, and the nodes. */
  function paintBackdrop(
    intro: (delay: number, duration?: number) => number,
    plateIn: number,
    z0: number,
  ) {
    const spread = scrolled * 1.6
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, backdrop.width, backdrop.height)
    flat()

    // The mark's two lower plates, rising into place.
    const layers = [intro(0, 1100), intro(120, 1100)]
    pal.ghost.forEach(([from, to, edge], i) => {
      const below = 2 - i
      const z = -LAYER_GAP * below - BASE_T - spread * below - (1 - layers[i]!) * (2.5 - i * 0.5)
      const layer = i === 0 ? -14 : -9
      const corners = [
        P(0, 0, z, layer),
        P(BASE, 0, z, layer),
        P(BASE, BASE, z, layer),
        P(0, BASE, z, layer),
      ]
      ctx.globalAlpha = (i === 0 ? 0.55 : 0.85) * layers[i]!
      path(corners)
      ctx.fillStyle = gradient(z, layer, [
        [0, from],
        [1, to],
      ])
      ctx.fill()
      // Light catches the two back edges, as on the app's icon.
      path([corners[3]!, corners[0]!, corners[1]!], false)
      ctx.strokeStyle = edge
      ctx.lineWidth = 1
      ctx.stroke()
    })

    // The cluster plate, with a faint survey grid and lit back edges.
    ctx.globalAlpha = plateIn
    slab([0, 0, BASE, BASE], [z0 - BASE_T, z0], -4, [
      gradient(z0, -4, pal.baseTop),
      pal.baseLeft,
      pal.baseRight,
    ])
    ctx.globalAlpha = 0.5 * plateIn
    ctx.strokeStyle = pal.grid
    for (let i = 1; i < BASE; i++) {
      path([P(i, 0, z0, -4), P(i, BASE, z0, -4)], false)
      ctx.stroke()
      path([P(0, i, z0, -4), P(BASE, i, z0, -4)], false)
      ctx.stroke()
    }
    ctx.globalAlpha = plateIn
    path([P(0, BASE, z0, -4), P(0, 0, z0, -4), P(BASE, 0, z0, -4)], false)
    ctx.strokeStyle = pal.baseEdge
    ctx.stroke()

    // The cluster's name, printed on the plate's front-left margin.
    const labels = intro(1000)
    if (labels > 0) {
      onPlane(z0, -4)
      ctx.globalAlpha = labels
      ctx.font = '500 13px "JetBrains Mono Variable", ui-monospace, monospace'
      ctx.textBaseline = 'middle'
      const u = MARGIN * PRINT
      const v = (BASE - MARGIN / 2) * PRINT
      ctx.fillStyle = pal.clusterDot
      ctx.beginPath()
      ctx.arc(u + 4, v, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = pal.clusterName
      ctx.fillText(DEMO_CLUSTER.name, u + 16, v)
      ctx.fillStyle = pal.clusterMeta
      ctx.fillText(
        `· Kubernetes ${DEMO_CLUSTER.kubernetes} · ${DEMO_CLUSTER.nodes} nodes`,
        u + 16 + ctx.measureText(`${DEMO_CLUSTER.name} `).width,
        v,
      )
      flat()
    }

    // The nodes, back to front.
    const order = NODES.map((n, i) => ({ n, i })).sort(
      (a, b) => a.n.gx + a.n.gy - (b.n.gx + b.n.gy),
    )
    for (const { n, i } of order) {
      const appear = intro(420 + i * 90, 800)
      if (appear === 0) continue
      drawNode(n, i, z0, appear * plateIn, labels)
    }
    ctx.globalAlpha = 1
  }

  /** A node's tile; `appear` is how far it (and the plate under it) has come in. */
  function drawNode(n: NodeInfo, i: number, z0: number, appear: number, labels: number) {
    const o = tileOrigin(i)
    const lift = (1 - appear) * 0.8
    const zt = z0 + TILE_T + lift
    const hot = hoveredNode === i
    ctx.globalAlpha = appear
    const top = slab([o.x, o.y, o.x + TILE, o.y + TILE], [z0 + lift, zt], -1, [
      n.health === 'critical' ? pal.tileTopDown : hot ? pal.tileTopHot : pal.tileTop,
      pal.tileLeft,
      pal.tileRight,
    ])
    path(top)
    ctx.lineWidth = 1
    ctx.setLineDash(n.health === 'critical' ? [4, 4] : [])
    ctx.strokeStyle =
      n.health === 'critical'
        ? pal.tileEdgeDown
        : n.health === 'warning'
          ? pal.tileEdgeWarn
          : hot
            ? pal.tileEdgeHot
            : pal.tileEdge
    ctx.stroke()
    ctx.setLineDash([])
    if (labels === 0) return

    // Its name and condition along the front-left edge, its usage along the front-right.
    onPlane(zt, -1)
    ctx.globalAlpha = labels * appear
    ctx.font = '500 10.5px "JetBrains Mono Variable", ui-monospace, monospace'
    ctx.textBaseline = 'middle'
    const u = (o.x + 0.3) * PRINT
    const v = (o.y + TILE - 0.27) * PRINT
    ctx.fillStyle = pal.nodeName
    ctx.fillText(n.name, u, v)
    ctx.fillStyle =
      n.health === 'critical'
        ? pal.conditionDown
        : n.health === 'warning'
          ? pal.conditionWarn
          : pal.conditionOk
    ctx.fillText(n.condition, u + ctx.measureText(`${n.name} `).width, v)
    if (n.usage) {
      const len = (TILE - 1.1) * PRINT
      const v0 = (o.y + 0.55) * PRINT
      ;[n.usage.cpu, n.usage.mem].forEach((value, row) => {
        const bar = (o.x + TILE - 0.42 + row * 0.17) * PRINT
        ctx.fillStyle = pal.meterTrack
        ctx.fillRect(bar, v0, 2.6, len)
        ctx.fillStyle = value >= 0.85 ? pal.meterHot : pal.meterFill
        ctx.fillRect(bar, v0, 2.6, len * value)
      })
    }
    flat()
  }

  /** A pulsing glow under a failing pod, a steady one under a warning. */
  function drawGlow(pod: Pod, z: number) {
    const health = shownHealth(pod)
    const appear = podAppear(pod)
    const { x, y } = slotCenter(pod.node, pod.slot)
    const at = P(x, y, z, -1)
    if ((health === 'critical' || health === 'warning') && appear > 0) {
      const critical = health === 'critical'
      const pulse = !critical
        ? 0.45
        : reduced
          ? 0.8
          : 0.65 + 0.35 * Math.sin((clock() / 1000) * Math.PI * 1.1 + pod.id)
      const r = view.k * (critical ? 1.7 : 1.2)
      ellipse(at, r, () => {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
        g.addColorStop(0, rgba(STATUS[health], pal.glowAlpha * pulse * appear))
        g.addColorStop(1, rgba(STATUS[health], 0))
        ctx.fillStyle = g
        ctx.fill()
      })
    }
    // A ring goes off when a pod changes state (with motion).
    const ring = (clock() - pod.ring) / RING
    if (!reduced && ring >= 0 && ring <= 1) {
      ellipse(at, view.k * (0.5 + ease.outCubic(ring) * 1.3), () => {
        ctx.strokeStyle = rgba(STATUS[pod.health], (1 - ring) * 0.8)
        ctx.lineWidth = 2
        ctx.stroke()
      })
    }
  }

  /** An unscheduled pod hangs on a dashed line over the spot it wants. */
  function drawWaiting(pod: Pod, z0: number) {
    const { x, y } = slotCenter(pod.node, pod.slot)
    const r = CUBE * 0.8
    ctx.globalAlpha = podAppear(pod) * 0.7
    ctx.setLineDash([3, 4])
    ctx.strokeStyle = UNSCHEDULED_LINE
    ctx.lineWidth = 1
    path([P(x, y, z0), P(x, y, z0 + restZ(pod))], false)
    ctx.stroke()
    path([P(x - r, y - r, z0), P(x + r, y - r, z0), P(x + r, y + r, z0), P(x - r, y + r, z0)])
    ctx.stroke()
    ctx.setLineDash([])
  }

  function drawPod(pod: Pod, zTile: number) {
    const t = clock()
    const appear = podAppear(pod)
    if (appear === 0) return
    const { x, y } = slotCenter(pod.node, pod.slot)
    const hot = hovered === pod
    const lift = hot ? LIFT : 0
    pod.lift = reduced ? lift : pod.lift + (lift - pod.lift) * 0.2
    const drop = reduced ? 0 : (1 - ease.outCubic(clamp((t - pod.born) / DROP))) * 2.4
    const shrink = pod.dying ? clamp((t - pod.dying) / LEAVE) : 0
    const plateZ = zTile - TILE_T
    const z0 = plateZ + restZ(pod) + drop + pod.lift
    const h = CUBE_H * (1 - shrink * 0.9)
    const s = (CUBE / 2) * (1 - shrink * 0.4)
    const c = currentColor(pod)
    const starting = shownHealth(pod) === 'progressing'
    const glow = !starting
      ? 0
      : reduced
        ? 0.5
        : 0.5 + 0.5 * Math.sin((t / 1000) * Math.PI * 2.2 + pod.id)
    const lit = 0.08 + glow * 0.18 + (hot ? 0.14 : 0)
    const onDownNode = pod.node !== UNSCHEDULED && NODES[pod.node]!.health === 'critical'
    ctx.globalAlpha = appear * (onDownNode ? 0.55 : 1)

    // A contact shadow, softer the higher the pod is, once it has landed.
    if (drop < 0.05) {
      const ground = pod.node === UNSCHEDULED ? plateZ : zTile
      const air = z0 - ground
      ellipse(P(x + 0.06, y + 0.06, ground), view.k * (0.52 + air * 0.12), () => {
        ctx.fillStyle = rgba(pal.shadow, pal.shadowAlpha / (1 + air * 0.8))
        ctx.fill()
      })
    }

    const top: Point[] = [
      P(x - s, y - s, z0 + h),
      P(x + s, y - s, z0 + h),
      P(x + s, y + s, z0 + h),
      P(x - s, y + s, z0 + h),
    ]
    const bl = P(x - s, y + s, z0)
    const bf = P(x + s, y + s, z0)
    const br = P(x + s, y - s, z0)
    path([top[3]!, top[2]!, bf, bl])
    ctx.fillStyle = shade(mix(c, [255, 255, 255], lit * 0.5), 0.74)
    ctx.fill()
    path([top[2]!, top[1]!, br, bf])
    ctx.fillStyle = shade(mix(c, [255, 255, 255], lit * 0.4), 0.52)
    ctx.fill()
    path(top)
    const g = ctx.createLinearGradient(...top[0]!, ...top[2]!)
    g.addColorStop(0, lighten(c, 0.3 + lit))
    g.addColorStop(1, lighten(c, 0.06 + lit))
    ctx.fillStyle = g
    ctx.fill()
    // Light on the top's back edges; an outline under the pointer.
    path([top[3]!, top[0]!, top[1]!], false)
    ctx.strokeStyle = `rgba(255,255,255,${hot ? 0.75 : 0.35})`
    ctx.lineWidth = 1
    ctx.stroke()
    if (hot) {
      path([top[0]!, top[1]!, top[2]!, bf, bl, top[3]!])
      ctx.strokeStyle = pal.hotOutline
      ctx.stroke()
    }
  }

  // Pointing ------------------------------------------------------------------------

  function podOutline(pod: Pod): Point[] {
    const { x, y } = slotCenter(pod.node, pod.slot)
    const s = CUBE / 2
    const z = restZ(pod) + pod.lift
    return [
      P(x - s, y - s, z + CUBE_H),
      P(x + s, y - s, z + CUBE_H),
      P(x + s, y - s, z),
      P(x + s, y + s, z),
      P(x - s, y + s, z),
      P(x - s, y + s, z + CUBE_H),
    ]
  }

  /** The pod (front first) or else the node under a point. */
  function hitTest(at: Point): { pod: Pod | null; node: number | null } {
    const front = pods
      .filter((p) => !p.dying && podAppear(p) > 0.9)
      .sort((a, b) => depth(b) - depth(a))
    const pod = front.find((p) => inside(at, podOutline(p)))
    if (pod) return { pod, node: null }
    const node = NODES.findIndex((_, i) => {
      const o = tileOrigin(i)
      return inside(at, [
        P(o.x, o.y, TILE_T, -1),
        P(o.x + TILE, o.y, TILE_T, -1),
        P(o.x + TILE, o.y + TILE, TILE_T, -1),
        P(o.x, o.y + TILE, TILE_T, -1),
      ])
    })
    return { pod: null, node: node < 0 ? null : node }
  }

  // The tooltip, in the app's popover style. It's placed every frame while something is
  // under the pointer, but its markup only changes when what it says does.
  let tipHtml = ''
  let tipWidth = 0
  let tipAt = ''

  function showTip() {
    if (hovered) {
      const pod = hovered
      const health = shownHealth(pod)
      const where = pod.node === UNSCHEDULED ? 'not scheduled' : `on ${NODES[pod.node]!.name}`
      const restarts = pod.restarts
        ? `<span class="tip-dim">${pod.restarts} restart${pod.restarts === 1 ? '' : 's'}</span>`
        : ''
      setTip(`
        <div class="tip-meta">Pod · ${escapeHtml(pod.ns)} · ${where}</div>
        <div class="tip-name">${escapeHtml(pod.name)}</div>
        <div class="tip-row">${pill(health, health === pod.health ? pod.label : 'ContainerCreating')}${restarts}</div>
        ${pod.node === UNSCHEDULED ? `<div class="tip-dim">${UNSCHEDULABLE_REASON}</div>` : ''}
        ${health === 'critical' ? `<div class="tip-action">${icon('rotate-cw')}Click to restart</div>` : ''}`)
      const o = podOutline(pod)
      placeTip(o[0]![0] + (o[1]![0] - o[0]![0]) / 2, Math.min(o[0]![1], o[1]![1], o[5]![1]))
    } else if (hoveredNode !== null) {
      const n = NODES[hoveredNode]!
      const here = pods.filter((p) => p.node === hoveredNode && !p.dying).length
      const meter = (label: string, v: number) =>
        `<div class="tip-meter"><span>${label}</span><span class="tip-track"><i style="width:${Math.round(v * 100)}%" data-hot="${v >= 0.85}"></i></span><span>${Math.round(v * 100)}%</span></div>`
      setTip(`
        <div class="tip-meta">Node · ${here} pods</div>
        <div class="tip-name">${n.name}</div>
        <div class="tip-row">${pill(n.health, n.condition)}</div>
        ${n.usage ? meter('CPU', n.usage.cpu) + meter('Mem', n.usage.mem) : '<div class="tip-dim">The kubelet stopped posting status.</div>'}`)
      const o = tileOrigin(hoveredNode)
      const [x, y] = P(o.x + TILE / 2, o.y, TILE_T, -1)
      placeTip(x, y + view.k * 0.6)
    } else {
      tip.hidden = true
    }
  }

  function setTip(html: string) {
    tip.hidden = false
    if (html === tipHtml) return
    tipHtml = html
    tip.innerHTML = html
    // Measured once it shows, so its real width keeps it inside the stage.
    tipWidth = tip.offsetWidth
  }

  function placeTip(x: number, y: number) {
    const left = clamp(x - tipWidth / 2, 8, Math.max(8, W - tipWidth - 8))
    const at = `translate(${Math.round(left)}px, ${Math.round(y - 12)}px) translateY(-100%)`
    if (at === tipAt) return
    tipAt = at
    tip.style.transform = at
  }

  // The Pod health card ---------------------------------------------------------------

  let shownCounts = ''
  let restarting = 0

  function updateLegend() {
    const c = new Map(HEALTHS.map((h) => [h, 0]))
    for (const p of pods)
      if (!p.dying && clock() >= p.born) c.set(shownHealth(p), c.get(shownHealth(p))! + 1)
    const key = [...c.values()].join(',')
    if (key === shownCounts) return
    shownCounts = key
    for (const [h, n] of c) counts.get(h)!.textContent = String(n)
    // The bar's segments take their new widths at once, and glide there from the old ones on
    // the compositor (a transition of their widths would lay the card out every frame).
    const before = [...segments].map((s) => s.getBoundingClientRect())
    segments.forEach((s) => {
      const n = c.get(s.dataset.seg as Health)!
      s.style.flexGrow = String(n)
      s.dataset.empty = String(n === 0)
    })
    if (!reduced)
      segments.forEach((s, i) => {
        const after = s.getBoundingClientRect()
        if (after.width === 0) return
        const from = `translateX(${before[i]!.left - after.left}px) scaleX(${before[i]!.width / after.width})`
        s.animate([{ transform: from }, { transform: 'none' }], {
          duration: 500,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        })
      })
    if (!restarting)
      note.dataset.state = c.get('critical') === 0 && clock() > SETTLE + 1500 ? 'clear' : 'hint'
  }

  /** As in the app: the pod is deleted and its owner makes a new one. */
  function restart(pod: Pod) {
    restarting++
    note.dataset.state = 'command'
    noteCommand.textContent = `kubectl delete pod ${pod.name} -n ${pod.ns}`
    setHealth(pod, 'progressing', 'ContainerCreating')
    later(1500, () => {
      pod.restarts++
      if (pod.crashLoops > 0) {
        pod.crashLoops--
        setHealth(pod, 'critical', 'CrashLoopBackOff')
      } else {
        setHealth(pod, 'healthy', 'Running')
      }
      // The command stays up a moment longer, then the card counts again.
      later(2600, () => {
        restarting--
        if (restarting) return
        shownCounts = ''
        updateLegend()
      })
    })
  }

  // Life in the cluster ---------------------------------------------------------------

  function retire(pod: Pod, after: number, then?: () => void) {
    later(after, () => {
      pod.dying = clock()
      wake()
      later(400, () => {
        removePod(pod)
        then?.()
      })
    })
  }

  /** A rolling update of storefront: its pods are replaced one at a time. */
  function rollout() {
    const hash = randomSuffix() + randomSuffix().slice(0, 4)
    pods
      .filter((p) => p.name.startsWith('storefront-') && !p.dying)
      .forEach((old, i) =>
        retire(old, i * 1700, () => {
          const pod = addPod(
            {
              name: `storefront-${hash}-${randomSuffix()}`,
              ns: 'shop',
              node: old.node,
              health: 'progressing',
              label: 'ContainerCreating',
            },
            clock() + 60,
            old.slot,
          )
          pod.ring = clock() + 200
          later(1300, () => setHealth(pod, 'healthy', 'Running'))
        }),
      )
  }

  /** The `hello` CronJob runs: a pod starts and completes, and the run before it goes. */
  function cronRun() {
    const stamp = 29309756 + Math.floor(clock() / 60000)
    const node = Math.random() < 0.5 ? 1 : 2
    const pod = addPod(
      {
        name: `hello-${stamp}-${randomSuffix()}`,
        ns: 'default',
        node,
        health: 'progressing',
        label: 'ContainerCreating',
      },
      clock(),
    )
    pod.ring = clock() + 300
    later(1200, () => setHealth(pod, 'healthy', 'Running'))
    later(3600, () => {
      setHealth(pod, 'neutral', 'Completed')
      pods
        .filter(
          (p) => p !== pod && p.name.startsWith('hello-') && p.health === 'neutral' && !p.dying,
        )
        .forEach((previous) => retire(previous, 900))
    })
  }

  /** Memory runs short on worker-2 now and then, while fewer than five pods are failing. */
  function oomKill() {
    if (pods.filter((p) => p.health === 'critical').length >= 5) return
    const candidates = pods.filter(
      (p) =>
        p.node === MEMORY_PRESSURE_NODE &&
        p.health === 'healthy' &&
        !p.dying &&
        p.ns !== 'kube-system',
    )
    const pod = candidates[Math.floor(Math.random() * candidates.length)]!
    pod.restarts++
    setHealth(pod, 'critical', 'OOMKilled')
  }

  function live() {
    const events = [rollout, cronRun, oomKill, cronRun]
    let tick = 0
    const next = () => {
      // Nothing happens while nobody can see it.
      if (showing()) events[tick++ % events.length]!()
      later(tick % 4 === 1 ? 7600 : 4200 + Math.random() * 1600, next)
    }
    later(SETTLE + 3600, next)
  }

  // Running -------------------------------------------------------------------------

  /** Frames a second while pods arrive, change or leave, and while only glows pulse. */
  const LIVELY_FPS = 30
  const CALM_FPS = 20

  const showing = () => ready && visible && !document.hidden

  /** How long until the next frame is needed: 0 for the very next one. */
  function pace() {
    const t = clock()
    const following =
      Math.abs(pointer.x - pointer.sx) + Math.abs(pointer.y - pointer.sy) > 0.001 ||
      pods.some((pod) => Math.abs(pod.lift - (hovered === pod ? LIFT : 0)) > 0.002)
    if (t < INTRO || following) return 0
    const lively = pods.some(
      (pod) =>
        pod.dying > 0 ||
        t - pod.born < DROP ||
        (t >= pod.colorAt && t - pod.colorAt < FADE) ||
        t - pod.ring <= RING,
    )
    return 1000 / (lively ? LIVELY_FPS : CALM_FPS)
  }

  /** Draws a frame when the screen next updates, unless one is already coming. */
  function wake() {
    if (frame || !showing()) return
    window.clearTimeout(wait)
    frame = requestAnimationFrame(loop)
  }

  function loop(ts: number) {
    frame = 0
    now = ts
    pointer.sx += (pointer.x - pointer.sx) * 0.06
    pointer.sy += (pointer.y - pointer.sy) * 0.06
    draw()
    updateLegend()
    if (hovered || hoveredNode !== null) showTip()
    // With reduced motion, the next frame comes with the next change.
    if (reduced) return
    const next = pace()
    // A frame waits for the screen too (up to one refresh): ask for it a little early.
    if (next === 0) wake()
    else wait = window.setTimeout(wake, next - 8)
  }

  function pointAt(e: MouseEvent): Point {
    const r = canvas.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  canvas.addEventListener('pointermove', (e) => {
    const [px, py] = pointAt(e)
    // The plates follow the pointer a little, with motion.
    if (!reduced) {
      pointer.x = clamp(px / W)
      pointer.y = clamp(py / H)
      wake()
    }
    // A finger has no hover: a tap shows what's there (see the click handler).
    if (e.pointerType === 'touch') return
    const hit = hitTest([px, py])
    if (hit.pod !== hovered || hit.node !== hoveredNode) wake()
    hovered = hit.pod
    hoveredNode = hit.node
    canvas.style.cursor = hit.pod?.health === 'critical' ? 'pointer' : 'default'
    showTip()
  })

  canvas.addEventListener('pointerleave', (e) => {
    pointer.x = 0.5
    pointer.y = 0.5
    wake()
    // A finger leaves after every tap; what it tapped stays shown until the next one.
    if (e.pointerType === 'touch') return
    hovered = null
    hoveredNode = null
    tip.hidden = true
  })

  // Whether the click that follows came from a finger: clicks don't reliably say (WebKit's
  // after a tap don't), but the pointerdown before them does.
  let touch = false
  canvas.addEventListener('pointerdown', (e) => (touch = e.pointerType === 'touch'))

  canvas.addEventListener('click', (e) => {
    const hit = hitTest(pointAt(e))
    // With a mouse, a click restarts a failing pod; with a finger, the first tap shows what
    // the pod is and a second tap restarts it.
    const again = hovered === hit.pod
    hovered = hit.pod
    hoveredNode = hit.pod ? null : hit.node
    if (hit.pod?.health === 'critical' && (!touch || again)) restart(hit.pod)
    showTip()
    wake()
  })

  // The lower plates spread apart as the hero scrolls away (and only matter while it shows).
  const onScroll = () => {
    if (!visible) return
    const r = root.getBoundingClientRect()
    scrolled = clamp(-r.top / r.height)
    wake()
  }
  window.addEventListener('scroll', onScroll, { passive: true })

  // Follow the theme switch, and repaint at once so a view transition captures new colors.
  new MutationObserver(() => {
    pal = currentPalette()
    backdropKey = ''
    draw()
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  new ResizeObserver(resize).observe(canvas)
  resize()

  // Frames run while the canvas is on screen, once the cluster has started.
  new IntersectionObserver(([entry]) => {
    visible = entry!.isIntersecting
    onScroll()
  }).observe(canvas)
  document.addEventListener('visibilitychange', wake)

  // Start once the fonts for the printed labels are ready, so nothing reflows mid-intro.
  void Promise.race([document.fonts.ready, new Promise((r) => later(600, () => r(null)))]).then(
    () => {
      start = performance.now()
      now = start
      ready = true
      wake()
      if (!reduced) live()
    },
  )
}

document.querySelectorAll<HTMLElement>('[data-cluster]').forEach(mountCluster)
