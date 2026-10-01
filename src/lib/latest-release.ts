/**
 * The latest release as the build sees it, read once per build (and per dev-server run).
 * Builds pass GITHUB_TOKEN when they have one, as CI does, to stay clear of GitHub's limit
 * for anonymous requests.
 */
import { fetchLatest, type Downloads } from './releases'

let latest: Promise<Downloads | null> | undefined

export function latestAtBuild(): Promise<Downloads | null> {
  latest ??= fetchLatest(process.env.GITHUB_TOKEN)
  return latest
}
