/**
 * The tests' page, with three things set up before the site's scripts run:
 *
 * - Math.random is seeded, so the cluster's life, the logs and the palette's typing play
 *   out the same way on every run.
 * - GitHub's API answers with the release the site was built with (see support/releases.ts
 *   for other answers): tests never reach the real one.
 * - Coverage: when the test is done (and before any reload, with `save`), the page's
 *   counters are written to .nyc_output/ for the coverage report and the 100% gate.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { test as base, expect, type Page } from '@playwright/test'
import { BUILT, github } from '../support/releases'

export const ONLINE = 'http://localhost:4400'
export const OFFLINE = 'http://localhost:4401'

/** Mulberry32: small, fast and good enough for repeatable demos. */
const seedRandom = (seed: number) => {
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Writes the page's coverage so far; call it before a reload or navigation loses it. */
export async function save(page: Page) {
  const data = await page.evaluate(() => (window as { __coverage__?: object }).__coverage__)
  if (!data) return
  mkdirSync('.nyc_output', { recursive: true })
  writeFileSync(`.nyc_output/browser-${randomUUID()}.json`, JSON.stringify(data))
}

/** Prepares a page as the `page` fixture does: for tests that make their own contexts. */
export async function prepare(page: Page, seed = 1) {
  await page.addInitScript(seedRandom, seed)
  await github(page, BUILT)
}

/**
 * Waits until the page's scripts know whether `selector` is on screen. They hear it from an
 * IntersectionObserver at the browser's next rendering update, and the browser answers
 * observers in the order they were made: when a new one hears back, theirs have too.
 */
export async function observed(page: Page, selector: string) {
  await page.evaluate(
    (selector) =>
      new Promise<void>((resolve) => {
        const observer = new IntersectionObserver(() => {
          observer.disconnect()
          resolve()
        })
        observer.observe(document.querySelector(selector)!)
      }),
    selector,
  )
}

/**
 * Moves the paused clock on in 100ms jumps, each firing what's due and about one frame,
 * rather than a frame every 16ms: for long stretches where what happens matters, not each
 * frame. (Drawing every frame of a minute takes long where browsers draw in software.)
 */
export async function skip(page: Page, ms: number) {
  for (let t = 0; t < ms; t += 100) await page.clock.fastForward(100)
}

/**
 * Opens the page on a paused fake clock, so only the test moves time (with
 * `page.clock.runFor`), once the hero's cluster is ready to start: its fonts are in, and it
 * knows it's on screen.
 */
export async function openPaused(page: Page, url = '/') {
  await page.clock.install({ time: 0 })
  await page.clock.pauseAt(1000)
  await page.goto(url)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await observed(page, '[data-cluster]')
}

export const test = base.extend<{ seed: number }>({
  seed: [1, { option: true }],
  page: async ({ page, seed }, use) => {
    await prepare(page, seed)
    await use(page)
    if (!page.isClosed()) await save(page)
  },
})

export { expect }
