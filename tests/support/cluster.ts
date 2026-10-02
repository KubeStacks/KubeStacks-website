/**
 * Where the hero draws the demo cluster's pods and nodes, in page coordinates, worked out
 * with the renderer's own geometry (src/scripts/cluster/geometry.ts).
 */
import type { Page } from '@playwright/test'
import { PODS, SLOT_ORDER, UNSCHEDULED } from '../../src/scripts/cluster/data'
import {
  CUBE_H,
  FLOAT,
  TILE,
  TILE_T,
  fit,
  project,
  slotCenter,
  tileOrigin,
} from '../../src/scripts/cluster/geometry'

async function canvasView(page: Page) {
  const box = (await page.locator('[data-cluster] canvas').boundingBox())!
  return { box, view: fit(box.width, box.height) }
}

/** The middle of a pod's cube, at rest. */
export async function podAt(page: Page, name: string) {
  const { box, view } = await canvasView(page)
  const index = PODS.findIndex((p) => p.name === name)
  const pod = PODS[index]!
  const slot = SLOT_ORDER[PODS.slice(0, index).filter((p) => p.node === pod.node).length]!
  const { x, y } = slotCenter(pod.node, slot)
  const rest = pod.node === UNSCHEDULED ? FLOAT : TILE_T
  const [px, py] = project(view, x, y, rest + CUBE_H / 2)
  return { x: box.x + px, y: box.y + py }
}

/** A spot on a node's tile with no pod on it: the tile's front corner. */
export async function nodeAt(page: Page, node: number) {
  const { box, view } = await canvasView(page)
  const o = tileOrigin(node)
  const [px, py] = project(view, o.x + TILE - 0.25, o.y + TILE - 0.25, TILE_T)
  return { x: box.x + px, y: box.y + py }
}

/** A spot on the canvas off the plate. */
export async function offPlate(page: Page) {
  const { box } = await canvasView(page)
  return { x: box.x + 6, y: box.y + 6 }
}
