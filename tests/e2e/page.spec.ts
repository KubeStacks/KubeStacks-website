import { test, expect, prepare, save, ONLINE } from './fixtures'
import type { Page } from '@playwright/test'

const tab = (page: Page, view: string) =>
  page.locator(`[data-showcase] [role="tab"][data-view="${view}"]`)
const view = (page: Page, name: string) =>
  page.locator(`[data-showcase] .view[data-view="${name}"]`)
/** Waits for a smooth scroll to come to rest. */
async function rested(page: Page) {
  let last = -1
  await expect
    .poll(async () => {
      const y = await page.evaluate(() => scrollY)
      const still = y === last
      last = y
      return still
    })
    .toBe(true)
}

const eager = (page: Page) =>
  page
    .locator('[data-showcase] img[loading="eager"]')
    .evaluateAll((imgs) =>
      imgs.map((i) => `${i.closest<HTMLElement>('.view')!.dataset.view}-${i.dataset.variant}`),
    )

test.describe('the app window', () => {
  test('tabs switch views by click and by arrow keys', async ({ page, isMobile }) => {
    await page.goto('/')
    await page.locator('[data-showcase]').scrollIntoViewIfNeeded()
    await tab(page, 'pods').click()
    await expect(tab(page, 'pods')).toHaveAttribute('aria-selected', 'true')
    await expect(view(page, 'pods')).toHaveAttribute('data-active', 'true')
    await expect(view(page, 'overview')).toHaveAttribute('data-active', 'false')
    await expect(page.locator('[data-showcase] [data-caption="pods"]')).toBeVisible()
    await expect(page.locator('[data-showcase] [data-caption="overview"]')).toBeHidden()
    if (isMobile) return

    await page.keyboard.press('ArrowLeft')
    await expect(tab(page, 'workloads')).toBeFocused()
    await expect(tab(page, 'workloads')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(tab(page, 'helm')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(tab(page, 'overview')).toHaveAttribute('aria-selected', 'true')
    await expect(tab(page, 'overview')).toHaveAttribute('tabindex', '0')
    await expect(tab(page, 'helm')).toHaveAttribute('tabindex', '-1')
    await page.keyboard.press('Enter')
    await expect(tab(page, 'overview')).toHaveAttribute('aria-selected', 'true')
  })

  test('the app’s shortcuts work: G, then a letter', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard')
    await page.goto('/')
    const showcase = page.locator('[data-showcase]')

    // From the top of the page, it switches and brings the window into view.
    await page.keyboard.press('g')
    await page.keyboard.press('w')
    await expect(tab(page, 'workloads')).toHaveAttribute('aria-selected', 'true')
    await rested(page)
    await expect(showcase).toBeInViewport({ ratio: 0.5 })
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0)

    // Already in view, it just switches.
    const y = await page.evaluate(() => scrollY)
    await page.keyboard.press('G')
    await page.keyboard.press('h')
    await expect(tab(page, 'helm')).toHaveAttribute('aria-selected', 'true')
    expect(await page.evaluate(() => scrollY)).toBe(y)

    // A letter on its own does nothing, and whatever follows G ends the sequence.
    await page.keyboard.press('p')
    await page.keyboard.press('g')
    await page.keyboard.press('z')
    await page.keyboard.press('p')
    await page.keyboard.press('g')
    await page.keyboard.press('g')
    await page.keyboard.press('p')
    // Nor with other keys held.
    await page.keyboard.press('Control+g')
    await page.keyboard.press('o')
    await page.keyboard.press('Meta+g')
    await page.keyboard.press('Alt+o')
    await expect(tab(page, 'helm')).toHaveAttribute('aria-selected', 'true')

    // Nor while typing.
    await page.locator('[data-command] input').focus()
    await page.keyboard.type('gp')
    await expect(tab(page, 'helm')).toHaveAttribute('aria-selected', 'true')
    await page.locator('[data-command] input').blur()

    // G stays armed for a moment only.
    await page.keyboard.press('g')
    await page.waitForTimeout(1300)
    await page.keyboard.press('p')
    await expect(tab(page, 'helm')).toHaveAttribute('aria-selected', 'true')

    // Scrolled past the window, it comes back into view.
    await page.locator('footer').scrollIntoViewIfNeeded()
    await expect(showcase).not.toBeInViewport()
    await page.keyboard.press('g')
    await page.keyboard.press('u')
    await expect(tab(page, 'metrics')).toHaveAttribute('aria-selected', 'true')
    await rested(page)
    await expect(showcase).toBeInViewport({ ratio: 0.5 })
  })

  test('screenshots load up front, in the current theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    const loaded = await eager(page)
    expect(loaded.filter((e) => e.endsWith('-dark'))).toHaveLength(7)
    // The open view, ready in the other theme.
    expect(loaded).toEqual(expect.arrayContaining(['overview-light']))
    expect(loaded).toHaveLength(8)

    await page.emulateMedia({ colorScheme: 'light' })
    await expect
      .poll(() => eager(page).then((e) => e.filter((x) => x.endsWith('-light')).length))
      .toBe(7)
    await tab(page, 'logs').click()
    expect(await eager(page)).toContain('logs-dark')
  })
})

test('the navigation gets its background once the page scrolls', async ({ page }) => {
  await page.goto('/')
  const nav = page.locator('[data-nav]')
  await expect(nav).not.toHaveAttribute('data-scrolled')
  await page.evaluate(() => scrollTo(0, 400))
  await expect(nav).toHaveAttribute('data-scrolled')
  await page.evaluate(() => scrollTo(0, 0))
  await expect(nav).not.toHaveAttribute('data-scrolled')
})

test('the slider moves the line between the dark and light screenshots', async ({ page }) => {
  await page.goto('/')
  const compare = page.locator('[data-compare]')
  const split = () => compare.evaluate((el) => el.style.getPropertyValue('--split'))
  await compare.scrollIntoViewIfNeeded()
  expect(await split()).toBe('50%')
  await compare.locator('input').evaluate((input: HTMLInputElement) => {
    input.value = '20'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(await split()).toBe('20%')
})

test.describe('the build commands', () => {
  const button = (page: Page) => page.locator('button[data-copy="#build-cmd"]')

  test('copy to the clipboard, and say so for a moment', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are a Chromium thing')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.clock.install()
    await page.goto('/')
    await button(page).scrollIntoViewIfNeeded()
    await button(page).click()
    await expect(button(page)).toHaveAttribute('data-done')
    await expect(button(page)).toHaveAttribute('aria-label', 'Copied')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await page.locator('#build-cmd').textContent(),
    )
    // Copying again keeps it up longer.
    await page.clock.runFor(1000)
    await button(page).click()
    await page.clock.runFor(1000)
    await expect(button(page)).toHaveAttribute('data-done')
    await page.clock.runFor(700)
    await expect(button(page)).not.toHaveAttribute('data-done')
    await expect(button(page)).toHaveAttribute('aria-label', 'Copy the build commands')
  })

  test('are selected instead where the clipboard is refused', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: ONLINE })
    const page = await context.newPage()
    await prepare(page)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) },
      })
    })
    await page.goto('/')
    await button(page).click()
    await expect
      .poll(() => page.evaluate(() => getSelection()!.toString()))
      .toBe(await page.locator('#build-cmd').textContent())
    await expect(button(page)).not.toHaveAttribute('data-done')
    await save(page)
    await context.close()
  })
})
