import { test, expect, prepare, save, ONLINE, OFFLINE } from './fixtures'
import { BUILT, github, release, type Answer } from '../support/releases'
import type { Browser, Page } from '@playwright/test'

/** How a visitor's browser describes their computer. */
interface Computer {
  userAgent?: string
  /** navigator.platform */
  platform?: string
  /** Chromium's navigator.userAgentData; null for browsers without it. */
  uaData?: { platform: string; mobile: boolean; arch: string | 'refused' } | null
  /** The WebGL renderer: a GPU's name, 'no-webgl', or 'hidden' (no debug info). */
  renderer?: string
  touchPoints?: number
}

const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'
const LINUX =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
const LINUX_ARM = 'Mozilla/5.0 (X11; Linux aarch64; rv:140.0) Gecko/20100101 Firefox/140.0'

function pretend({ platform, uaData, renderer, touchPoints }: Computer) {
  const define = (name: string, value: unknown) =>
    Object.defineProperty(Navigator.prototype, name, { get: () => value, configurable: true })
  if (platform !== undefined) define('platform', platform)
  if (touchPoints !== undefined) define('maxTouchPoints', touchPoints)
  if (uaData === null) define('userAgentData', undefined)
  else if (uaData) {
    define('userAgentData', {
      platform: uaData.platform,
      mobile: uaData.mobile,
      getHighEntropyValues: () =>
        uaData.arch === 'refused'
          ? Promise.reject(new Error('Not allowed'))
          : Promise.resolve({ architecture: uaData.arch }),
    })
  }
  if (renderer !== undefined) {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type !== 'webgl')
        return (getContext as (...a: unknown[]) => unknown).call(this, type, ...rest)
      if (renderer === 'no-webgl') return null
      return {
        getExtension: () => (renderer === 'hidden' ? null : { UNMASKED_RENDERER_WEBGL: 0x9246 }),
        getParameter: () => renderer,
      }
    } as typeof getContext
  }
}

/** Opens the site as a visitor on that computer would see it. */
async function visit(
  browser: Browser,
  computer: Computer,
  { url = ONLINE, answer }: { url?: string; answer?: Answer } = {},
) {
  const context = await browser.newContext({ userAgent: computer.userAgent })
  const page = await context.newPage()
  await prepare(page)
  if (answer !== undefined) await github(page, answer)
  await page.addInitScript(pretend, computer)
  const asked = page.waitForRequest('https://api.github.com/**')
  await page.goto(url)
  await asked
  return page
}

async function done(page: Page) {
  await save(page)
  await page.context().close()
}

const hero = (page: Page) => page.locator('[data-hero-download]')
const note = (page: Page) => page.locator('[data-hero-note]')
const file = (name: string, version = '1.1.0') =>
  `https://github.com/KubeStacks/KubeStacks/releases/download/v${version}/KubeStacks-${version}-${name}`

