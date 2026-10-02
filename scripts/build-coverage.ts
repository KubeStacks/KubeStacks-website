/**
 * Builds the site twice with coverage instrumentation, for the e2e tests:
 *
 *   dist/          as published, from the release in tests/fixtures/release.json
 *   dist-offline/  as built when GitHub can't be reached, so the browser fills in the links
 *
 * Both talk to a stand-in for GitHub's API (tests/support/github-stub.ts), never the real one.
 * Coverage from earlier runs is cleared first; the builds' own lands in .nyc_output/.
 */
import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'

rmSync('.nyc_output', { recursive: true, force: true })

for (const [outDir, github] of [
  ['dist', 'release'],
  ['dist-offline', 'down'],
]) {
  console.log(`\nBuilding ${outDir}/ (GitHub: ${github})`)
  const result = spawnSync('npx', ['astro', 'build'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      KUBESTACKS_COVERAGE: '1',
      KUBESTACKS_OUT_DIR: outDir,
      KUBESTACKS_GITHUB: github,
      // A token, as CI builds have one: the stand-in doesn't check it.
      GITHUB_TOKEN: 'coverage-build',
      NODE_OPTIONS:
        `${process.env.NODE_OPTIONS ?? ''} --import ./tests/support/github-stub.ts`.trim(),
    },
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
