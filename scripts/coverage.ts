/**
 * Istanbul instrumentation for coverage builds (`npm run build:coverage`).
 *
 * The raw TypeScript in `src/` is instrumented before any other transform, so recorded
 * locations map 1:1 onto the source files without source-map remapping. The same files are
 * instrumented for the build (where .astro pages call into them while the site renders) and
 * for the browser bundles:
 *
 * - build:   counters land on the build process's `globalThis.__coverage__`, written to
 *            `.nyc_output/` when the build is done
 * - browser: counters land on the page's `window.__coverage__`, which the e2e tests collect
 *            (tests/e2e/fixtures.ts)
 *
 * Files are keyed by repo-relative POSIX paths, so every build's and test's coverage merges.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { AstroIntegration } from 'astro'
import { createInstrumenter } from 'istanbul-lib-instrument'

const toPosix = (path: string) => path.split(sep).join('/')

export function coverage(): AstroIntegration {
  const src = `${toPosix(resolve('src'))}/`
  const instrumenter = createInstrumenter({
    esModules: true,
    compact: false,
    produceSourceMap: true,
    coverageGlobalScope: 'globalThis',
    coverageGlobalScopeFunc: false,
    parserPlugins: ['typescript'],
  })
  return {
    name: 'kubestacks:coverage',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'kubestacks:coverage-instrument',
                enforce: 'pre',
                transform(code, id) {
                  const file = toPosix(id.split('?')[0]!)
                  if (!file.startsWith(src) || !file.endsWith('.ts')) return
                  const key = toPosix(relative(process.cwd(), file))
                  const instrumented = instrumenter.instrumentSync(code, key)
                  return { code: instrumented, map: instrumenter.lastSourceMap() as never }
                },
              },
            ],
          },
        })
      },
      'astro:build:done': () => {
        const data = (globalThis as { __coverage__?: object }).__coverage__
        if (!data) return
        mkdirSync('.nyc_output', { recursive: true })
        writeFileSync(join('.nyc_output', `build-${process.pid}.json`), JSON.stringify(data))
      },
    },
  }
}
