import { test, expect, observed, openPaused, prepare, save, ONLINE } from './fixtures'
import type { Locator, Page } from '@playwright/test'

/** Moves the clock on, a little at a time, until `done` holds. */
async function runUntil(page: Page, done: () => Promise<boolean>, max = 20_000) {
  for (let t = 0; t <= max; t += 50) {
    if (await done()) return
    await page.clock.runFor(50)
  }
  throw new Error('Timed out waiting on the clock')
}

/** Scrolls a demo onto the screen; its timers start once it knows it's there. */
async function show(page: Page, demo: Locator, selector: string) {
  await demo.scrollIntoViewIfNeeded()
  await expect(demo).toBeInViewport()
  await observed(page, selector)
}

test.describe('problems sort to the top', () => {
  test('rows change state and re-sort, failing ones first', async ({ page }) => {
    await openPaused(page)
    const demo = page.locator('[data-problems]')
    const order = () =>
      demo.locator('ol > li').evaluateAll((rows) => rows.map((r) => r.dataset.name))
    const RANK = ['critical', 'warning', 'progressing', 'healthy', 'neutral']
    const sorted = () =>
      demo.locator('ol > li').evaluateAll((rows, rank) => {
        const keys = rows.map((r) => `${rank.indexOf(r.dataset.health!)}${r.dataset.name}`)
        return keys.every((k, i) => i === 0 || keys[i - 1]! <= k)
      }, RANK)
    const before = await order()
    await show(page, demo, '[data-problems]')

    // The first change comes 1.4s after it's on screen: cart degrades, and moves up.
    await page.clock.runFor(1500)
    await expect(demo.locator('[data-name="cart"]')).toHaveAttribute('data-health', 'warning')
    await expect(demo.locator('[data-name="cart"]')).toHaveAttribute('data-changed')
    await expect(demo.locator('[data-name="cart"] .c-pods')).toHaveText('1/2')
    expect(await order()).not.toEqual(before)
    expect(await sorted()).toBe(true)
    await page.clock.runFor(1500)
    await expect(demo.locator('[data-name="cart"]')).not.toHaveAttribute('data-changed')

    // Then grafana fails and goes to the top, and so on, around the script and back.
    await page.clock.runFor(1200)
    await expect(demo.locator('[data-name="grafana"]')).toHaveAttribute('data-health', 'critical')
    expect(await sorted()).toBe(true)
    await page.clock.runFor(2600 * 5)
    await expect(demo.locator('[data-name="cart"]')).toHaveAttribute('data-health', 'warning')
  })

  test('stops while off screen', async ({ page }) => {
    await openPaused(page)
    const demo = page.locator('[data-problems]')
    await show(page, demo, '[data-problems]')
    await page.clock.runFor(1500)
    await page.evaluate(() => scrollTo(0, 0))
    await expect(demo).not.toBeInViewport()
    const health = await demo.locator('[data-name="grafana"]').getAttribute('data-health')
    await page.clock.runFor(10_000)
    await expect(demo.locator('[data-name="grafana"]')).toHaveAttribute('data-health', health!)
  })
})

test.describe('usage next to capacity', () => {
  test('shows an hour of CPU that keeps drifting', async ({ page }) => {
    await openPaused(page)
    const demo = page.locator('[data-usage]')
    await expect(demo.locator('[data-u-pct]')).toHaveText('44')
    await expect(demo.locator('[data-u-cores]')).toHaveText('12.2')
    await expect(demo.locator('[role="meter"]')).toHaveAttribute('aria-valuenow', '44')
    const line = await demo.locator('[data-u-line]').getAttribute('d')
    await show(page, demo, '[data-usage]')
    await page.clock.runFor(1700)
    expect(await demo.locator('[data-u-line]').getAttribute('d')).not.toBe(line)
    const pct = Number(await demo.locator('[data-u-pct]').textContent())
    expect(pct).toBeGreaterThanOrEqual(36)
    expect(pct).toBeLessThanOrEqual(56)
  })
})