test.describe('the download for this computer', () => {
  test.skip(({ isMobile }) => isMobile, 'computers are pretended in desktop Chromium')

  for (const [name, computer, expected] of [
    [
      'an Apple silicon Mac in Chrome',
      { userAgent: MAC_CHROME, uaData: { platform: 'macOS', mobile: false, arch: 'arm' } },
      {
        os: 'mac',
        file: 'mac-arm64.dmg',
        label: 'macOS',
        note: 'For Apple silicon, 135 MB. Intel and other platforms',
      },
    ],
    [
      'an Intel Mac in Chrome',
      { userAgent: MAC_CHROME, uaData: { platform: 'macOS', mobile: false, arch: 'x86' } },
      { os: 'mac', file: 'mac-x64.dmg', label: 'macOS', note: 'For Intel Macs' },
    ],
    [
      'an Intel Mac in Safari',
      {
        userAgent: MAC_SAFARI,
        platform: 'MacIntel',
        uaData: null,
        renderer: 'Intel(R) Iris(TM) Plus Graphics',
      },
      { os: 'mac', file: 'mac-x64.dmg', label: 'macOS', note: 'Apple silicon and other platforms' },
    ],
    [
      'an Apple silicon Mac in Safari',
      { userAgent: MAC_SAFARI, platform: 'MacIntel', uaData: null, renderer: 'Apple M4 Pro' },
      { os: 'mac', file: 'mac-arm64.dmg', label: 'macOS', note: 'For Apple silicon' },
    ],
    [
      'a Mac that hides its graphics',
      { userAgent: MAC_SAFARI, platform: 'MacIntel', uaData: null, renderer: 'hidden' },
      { os: 'mac', file: 'mac-arm64.dmg', label: 'macOS', note: 'For Apple silicon' },
    ],
    [
      'a Mac without WebGL',
      { userAgent: MAC_SAFARI, platform: 'MacIntel', uaData: null, renderer: 'no-webgl' },
      { os: 'mac', file: 'mac-arm64.dmg', label: 'macOS', note: 'For Apple silicon' },
    ],
    [
      'a Windows PC',
      { uaData: { platform: 'Windows', mobile: false, arch: 'x86' } },
      { os: 'windows', file: 'win.exe', label: 'Windows', note: 'For x64 and arm64' },
    ],
    [
      'a Linux PC that keeps its chip to itself',
      { userAgent: LINUX, uaData: { platform: 'Linux', mobile: false, arch: 'refused' } },
      { os: 'linux', file: 'linux-x86_64.AppImage', label: 'Linux', note: 'AppImage for x64, ' },
    ],
    [
      'an arm64 Linux PC in Firefox',
      { userAgent: LINUX_ARM, platform: 'Linux aarch64', uaData: null },
      {
        os: 'linux',
        file: 'linux-arm64.AppImage',
        label: 'Linux',
        note: '.deb, .rpm and other platforms',
      },
    ],
    [
      'a Chromebook',
      { userAgent: LINUX, uaData: { platform: 'Chrome OS', mobile: false, arch: '' } },
      { os: 'linux', file: 'linux-x86_64.AppImage', label: 'Linux', note: 'AppImage for x64' },
    ],
  ] as const) {
    test(`offers ${name} its installer`, async ({ browser }) => {
      const page = await visit(browser, computer)
      await expect(hero(page)).toHaveAttribute('href', file(expected.file))
      await expect(page.locator('[data-hero-label]')).toHaveText(`Download for ${expected.label}`)
      await expect(note(page)).toBeVisible()
      await expect(note(page)).toContainText(expected.note)
      await expect(note(page).locator('a')).toHaveAttribute('href', '#download')
      const card = page.locator(`[data-platform="${expected.os}"]`)
      await expect(card).toHaveAttribute('data-yours')
      await expect(card.locator('[data-pick]')).toHaveAttribute('href', file(expected.file))
      await expect(page.locator('[data-yours]')).toHaveCount(1)
      await done(page)
    })
  }

  for (const [name, computer] of [
    ['a phone', { uaData: { platform: 'Android', mobile: true, arch: 'arm' } }],
    [
      'an iPad asking for the desktop site',
      { userAgent: MAC_SAFARI, platform: 'MacIntel', uaData: null, touchPoints: 5 },
    ],
    ['an unknown system', { platform: 'FreeBSD amd64', uaData: null }],
  ] as const) {
    test(`sends ${name} to the download section`, async ({ browser }) => {
      const page = await visit(browser, computer)
      await expect(hero(page)).toHaveAttribute('href', '#download')
      await expect(page.locator('[data-hero-label]')).toHaveText('Download')
      await expect(note(page)).toBeHidden()
      await expect(page.locator('[data-yours]')).toHaveCount(0)
      await done(page)
    })
  }

  test('an iPhone is sent to the download section', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    })
    const page = await context.newPage()
    await prepare(page)
    await page.goto('/')
    await expect(hero(page)).toHaveAttribute('href', '#download')
    await done(page)
  })
})

