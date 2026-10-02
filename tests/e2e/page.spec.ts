import { test, expect, prepare, save, ONLINE } from './fixtures'
import { DOCS_URL, PAGES } from '../../src/lib/docs'
import { SCREENSHOTS } from '../../src/lib/screenshots'
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

  test('screenshots load once the window is on screen, in the current theme', async ({ page }) => {
    const requested: string[] = []
    page.on('request', (r) => r.url().includes('.webp') && requested.push(r.url()))
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Only the open view has its sources; the others wait.
    expect(await eager(page)).toEqual([])
    expect(requested.every((u) => u.includes('/overview-'))).toBe(true)
    await expect(page.locator('[data-showcase] img[data-src]')).toHaveCount(12)
    // Switching themes from up here loads nothing either.
    await page.emulateMedia({ colorScheme: 'light' })
    await page.emulateMedia({ colorScheme: 'dark' })
    expect(await eager(page)).toEqual([])

    await page.locator('[data-showcase] .window').scrollIntoViewIfNeeded()
    await expect.poll(() => eager(page).then((e) => e.length)).toBe(8)
    const loaded = await eager(page)
    expect(loaded.filter((e) => e.endsWith('-dark'))).toHaveLength(7)
    // The open view, ready in the other theme.
    expect(loaded).toContain('overview-light')
    await expect(page.locator('[data-showcase] img[data-variant="dark"][data-src]')).toHaveCount(0)

    await page.emulateMedia({ colorScheme: 'light' })
    await expect
      .poll(() => eager(page).then((e) => e.filter((x) => x.endsWith('-light')).length))
      .toBe(7)
    await expect(page.locator('[data-showcase] img[data-src]')).toHaveCount(0)
    await tab(page, 'logs').click()
    expect(await eager(page)).toContain('logs-dark')
  })

  test('picking a view from afar loads them too', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard')
    await page.goto('/')
    await page.keyboard.press('g')
    await page.keyboard.press('h')
    await expect(
      page.locator('[data-showcase] .view[data-view="helm"] img:visible'),
    ).toHaveJSProperty('complete', true)
    expect((await eager(page)).length).toBeGreaterThanOrEqual(8)
  })
})

test.describe('in your cluster', () => {
  test('the hero and the navigation lead to it, and it to the chart', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.hero a[href="#cluster"]')).toHaveText('Run it in your cluster')
    await expect(page.locator('[data-nav] a[href="#cluster"]')).toHaveText('In your cluster')
    await expect(page.locator('#cluster a[href="#install-cluster"]')).toHaveText(
      'Install the chart',
    )
    await expect(page.locator('#install-cluster')).toHaveCount(1)
  })

  test('shows the app served from a cluster, in the current theme, from the app’s repository', async ({
    page,
  }) => {
    const requested: string[] = []
    page.on('request', (r) => r.url().includes('/server-') && requested.push(r.url()))
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Far down the page, it waits until it's near.
    expect(requested).toEqual([])

    const shots = page.locator('#cluster .page img')
    await page.locator('#cluster .browser').scrollIntoViewIfNeeded()
    await expect(page.locator('#cluster .page img[data-variant="light"]')).toBeVisible()
    await expect(page.locator('#cluster .page img[data-variant="dark"]')).toBeHidden()
    await expect(page.locator('#cluster .page img:visible')).toHaveJSProperty('complete', true)
    expect(requested.length).toBeGreaterThan(0)
    expect(requested.every((url) => url.startsWith(`${SCREENSHOTS}server-account-light`))).toBe(
      true,
    )
    expect(await shots.evaluateAll((imgs) => imgs.map((i) => i.getAttribute('src')))).toEqual([
      `${SCREENSHOTS}server-account-dark-1x.webp`,
      `${SCREENSHOTS}server-account-light-1x.webp`,
    ])
  })
})

test.describe('the docs', () => {
  test('are in the navigation on any screen, as an icon on a phone', async ({ page, isMobile }) => {
    await page.goto('/')
    const docs = page.locator('[data-nav] a[aria-label="Docs"]')
    await expect(docs).toBeVisible()
    await expect(docs).toHaveAttribute('href', DOCS_URL)
    await expect(docs.locator('span')).toBeVisible({ visible: !isMobile })
    await expect(page.locator(`footer a[href="${DOCS_URL}"]`)).toHaveText('Docs')
  })

  test('every link into them opens one of their pages, in a tab of its own', async ({ page }) => {
    await page.goto('/')
    const links = await page
      .locator(`a[href^="${DOCS_URL}"]`)
      .evaluateAll((as) => as.map((a) => [a.getAttribute('href')!, a.getAttribute('target')]))
    expect(links.length).toBeGreaterThan(40)
    for (const [href, target] of links) {
      const path = new URL(href!).pathname.slice(1)
      if (path) expect(Object.keys(PAGES), href!).toContain(path)
      expect(target, href!).toBe('_blank')
    }
  })

  test('the index lists each group’s pages by their titles there', async ({ page }) => {
    await page.goto('/')
    const groups = page.locator('#docs .group')
    await expect(groups).toHaveCount(9)
    for (const a of await page.locator('#docs .pages a').all()) {
      const path = new URL((await a.getAttribute('href'))!).pathname.slice(1)
      await expect(a).toHaveText(PAGES[path as keyof typeof PAGES])
    }
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

test.describe('the commands', () => {
  const button = (page: Page, target = '#build-cmd') =>
    page.locator(`button[data-copy="${target}"]`)

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

  test('to run KubeStacks in a cluster copy as they’re written, line by line', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are a Chromium thing')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')
    const commands = {
      '#helm-cmd': [
        'helm install kubestacks oci://ghcr.io/kubestacks/charts/kubestacks \\',
        '  --namespace kubestacks --create-namespace',
        'kubectl port-forward --namespace kubestacks service/kubestacks 8080:80',
      ],
      '#docker-cmd': [
        'docker run --rm -p 8080:8080 \\',
        '  -v "$PWD/kubeconfig:/kubeconfig:ro" -e KUBECONFIG=/kubeconfig \\',
        '  ghcr.io/kubestacks/kubestacks',
      ],
    }
    for (const [target, lines] of Object.entries(commands)) {
      await button(page, target).scrollIntoViewIfNeeded()
      await button(page, target).click()
      await expect(button(page, target)).toHaveAttribute('data-done')
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(lines.join('\n'))
    }
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
