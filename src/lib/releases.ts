/**
 * The latest KubeStacks release on GitHub, and which of its files to offer on each platform.
 *
 * The build reads it so the page ships with real download links (see latest-release.ts);
 * the browser reads it again, as GitHub's API allows from any site, so a release published
 * after the build shows up without a redeploy. Installer names carry the version (the
 * app's electron-builder `artifactName`), so links point at the release's own files.
 */
export const REPO = 'KubeStacks/KubeStacks'
export const LATEST_URL = `https://github.com/${REPO}/releases/latest`
export const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`

export type Arch = 'arm64' | 'x64'

export interface Asset {
  name: string
  url: string
  size: number
}

export interface Downloads {
  version: string
  /** The release's page, with its notes. */
  url: string
  date: string
  mac: { dmg: Partial<Record<Arch, Asset>>; zip: Partial<Record<Arch, Asset>> }
  windows: { exe?: Asset }
  linux: {
    appimage: Partial<Record<Arch, Asset>>
    deb: Partial<Record<Arch, Asset>>
    rpm: Partial<Record<Arch, Asset>>
  }
  sums?: Asset
}

export interface GithubRelease {
  tag_name: string
  html_url: string
  published_at: string
  assets: { name: string; browser_download_url: string; size: number }[]
}

const arch = (name: string): Arch => (name === 'arm64' || name === 'aarch64' ? 'arm64' : 'x64')

/** Sorts a release's files by platform, format and chip; anything else is left out. */
export function pick(release: GithubRelease): Downloads {
  const d: Downloads = {
    version: release.tag_name.replace(/^v/, ''),
    url: release.html_url,
    date: release.published_at,
    mac: { dmg: {}, zip: {} },
    windows: {},
    linux: { appimage: {}, deb: {}, rpm: {} },
  }
  for (const a of release.assets) {
    const asset = { name: a.name, url: a.browser_download_url, size: a.size }
    const mac = a.name.match(/-mac-(arm64|x64)\.(dmg|zip)$/)
    const linux = a.name.match(/-linux-(x86_64|amd64|arm64|aarch64)\.(AppImage|deb|rpm)$/)
    if (mac) d.mac[mac[2] as 'dmg' | 'zip'][arch(mac[1]!)] = asset
    else if (linux)
      d.linux[linux[2] === 'AppImage' ? 'appimage' : (linux[2] as 'deb' | 'rpm')][arch(linux[1]!)] =
        asset
    else if (a.name.endsWith('.exe')) d.windows.exe = asset
    else if (a.name === 'SHA256SUMS.txt') d.sums = asset
  }
  return d
}

/** The latest published release, or null when GitHub can't say (offline, rate-limited…). */
export async function fetchLatest(token?: string): Promise<Downloads | null> {
  try {
    const res = await fetch(API_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (!res.ok) return null
    const release = (await res.json()) as GithubRelease
    // The latest release is never a draft or a prerelease, but its files can still be uploading.
    if (release.assets.length === 0) return null
    return pick(release)
  } catch {
    return null
  }
}

/** A file of the release by its path in `Downloads`, such as `mac.dmg.arm64` or `sums`. */
export function assetAt(d: Downloads, path: string): Asset | undefined {
  let node: unknown = d
  for (const key of path.split('.')) node = (node as Record<string, unknown> | undefined)?.[key]
  return node as Asset | undefined
}

export const megabytes = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`

// What the page says about a release, with what it says when it couldn't find one: the
// build may run without reaching GitHub, and then the browser fills these in.

export const releasePage = (d: Downloads | null) => d?.url ?? LATEST_URL

export const releaseHeadline = (d: Downloads | null) =>
  d ? `Version ${d.version} is out` : 'Get the latest version'

export const versionTag = (d: Downloads | null) => d?.version ?? 'Latest'

/** A file's link, or the release's page where there's no such file. */
export const fileUrl = (d: Downloads | null, path: string) =>
  (d && assetAt(d, path))?.url ?? LATEST_URL

export function fileSize(d: Downloads | null, path: string, unknown = '') {
  const file = d && assetAt(d, path)
  return file ? megabytes(file.size) : unknown
}

export const releaseDay = (d: Downloads | null) =>
  d
    ? new Date(d.date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : ''
