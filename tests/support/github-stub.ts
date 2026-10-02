/**
 * GitHub's API, stood in for during coverage builds (see scripts/build-coverage.ts), so
 * they don't depend on the network or on whatever was released last.
 *
 *   KUBESTACKS_GITHUB=release  the latest release is tests/fixtures/release.json
 *   KUBESTACKS_GITHUB=down     GitHub can't be reached
 *
 * Loaded into the build with `node --import`; every other request goes through.
 */
import { readFileSync } from 'node:fs'

const mode = process.env.KUBESTACKS_GITHUB
const realFetch = globalThis.fetch

globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (!url.startsWith('https://api.github.com/')) return realFetch(input, init)
  if (mode === 'down') throw new TypeError('fetch failed')
  return Response.json(JSON.parse(readFileSync('tests/fixtures/release.json', 'utf8')))
}
