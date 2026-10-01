/**
 * The cluster's world, in plate units: x runs to the right and down the screen, y to the
 * left and down, z up. A node is a 4×4 grid of pod slots on a tile; the four tiles sit on
 * the cluster plate, with the mark's two lower plates under it.
 */
import { NODES, UNSCHEDULED } from './data'

export const PAD = 0.5
export const TILE = 4 + PAD * 2
export const GAP = 0.9
export const MARGIN = 1
export const BASE = MARGIN * 2 + TILE * 2 + GAP
export const CUBE = 0.56
export const CUBE_H = 0.56
export const BASE_T = 0.32
export const TILE_T = 0.14
export const LAYER_GAP = 1.15
/** How high an unscheduled pod hangs over the plate. */
export const FLOAT = 2.9
/** Text and bars printed on a plate are drawn in 1/32 plate units. */
export const PRINT = 32

export type Point = [number, number]

/** Where the plate sits on a canvas: its scale (pixels per unit) and its center. */
export interface View {
  k: number
  cx: number
  cy: number
}

/** The plate's scale and position on a canvas of W × H CSS pixels. */
export function fit(W: number, H: number): View {
  // The plate is 2·BASE wide and about BASE plus its layers tall, in units of k.
  const k = Math.min(W / (BASE * 2 + 2), H / (BASE + LAYER_GAP * 2 + BASE_T + 3), 40)
  return {
    k,
    // On wide screens the stage runs to the window's edge; the plate stays near the copy.
    cx: Math.min(W / 2, (BASE + 1.4) * k),
    // The plate and the layers under it, centered as one shape.
    cy: H / 2 - k * (LAYER_GAP + 0.2),
  }
}

/** A point in the world, in canvas pixels. */
export const project = ({ k, cx, cy }: View, x: number, y: number, z: number): Point => [
  cx + (x - y) * k,
  cy + ((x + y - BASE) * k) / 2 - z * k,
]

export function tileOrigin(node: number) {
  const n = NODES[node]!
  return { x: MARGIN + n.gx * (TILE + GAP), y: MARGIN + n.gy * (TILE + GAP) }
}

/** The middle of a pod's slot; an unscheduled pod waits over the middle of the plate. */
export function slotCenter(node: number, slot: number) {
  if (node === UNSCHEDULED) return { x: BASE / 2, y: BASE / 2 }
  const o = tileOrigin(node)
  return { x: o.x + PAD + 0.5 + (slot % 4), y: o.y + PAD + 0.5 + Math.floor(slot / 4) }
}

/** Ray casting: is the point inside the polygon? */
export function inside([px, py]: Point, polygon: Point[]) {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!
    const [xj, yj] = polygon[j]!
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))

export const ease = {
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  outExpo: (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  inOut: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
}
