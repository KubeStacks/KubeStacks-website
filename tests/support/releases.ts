/**
 * Releases as GitHub's API returns them, for the browser's check for a newer one. Built from
 * the fixture the site is built with (tests/fixtures/release.json).
 */
import { readFileSync } from 'node:fs'
import type { Page, Route } from '@playwright/test'

interface Release {
  tag_name: string
  html_url: string
  assets: { name: string; browser_download_url: string; size: number }[]
}

export const BUILT = JSON.parse(
  readFileSync(new URL('../fixtures/release.json', import.meta.url), 'utf8'),
) as Release

const BUILT_VERSION = BUILT.tag_name.slice(1)

/** The built release under another version, without the files named in `without`. */
export function release(version = BUILT_VERSION, without: string[] = []): Release {
  const swap = (s: string) => s.replaceAll(BUILT_VERSION, version)
  return {
    ...BUILT,
    tag_name: `v${version}`,
    html_url: swap(BUILT.html_url),
    assets: BUILT.assets
      .filter((a) => !without.some((w) => a.name.endsWith(w)))
      .map((a) => ({
        ...a,
        name: swap(a.name),
        browser_download_url: swap(a.browser_download_url),
      })),
  }
}

/** What GitHub says: a release, nothing (it's down), or an HTTP error status. */
export type Answer = Release | 'down' | number

/** Answers the page's request for the latest release: a release, an HTTP error, or nothing. */
export async function github(page: Page, answer: Answer) {
  await page.unroute('https://api.github.com/**')
  await page.route('https://api.github.com/**', (route: Route) => {
    if (answer === 'down') return route.abort('internetdisconnected')
    if (typeof answer === 'number')
      return route.fulfill({ status: answer, json: { message: 'nope' } })
    return route.fulfill({ json: answer })
  })
}
