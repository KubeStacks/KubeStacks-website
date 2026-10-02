/**
 * The page holds still: nothing wider than the screen, nothing shifting as it loads, and
 * nothing moving the page while its demos run.
 */
import { test, expect } from './fixtures'

const WIDTHS = [320, 360, 390, 414, 768, 1024, 1280, 1920]

test.describe('layout', () => {
  test('nothing scrolls sideways, at any width', async ({ page, isMobile }) => {
    test.skip(isMobile, 'widths are set on the desktop project')
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      const wide = await page.evaluate(() => {
        const limit = document.documentElement.clientWidth
        return [...document.querySelectorAll('body *')]
          .filter((el) => {
            const r = el.getBoundingClientRect()
            // Inside something that scrolls or clips, an element may be wider: that one holds it.
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
              if (getComputedStyle(p).overflowX !== 'visible') return false
            }
            return r.width > 0 && (r.right > limit + 0.5 || r.left < -0.5)
          })
          .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
      })
      expect(wide, `at ${width}px`).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `at ${width}px`).toBe(
        width,
      )
    }
  })

  test('nothing scrolls sideways on a phone', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the phone')
    await page.goto('/')
    const width = await page.evaluate(() => innerWidth)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await page.evaluate(() => scrollTo({ left: 300, behavior: 'instant' }))
    expect(await page.evaluate(() => scrollX)).toBe(0)
  })

  test('the page doesn’t shift as it loads', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'layout-shift entries are Chromium’s')
    await page.addInitScript(() => {
      ;(window as { shift?: number }).shift = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          value: number
          hadRecentInput: boolean
        })[])
          if (!entry.hadRecentInput) (window as { shift?: number }).shift! += entry.value
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto('/')
    for (let y = 0; y < (await page.evaluate(() => document.body.scrollHeight)); y += 500) {
      await page.evaluate((top) => scrollTo(0, top), y)
      await page.waitForTimeout(120)
    }
    expect(await page.evaluate(() => (window as { shift?: number }).shift)).toBeLessThan(0.01)
  })

  test('the demos don’t move the page while they run', async ({ page }) => {
    await page.clock.install()
    await page.goto('/')
    for (const demo of ['[data-problems]', '[data-command]', '[data-logs]']) {
      await page.locator(demo).scrollIntoViewIfNeeded()
      // Rest the page on the demo's bottom edge, where scroll anchoring would pull it.
      await page.evaluate((selector) => {
        const r = document.querySelector(selector)!.getBoundingClientRect()
        scrollBy({ top: Math.round(r.bottom - innerHeight + 40), behavior: 'instant' })
      }, demo)
      const y = await page.evaluate(() => scrollY)
      await page.clock.runFor(12_000)
      expect(await page.evaluate(() => scrollY), demo).toBe(y)
    }
  })
})