test.describe('every change shows its kubectl', () => {
  test('the command follows the stepper; applying can be undone', async ({ page }) => {
    await page.goto('/')
    const demo = page.locator('[data-scale]')
    const replicas = demo.locator('output')
    const command = demo.locator('[data-cmd]')
    const apply = demo.locator('[data-apply]')
    const toast = demo.locator('[data-toast]')
    const more = demo.locator('[data-step="1"]')
    const fewer = demo.locator('[data-step="-1"]')
    await show(page, demo, '[data-scale]')

    await expect(replicas).toHaveText('3')
    await expect(apply).toBeDisabled()
    await expect(command).toHaveText(
      'kubectl scale deployment/checkout --replicas=3 -n shop --context demo',
    )
    await more.click()
    await expect(replicas).toHaveText('4')
    await expect(command).toContainText('--replicas=4')
    await expect(apply).toBeEnabled()

    // Cancel goes back to what's running.
    await demo.locator('[data-cancel]').click()
    await expect(replicas).toHaveText('3')
    await expect(apply).toBeDisabled()

    // Down to one replica, and no further than none.
    await fewer.click()
    await fewer.click()
    await expect(replicas).toHaveText('1')
    await apply.click()
    await expect(toast).toBeVisible()
    await expect(toast).toContainText('Scaled checkout to 1 replica')
    await expect(demo.locator('[data-now]')).toHaveText('Now 1')
    await expect(apply).toBeDisabled()
    await fewer.click()
    await fewer.click()
    await expect(replicas).toHaveText('0')

    // Undo puts back what ran before, and can't itself be undone.
    await demo.locator('[data-undo]').click()
    await expect(toast).toContainText('Scaled checkout back to 3 replicas')
    await expect(demo.locator('[data-undo]')).toBeHidden()
    await expect(replicas).toHaveText('3')
    await expect(demo.locator('[data-now]')).toHaveText('Now 3')
  })

  test('stops at twenty replicas, and the notification goes away', async ({ page }) => {
    await page.clock.install()
    await page.goto('/')
    const demo = page.locator('[data-scale]')
    await show(page, demo, '[data-scale]')
    for (let i = 0; i < 20; i++) await demo.locator('[data-step="1"]').click()
    await expect(demo.locator('output')).toHaveText('20')
    await demo.locator('[data-apply]').click()
    await expect(demo.locator('[data-toast]')).toContainText('Scaled checkout to 20 replicas')
    await page.clock.runFor(5100)
    await expect(demo.locator('[data-toast]')).toBeHidden()
  })
})

test.describe('the command palette', () => {
  const results = (page: Page) =>
    page
      .locator('[data-command] .p-item .p-name')
      .evaluateAll((items) => items.map((i) => i.textContent))
  const selected = (page: Page) =>
    page.locator('[data-command] .p-item[aria-selected="true"] .p-name')

  test('types searches on its own once on screen', async ({ page }) => {
    await openPaused(page)
    const demo = page.locator('[data-command]')
    const input = demo.locator('input')
    // Before that, it lists the views.
    expect(await results(page)).toContain('Workloads')
    await show(page, demo, '[data-command]')

    const typed = (word: string) => runUntil(page, async () => (await input.inputValue()) === word)
    const at = (i: number) =>
      runUntil(
        page,
        async () =>
          (await selected(page).count()) > 0 &&
          (await demo.locator(`.p-item[data-i="${i}"][aria-selected="true"]`).count()) > 0,
      )

    await typed('chec')
    await expect(demo.locator('.p-item mark').first()).toHaveText('chec')
    // It moves down the results, then on to the next search.
    await at(1)
    await at(2)
    await typed('worker')
    await typed('redis')
    await typed('prod')
    expect(await results(page)).toEqual(['prod-us-east'])
    // One result: nothing to move down to, so on to the first search again.
    await typed('')
    await typed('chec')

    // Pointing at the list does nothing while it plays.
    await demo.locator('.p-item[data-i="2"]').hover()
    await expect(demo.locator('.p-item[data-i="2"]')).toHaveAttribute('aria-selected', 'false')
  })

  test('is yours to search once you click into it', async ({ page, isMobile }) => {
    await page.goto('/')
    const demo = page.locator('[data-command]')
    const input = demo.locator('input')
    await show(page, demo, '[data-command]')
    await input.click()
    await expect(input).toHaveValue('')
    expect(await results(page)).toContain('Overview')

    await input.fill('worker')
    expect(await results(page)).toEqual(['worker-1', 'worker-2', 'worker-3'])
    await expect(selected(page)).toHaveText('worker-1')
    await input.press('ArrowDown')
    await expect(selected(page)).toHaveText('worker-2')
    await input.press('ArrowUp')
    await input.press('ArrowUp')
    await expect(selected(page)).toHaveText('worker-3')
    await input.press('ArrowDown')
    await expect(selected(page)).toHaveText('worker-1')
    await input.press('Shift')
    await expect(selected(page)).toHaveText('worker-1')

    // Names match by name or by what they are; the list stops at what fits.
    await input.fill('shop')
    await expect(demo.locator('.p-item').first()).toContainText('checkout')
    expect(await demo.locator('.p-item mark').count()).toBeLessThan(
      await demo.locator('.p-item').count(),
    )
    expect(await demo.locator('li').count()).toBeLessThanOrEqual(7)

    // Names are text, never markup.
    await input.fill('<b>')
    await expect(demo.locator('.p-empty')).toHaveText('Nothing matches “<b>” in demo.')
    await input.press('ArrowDown')
    await input.press('ArrowUp')
    await expect(demo.locator('.p-empty')).toBeVisible()

    if (!isMobile) {
      await input.fill('redis')
      await demo.locator('.p-item').nth(1).hover()
      await expect(demo.locator('.p-item').nth(1)).toHaveAttribute('aria-selected', 'true')
      await demo
        .locator('.p-item')
        .nth(1)
        .hover({ position: { x: 4, y: 4 } })
      await demo.locator('.p-group').first().hover()
      await expect(demo.locator('.p-item').nth(1)).toHaveAttribute('aria-selected', 'true')
    }

    await input.press('Escape')
    await expect(input).toHaveValue('')
    await expect(input).not.toBeFocused()
    // Coming back to it doesn't reset it.
    await input.fill('postgres')
    await input.blur()
    await input.focus()
    await expect(input).toHaveValue('postgres')
  })

  test('with reduced motion, it waits to be used', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await prepare(page)
    await openPaused(page, ONLINE)
    const demo = page.locator('[data-command]')
    await show(page, demo, '[data-command]')
    await page.clock.runFor(5000)
    await expect(demo.locator('input')).toHaveValue('')
    await demo.locator('input').focus()
    await save(page)
    await context.close()
  })
})

