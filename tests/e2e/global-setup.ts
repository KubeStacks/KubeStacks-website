import { existsSync, readdirSync, rmSync } from 'node:fs'

/** Fails fast without the coverage builds, and clears the browser coverage of earlier runs. */
export default function globalSetup() {
  if (!existsSync('dist/index.html') || !existsSync('dist-offline/index.html')) {
    throw new Error(
      'No coverage builds found. Run `npm run build:coverage` (or `npm run test:e2e`) first.',
    )
  }
  for (const file of existsSync('.nyc_output') ? readdirSync('.nyc_output') : []) {
    if (file.startsWith('browser-')) rmSync(`.nyc_output/${file}`)
  }
}
