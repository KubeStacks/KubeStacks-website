import { test, expect, prepare, save, ONLINE } from './fixtures'
import type { Browser, BrowserContextOptions, Page } from '@playwright/test'

const radio = (page: Page, value: string) =>
  page.locator(`[data-theme-switch] [role="radio"][data-value="${value}"]`)
const stored = (page: Page) => page.evaluate(() => localStorage.getItem('theme'))

/** Waits for a theme's view transition, if there is one, to finish. */
const settled = (page: Page) =>
  page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) => !(a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith('::view-transition'),
      ),
  )

/** Waits a few rendering frames: a view transition's update runs within them. */
const frames = (page: Page) =>
  page.evaluate(async () => {
    for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame)
  })

async function open(browser: Browser, options: BrowserContextOptions, init?: () => void) {
  const context = await browser.newContext({ ...options, baseURL: ONLINE })
  const page = await context.newPage()
  await prepare(page)
  if (init) await page.addInitScript(init)
  await page.goto('/')
  return page
}

async function done(page: Page) {
  await save(page)
  await page.context().close()
}

test.describe('the theme switch', () => {
  test('follows the system until a theme is chosen, and remembers it', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(radio(page, 'system')).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f5f5f6')

    // The system goes dark, and the page with it.
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0c0c0e')

    // Choosing light opens it as a circle from the button.
    const changed = page.evaluate(
      () =>
        new Promise((resolve) =>
          addEventListener('themechange', (e) => resolve((e as CustomEvent).detail), {
            once: true,
          }),
        ),
    )
    await radio(page, 'light').click()
    expect(await changed).toBe('light')
    await settled(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(radio(page, 'light')).toHaveAttribute('aria-checked', 'true')
    await expect(radio(page, 'system')).toHaveAttribute('aria-checked', 'false')
    expect(await stored(page)).toBe('light')

    // A chosen theme stays when the system changes…
    await page.emulateMedia({ colorScheme: 'light' })
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    // …and when the page is opened again.
    await save(page)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(radio(page, 'light')).toHaveAttribute('aria-checked', 'true')

    // Back to the system's.
    await radio(page, 'system').click()
    await settled(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await stored(page)).toBeNull()

    // Dark when it's already dark: nothing to animate.
    await radio(page, 'dark').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await stored(page)).toBe('dark')
    await save(page)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('works from the keyboard, as a radio group', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard')
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await radio(page, 'system').focus()
    await page.keyboard.press('ArrowRight')
    await expect(radio(page, 'light')).toBeFocused()
    await expect(radio(page, 'light')).toHaveAttribute('aria-checked', 'true')
    await settled(page)
    await page.keyboard.press('ArrowDown')
    await expect(radio(page, 'dark')).toHaveAttribute('aria-checked', 'true')
    await settled(page)
    // Around the ends.
    await page.keyboard.press('ArrowRight')
    await expect(radio(page, 'system')).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(radio(page, 'dark')).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(radio(page, 'light')).toHaveAttribute('aria-checked', 'true')
    await settled(page)
    // Other keys do nothing.
    await page.keyboard.press('Enter')
    await page.keyboard.press('a')
    await expect(radio(page, 'light')).toHaveAttribute('aria-checked', 'true')
    // Only the checked one is in the tab order.
    await expect(radio(page, 'light')).toHaveAttribute('tabindex', '0')
    await expect(radio(page, 'dark')).toHaveAttribute('tabindex', '-1')
  })

  test('the last choice wins, however quickly they come', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    const click = (values: string[]) =>
      page.evaluate((values) => {
        for (const value of values)
          document
            .querySelector<HTMLElement>(`[data-theme-switch] [data-value="${value}"]`)!
            .click()
      }, values)

    // Light, then Dark before Light's transition has even begun: Dark wins.
    await click(['light', 'dark'])
    await frames(page)
    await settled(page)
    await expect(radio(page, 'dark')).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await stored(page)).toBe('dark')

    // From Light, two choices that both need a transition: the first is skipped.
    await radio(page, 'light').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await settled(page)
    await click(['dark', 'system'])
    await frames(page)
    await settled(page)
    await expect(radio(page, 'system')).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('switches at once with reduced motion', async ({ browser }) => {
    const page = await open(browser, { colorScheme: 'dark', reducedMotion: 'reduce' })
    await radio(page, 'light').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await done(page)
  })

  test('switches at once without view transitions', async ({ browser }) => {
    const page = await open(browser, { colorScheme: 'dark' }, () => {
      delete (Document.prototype as Partial<Document>).startViewTransition
    })
    await radio(page, 'light').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await done(page)
  })

  test('still switches when the browser keeps no storage', async ({ browser }) => {
    const page = await open(browser, { colorScheme: 'dark' }, () => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError')
        },
      })
    })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await radio(page, 'light').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await radio(page, 'system').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await done(page)
  })
})