test.describe('logs from every pod', () => {
  test('lines arrive in order, counted by pod and level', async ({ page }) => {
    await openPaused(page)
    const demo = page.locator('[data-logs]')
    const lines = demo.locator('ol > li')
    const count = (key: string) => demo.locator(`[data-count="${key}"]`).textContent().then(Number)
    await expect(lines).toHaveCount(12)
    const before = await count('lnk52')
    await show(page, demo, '[data-logs]')
    await page.clock.runFor(900)
    await expect(lines).toHaveCount(13)
    await expect(lines.last()).toHaveClass('new')

    // Long enough for both crash-looping pods to try (and fail) to start.
    await page.clock.runFor(850 * 80)
    await expect(lines).toHaveCount(14)
    expect(await count('hqnnn')).toBeGreaterThan(0)
    expect(await count('pwkd2')).toBeGreaterThan(0)
    expect(await count('lnk52')).toBeGreaterThan(before)
    expect(await count('error')).toBeGreaterThan(0)
    expect(await count('warn')).toBeGreaterThan(0)
    await expect(demo.locator('li[data-level="error"] .l-msg').first()).toHaveText(
      /STRIPE_API_KEY is not set|exiting/,
    )
  })
})

test.describe('helm releases', () => {
  test('diffs the current values against the revision picked', async ({ page }) => {
    await page.goto('/')
    const demo = page.locator('[data-helm]')
    await show(page, demo, '[data-helm]')
    await expect(demo.locator('[data-from]')).toHaveText('2')
    await expect(demo.locator('[data-stat]')).toHaveText('+2 −1')
    await expect(demo.locator('button[data-rev="2"]')).toHaveAttribute('aria-pressed', 'true')

    await demo.locator('button[data-rev="1"]').click()
    await expect(demo.locator('[data-from]')).toHaveText('1')
    await expect(demo.locator('[data-stat]')).toHaveText('+3 −2')
    await expect(demo.locator('pre .del')).toHaveCount(2)
    await expect(demo.locator('pre .add')).toHaveCount(3)
    await expect(demo.locator('button[data-rev="2"]')).toHaveAttribute('aria-pressed', 'false')

    await demo.locator('button[data-rev="2"]').click()
    await expect(demo.locator('[data-stat]')).toHaveText('+2 −1')
  })
})
