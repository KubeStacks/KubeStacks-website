import { test, expect, openPaused, prepare, save, skip, ONLINE } from './fixtures'
import { nodeAt, offPlate, podAt } from '../support/cluster'
import type { Page } from '@playwright/test'

const legend = (page: Page, health: string) =>
  page.locator(`[data-cluster] [data-count="${health}"]`)
const tip = (page: Page) => page.locator('[data-tip]')
const note = (page: Page) => page.locator('[data-note]')

/** Opens the page and lets the cluster boot and settle, before its life starts (5.7s in). */
async function boot(page: Page, settle = 5000) {
  await openPaused(page)
  await page.clock.runFor(settle)
}

test.describe('the hero cluster', () => {
  test('boots, settles into the demo cluster, and counts it like the app', async ({ page }) => {
    await openPaused(page)
    // At first everything is starting.
    await page.clock.runFor(1600)
    await expect(legend(page, 'progressing')).not.toHaveText('0')
    await page.clock.runFor(3400)
    await expect(legend(page, 'healthy')).toHaveText('28')
    await expect(legend(page, 'warning')).toHaveText('3')
    await expect(legend(page, 'critical')).toHaveText('5')
    await expect(legend(page, 'neutral')).toHaveText('2')
    await expect(legend(page, 'progressing')).toHaveText('0')
    await expect(note(page)).toHaveAttribute('data-state', 'hint')
  })

  test('says what a pod or node is under the pointer', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hover is for pointers; taps are covered below')
    await boot(page)

    const pod = await podAt(page, 'checkout-jzhdh6j29h-hqnnn')
    await page.mouse.move(pod.x, pod.y)
    await page.clock.runFor(100)
    await expect(tip(page)).toBeVisible()
    await expect(tip(page)).toContainText('checkout-jzhdh6j29h-hqnnn')
    await expect(tip(page)).toContainText('Pod · shop · on worker-2')
    await expect(tip(page)).toContainText('CrashLoopBackOff')
    await expect(tip(page)).toContainText('14 restarts')
    await expect(tip(page)).toContainText('Click to restart')
    await expect(page.locator('[data-cluster] canvas')).toHaveCSS('cursor', 'pointer')

    const healthy = await podAt(page, 'cart-t7b6nffcc9-xtqff')
    await page.mouse.move(healthy.x, healthy.y)
    await page.clock.runFor(100)
    await expect(tip(page)).toContainText('Running')
    await expect(tip(page)).not.toContainText('restart')
    await expect(page.locator('[data-cluster] canvas')).toHaveCSS('cursor', 'default')

    const waiting = await podAt(page, 'redis-1')
    await page.mouse.move(waiting.x, waiting.y)
    await page.clock.runFor(100)
    await expect(tip(page)).toContainText('Pod · data · not scheduled')
    await expect(tip(page)).toContainText('0/4 nodes are available')

    const worker = await nodeAt(page, 1)
    await page.mouse.move(worker.x, worker.y)
    await page.clock.runFor(100)
    await expect(tip(page)).toContainText('Node · 12 pods')
    await expect(tip(page)).toContainText('worker-1')
    await expect(tip(page)).toContainText('CPU')
    await expect(tip(page).locator('.tip-track i[data-hot="true"]')).toHaveCount(1)

    const down = await nodeAt(page, 3)
    await page.mouse.move(down.x, down.y)
    await page.clock.runFor(100)
    await expect(tip(page)).toContainText('NotReady')
    await expect(tip(page)).toContainText('The kubelet stopped posting status.')

    const outside = await offPlate(page)
    await page.mouse.move(outside.x, outside.y)
    await page.clock.runFor(100)
    await expect(tip(page)).toBeHidden()

    await page.mouse.move(worker.x, worker.y)
    await page.clock.runFor(100)
    await expect(tip(page)).toBeVisible()
    await page.mouse.move(1, 1)
    await expect(tip(page)).toBeHidden()
  })

  test('shows pods as starting while the cluster comes up', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hover is for pointers')
    await openPaused(page)
    await page.clock.runFor(2100)
    const pod = await podAt(page, 'db-migrate-2r5n5')
    await page.mouse.move(pod.x, pod.y)
    await page.clock.runFor(50)
    await expect(tip(page)).toContainText('ContainerCreating')
    await expect(tip(page)).not.toContainText('Click to restart')
  })

  test('restarts a failing pod, showing its kubectl command', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a click is a mouse thing; taps are covered below')
    await boot(page)
    const pod = await podAt(page, 'db-migrate-2r5n5')
    await page.mouse.click(pod.x, pod.y)
    await expect(note(page)).toHaveAttribute('data-state', 'command')
    await expect(note(page)).toContainText('kubectl delete pod db-migrate-2r5n5 -n batch')
    await page.clock.runFor(100)
    await expect(tip(page)).toContainText('ContainerCreating')
    await expect(legend(page, 'critical')).toHaveText('4')
    // A second click while it restarts does nothing more.
    await page.mouse.click(pod.x, pod.y)
    await page.clock.runFor(1500)
    await expect(tip(page)).toContainText('Running')
    await expect(tip(page)).toContainText('1 restart')
    await expect(legend(page, 'critical')).toHaveText('4')
    // The command stays up a moment, then the card is back to its hint.
    await expect(note(page)).toHaveAttribute('data-state', 'command')
    await page.clock.runFor(2700)
    await expect(note(page)).toHaveAttribute('data-state', 'hint')
  })

  test('a crash-looping pod crashes again once, then comes up', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a click is a mouse thing')
    await boot(page)
    const pod = await podAt(page, 'checkout-jzhdh6j29h-pwkd2')
    await page.mouse.click(pod.x, pod.y)
    await page.clock.runFor(1600)
    await expect(tip(page)).toContainText('CrashLoopBackOff')
    await expect(tip(page)).toContainText('14 restarts')
    await page.mouse.click(pod.x, pod.y)
    await page.clock.runFor(1600)
    await expect(tip(page)).toContainText('Running')
    await expect(tip(page)).toContainText('15 restarts')
  })

  test('once every failing pod is fixed, memory runs short again', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a click is a mouse thing')
    await boot(page)
    const failing = [
      'db-migrate-2r5n5',
      'db-migrate-d6rml',
      'recommendations-mcbt654b8h-bpp5n',
      'checkout-jzhdh6j29h-hqnnn',
      'checkout-jzhdh6j29h-pwkd2',
    ]
    // Overlapping restarts: the command stays until the last one is done.
    for (const name of failing) {
      const at = await podAt(page, name)
      await page.mouse.click(at.x, at.y)
      await page.clock.runFor(300)
    }
    await page.clock.runFor(1800)
    for (const name of failing.slice(3)) {
      const at = await podAt(page, name)
      await page.mouse.click(at.x, at.y)
    }
    await page.clock.runFor(1800)
    await expect(legend(page, 'critical')).toHaveText('0')
    await expect(note(page)).toHaveAttribute('data-state', 'command')
    await page.clock.runFor(2800)
    await expect(note(page)).toHaveAttribute('data-state', 'clear')
    await expect(note(page)).toContainText('Everything’s running')
    // The cluster goes on living: worker-2 runs out of memory sooner or later.
    await skip(page, 30_000)
    await expect(legend(page, 'critical')).not.toHaveText('0')
  })

  test('lives on its own: rollouts and CronJob runs, while on screen', async ({ page }) => {
    await boot(page)
    const total = async () => {
      let sum = 0
      for (const h of ['healthy', 'progressing', 'warning', 'critical', 'neutral']) {
        sum += Number(await legend(page, h).textContent())
      }
      return sum
    }
    await skip(page, 40_000)
    // Pods come and go, but the cluster keeps its shape: 38 pods, two finished jobs.
    expect(await total()).toBeGreaterThanOrEqual(37)
    expect(await total()).toBeLessThanOrEqual(39)

    // Off screen, nothing happens, and frames stop until it's back.
    await page.locator('#features').scrollIntoViewIfNeeded()
    const before = await legend(page, 'healthy').textContent()
    await page.clock.runFor(20_000)
    await page.evaluate(() => scrollTo(0, 0))
    await page.locator('#features').scrollIntoViewIfNeeded()
    await page.evaluate(() => scrollTo(0, 0))
    await page.clock.runFor(1000)
    await expect(legend(page, 'healthy')).toHaveText(before!)
  })

  test('on a phone, a tap shows a pod and a second tap restarts it', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch')
    await boot(page)
    await page.locator('[data-cluster] canvas').scrollIntoViewIfNeeded()
    const at = await podAt(page, 'recommendations-mcbt654b8h-bpp5n')
    // A finger moving over the canvas doesn't hover.
    await page.locator('[data-cluster] canvas').dispatchEvent('pointermove', {
      pointerType: 'touch',
      clientX: at.x,
      clientY: at.y,
    })
    await expect(tip(page)).toBeHidden()
    await page.touchscreen.tap(at.x, at.y)
    await page.clock.runFor(100)
    await expect(tip(page)).toContainText('ImagePullBackOff')
    await expect(note(page)).toHaveAttribute('data-state', 'hint')
    await page.touchscreen.tap(at.x, at.y)
    await expect(note(page)).toHaveAttribute('data-state', 'command')
    await page.clock.runFor(1600)
    await expect(tip(page)).toContainText('Running')
    // A tap elsewhere puts it away.
    const outside = await offPlate(page)
    await page.touchscreen.tap(outside.x, outside.y)
    await expect(tip(page)).toBeHidden()
  })

  test('the health card moves into the flow on narrow screens', async ({ page, isMobile }) => {
    test.skip(isMobile, 'starts wide')
    await boot(page, 2000)
    const card = page.locator('[data-cluster] .health')
    await expect(card).toHaveCSS('position', 'absolute')
    expect(await card.evaluate((el) => el.style.left)).not.toBe('')
    await page.setViewportSize({ width: 600, height: 900 })
    await expect(card).toHaveCSS('position', 'relative')
    await expect.poll(() => card.evaluate((el) => el.style.left)).toBe('')
  })

  test('with reduced motion, it starts settled and keeps still', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await prepare(page)
    await openPaused(page, ONLINE)
    await page.clock.runFor(800)
    await expect(legend(page, 'healthy')).toHaveText('28')
    await expect(legend(page, 'critical')).toHaveText('5')
    await skip(page, 30_000)
    await expect(legend(page, 'healthy')).toHaveText('28')
    await expect(legend(page, 'critical')).toHaveText('5')
    await save(page)
    await context.close()
  })
})