test.describe('the latest release', () => {
  test.skip(({ isMobile }) => isMobile, 'computers are pretended in desktop Chromium')
  const mac = {
    userAgent: MAC_CHROME,
    uaData: { platform: 'macOS', mobile: false, arch: 'arm' },
  } as const

  test('a release newer than the build takes over every link', async ({ browser }) => {
    const page = await visit(browser, mac, { answer: release('1.2.0') })
    await expect(page.locator('[data-dl-headline]')).toHaveText('Version 1.2.0 is out')
    await expect(page.locator('[data-dl-version]').first()).toHaveText('1.2.0')
    await expect(hero(page)).toHaveAttribute('href', file('mac-arm64.dmg', '1.2.0'))
    // Every file, but the one the release doesn't have (an arm64 .rpm).
    for (const a of await page.locator('a[data-dl]:not([data-dl="linux.rpm.arm64"])').all()) {
      await expect(a).toHaveAttribute('href', /\/v1\.2\.0\//)
    }
    for (const a of await page.locator('a[data-dl-notes]').all()) {
      await expect(a).toHaveAttribute(
        'href',
        'https://github.com/KubeStacks/KubeStacks/releases/tag/v1.2.0',
      )
    }
    await expect(page.locator('[data-dl-date]')).toHaveText('October 1, 2026')
    await done(page)
  })

  test('files the newer release lacks keep the build’s', async ({ browser }) => {
    const answer = release('1.2.0', ['-mac-arm64.dmg', '-x86_64.rpm'])
    const page = await visit(browser, mac, { answer })
    await expect(page.locator('[data-dl-headline]')).toHaveText('Version 1.2.0 is out')
    await expect(page.locator('a[data-dl="mac.dmg.arm64"]')).toHaveAttribute(
      'href',
      file('mac-arm64.dmg'),
    )
    await expect(page.locator('a[data-dl="linux.rpm.x64"]')).toHaveAttribute(
      'href',
      file('linux-x86_64.rpm'),
    )
    await expect(page.locator('a[data-dl="mac.dmg.x64"]')).toHaveAttribute(
      'href',
      file('mac-x64.dmg', '1.2.0'),
    )
    // The hero keeps offering the build's installer for this Mac.
    await expect(hero(page)).toHaveAttribute('href', file('mac-arm64.dmg'))
    await done(page)
  })

  for (const [name, answer] of [
    ['is the one it was built with', BUILT],
    ['can’t be had: GitHub is down', 'down'],
    ['can’t be had: GitHub says no', 403],
    ['has no files yet', { ...release('1.2.0'), assets: [] }],
  ] satisfies [string, Answer][]) {
    test(`nothing changes when the latest ${name}`, async ({ browser }) => {
      const page = await visit(browser, mac, { answer })
      await expect(page.locator('[data-dl-headline]')).toHaveText('Version 1.1.0 is out')
      await expect(hero(page)).toHaveAttribute('href', file('mac-arm64.dmg'))
      await expect(page.locator('a[data-dl="mac.dmg.x64"]')).toHaveAttribute(
        'href',
        file('mac-x64.dmg'),
      )
      await done(page)
    })
  }
})

test.describe('a site built while GitHub was down', () => {
  test.skip(({ isMobile }) => isMobile, 'computers are pretended in desktop Chromium')
  const mac = {
    userAgent: MAC_CHROME,
    uaData: { platform: 'macOS', mobile: false, arch: 'arm' },
  } as const

  test('points at the releases page until the browser finds the latest', async ({ browser }) => {
    const page = await visit(browser, mac, { url: OFFLINE, answer: 'down' })
    await expect(page.locator('[data-dl-headline]')).toHaveText('Get the latest version')
    await expect(page.locator('[data-dl-fallback]')).toBeVisible()
    await expect(page.locator('[data-dl-status]')).toBeHidden()
    await expect(hero(page)).toHaveAttribute('href', '#download')
    await expect(page.locator('[data-platform="mac"]')).toHaveAttribute('data-yours')
    await expect(page.locator('a[data-dl="mac.dmg.arm64"]')).toHaveAttribute(
      'href',
      'https://github.com/KubeStacks/KubeStacks/releases/latest',
    )
    await done(page)
  })

  test('fills every link in once the browser finds it', async ({ browser }) => {
    const page = await visit(browser, mac, { url: OFFLINE })
    await expect(page.locator('[data-dl-headline]')).toHaveText('Version 1.1.0 is out')
    await expect(page.locator('[data-dl-status]')).toBeVisible()
    await expect(page.locator('[data-dl-fallback]')).toBeHidden()
    await expect(page.locator('[data-dl-size="mac.dmg.arm64"]')).toHaveText('135 MB')
    await expect(hero(page)).toHaveAttribute('href', file('mac-arm64.dmg'))
    // The one file the release doesn't have stays on the releases page.
    await expect(page.locator('a[data-dl="linux.rpm.arm64"]')).toHaveAttribute(
      'href',
      'https://github.com/KubeStacks/KubeStacks/releases/latest',
    )
    await done(page)
  })

  test('…for visitors on any system', async ({ browser }) => {
    const page = await visit(browser, { platform: 'FreeBSD amd64', uaData: null }, { url: OFFLINE })
    await expect(page.locator('[data-dl-headline]')).toHaveText('Version 1.1.0 is out')
    await expect(hero(page)).toHaveAttribute('href', '#download')
    await done(page)
  })
})
