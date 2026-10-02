/**
 * The page's appetite: the hero draws only as often as it must, and nothing runs where nobody
 * can see it, off screen or in a hidden tab.
 */
import { test, expect, observed, openPaused, prepare, save, ONLINE } from './fixtures'
import { podAt } from '../support/cluster'
import type { Page } from '@playwright/test'

/** Counts the hero's frames: each copies its backdrop onto the screen once. */
async function countFrames(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { heroFrames: number }
    w.heroFrames = 0
    const drawImage = CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: unknown[]
    ) {
      if (this.canvas.closest('[data-cluster]')) w.heroFrames++
      return (drawImage as (...a: unknown[]) => void).apply(this, args)
    } as typeof drawImage
  })
}

/** The hero's frames over `ms` of the page's time. */
async function framesOver(page: Page, ms: number) {
  const count = () => page.evaluate(() => (window as unknown as { heroFrames: number }).heroFrames)
  const before = await count()
  await page.clock.runFor(ms)
  return (await count()) - before
}

/** Hides or shows the tab, as switching tabs does (headless browsers never hide it). */
async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}

const legend = (page: Page) =>
  page
    .locator('[data-cluster] [data-count]')
    .evaluateAll((els) => els.map((e) => e.textContent).join())

test.describe('the hero', () => {
  test('draws every frame while it comes in, then only as often as it must', async ({
    page,
    isMobile,
  }) => {
    await countFrames(page)
    await openPaused(page)
    // Coming in: every frame (one each 16ms).
    await page.clock.runFor(500)
    expect(await framesOver(page, 500)).toBeGreaterThanOrEqual(28)
    // Settled, with only glows pulsing and a pod floating: about 20 a second.
    await page.clock.runFor(3000)
    const calm = await framesOver(page, 1000)
    expect(calm).toBeGreaterThanOrEqual(15)
    expect(calm).toBeLessThanOrEqual(22)
    // A rollout (from 5.7s in): about 30 a second while pods come and go.
    await page.clock.runFor(700)
    const lively = await framesOver(page, 1000)
    expect(lively).toBeGreaterThan(calm)
    expect(lively).toBeLessThanOrEqual(34)
    if (isMobile) return

    // Following the pointer: every frame again.
    const box = (await page.locator('[data-cluster] canvas').boundingBox())!
    await page.mouse.move(box.x + 20, box.y + 20)
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2, { steps: 4 })
    expect(await framesOver(page, 320)).toBeGreaterThanOrEqual(18)
  })

  test('draws nothing off screen or in a hidden tab, and its cluster waits', async ({ page }) => {
    await countFrames(page)
    await openPaused(page)
    await page.clock.runFor(6000)

    await page.locator('footer').scrollIntoViewIfNeeded()
    await observed(page, '[data-cluster]')
    await page.clock.runFor(100)
    expect(await framesOver(page, 5000)).toBe(0)

    await page.locator('[data-cluster] canvas').scrollIntoViewIfNeeded()
    await observed(page, '[data-cluster]')
    expect(await framesOver(page, 1000)).toBeGreaterThan(10)

    await setHidden(page, true)
    await page.clock.runFor(100)
    const counts = await legend(page)
    expect(await framesOver(page, 30_000)).toBe(0)
    expect(await legend(page)).toBe(counts)

    await setHidden(page, false)
    expect(await framesOver(page, 1000)).toBeGreaterThan(10)
  })

  test('with reduced motion, draws only when something changes', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', baseURL: ONLINE })
    const page = await context.newPage()
    await prepare(page)
    await countFrames(page)
    await openPaused(page)
    await page.clock.runFor(1000)
    expect(await framesOver(page, 5000)).toBe(0)

    // Pointing at a failing pod draws it raised; moving on it draws nothing more. (On a phone,
    // the pod is below the fold until the cluster is scrolled to.)
    await page.locator('[data-cluster] canvas').scrollIntoViewIfNeeded()
    const pod = await podAt(page, 'db-migrate-2r5n5')
    await page.mouse.move(pod.x, pod.y)
    expect(await framesOver(page, 500)).toBeGreaterThan(0)
    await page.mouse.move(pod.x + 1, pod.y)
    expect(await framesOver(page, 2000)).toBe(0)

    // Restarting it changes it twice: starting, then running.
    await page.mouse.click(pod.x + 1, pod.y)
    await expect(page.locator('[data-tip]')).toContainText('ContainerCreating')
    expect(await framesOver(page, 1000)).toBeGreaterThan(0)
    expect(await framesOver(page, 400)).toBe(0)
    await page.clock.runFor(200)
    await expect(page.locator('[data-tip]')).toContainText('Running')
    await save(page)
    await context.close()
  })
})

test.describe('the feature demos', () => {
  /** Moves the clock on, a little at a time, until `done` holds. */
  async function runUntil(page: Page, done: () => Promise<boolean>) {
    for (let t = 0; t <= 20_000; t += 50) {
      if (await done()) return
      await page.clock.runFor(50)
    }
    throw new Error('Timed out waiting on the clock')
  }

  test('the palette types only while it’s on screen', async ({ page }) => {
    await openPaused(page)
    const input = page.locator('[data-command] input')
    await page.locator('[data-command]').scrollIntoViewIfNeeded()
    await observed(page, '[data-command]')
    await runUntil(page, async () => (await input.inputValue()) === 'chec')

    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
    await observed(page, '[data-command]')
    await page.clock.runFor(10_000)
    await expect(input).toHaveValue('chec')

    // Back on screen, it types the next search.
    await page.locator('[data-command]').scrollIntoViewIfNeeded()
    await observed(page, '[data-command]')
    await runUntil(page, async () => (await input.inputValue()) === 'worker')
  })

  test('nothing runs in a hidden tab', async ({ page }) => {
    await openPaused(page)
    const input = page.locator('[data-command] input')
    const lastLine = page.locator('[data-logs] li').last()
    await page.locator('[data-logs]').scrollIntoViewIfNeeded()
    await observed(page, '[data-logs]')
    await page.clock.runFor(3000)

    await setHidden(page, true)
    const line = await lastLine.textContent()
    const typed = await input.inputValue()
    await page.clock.runFor(20_000)
    await expect(lastLine).toHaveText(line!)
    await expect(input).toHaveValue(typed)

    await setHidden(page, false)
    await page.clock.runFor(2000)
    await expect(lastLine).not.toHaveText(line!)
  })
})
