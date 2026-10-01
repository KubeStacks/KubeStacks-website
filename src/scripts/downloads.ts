/**
 * Download links: the visitor's platform and chip pick the file the hero offers, and a
 * release published after the site was built replaces the one it was built with.
 */
import {
  assetAt,
  fetchLatest,
  megabytes,
  releaseDay,
  releaseHeadline,
  type Arch,
  type Downloads,
} from '../lib/releases'

type OS = 'mac' | 'windows' | 'linux'

interface UserAgentData {
  platform: string
  mobile: boolean
  getHighEntropyValues(hints: string[]): Promise<{ architecture?: string }>
}

const userAgentData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData

/** Phones and tablets get no installer: the hero sends them to the download section. */
function detectOS(): OS | null {
  const ua = navigator.userAgent
  if (userAgentData?.mobile || /Android|iPhone|iPad|iPod/.test(ua)) return null
  // iPads ask for desktop sites as Macs; a touch screen gives them away.
  if (ua.includes('Macintosh') && navigator.maxTouchPoints > 1) return null
  const platform = (userAgentData?.platform ?? navigator.platform).toLowerCase()
  if (platform.startsWith('mac')) return 'mac'
  if (platform.startsWith('win')) return 'windows'
  if (/linux|x11|cros|chrome os/.test(platform)) return 'linux'
  return null
}

/**
 * Chromium browsers say which chip they run on. Others don't: there, a Mac whose graphics
 * aren't Apple's is an Intel Mac, and other Macs get Apple silicon, as most Macs now are.
 */
async function detectArch(os: OS): Promise<Arch> {
  const architecture = await userAgentData?.getHighEntropyValues(['architecture']).then(
    (v) => v.architecture,
    () => undefined,
  )
  if (architecture === 'arm') return 'arm64'
  if (architecture === 'x86') return 'x64'
  if (os === 'mac') {
    const gl = document.createElement('canvas').getContext('webgl')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? String(gl!.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    return /intel|amd|radeon|nvidia/i.test(renderer) ? 'x64' : 'arm64'
  }
  return /aarch64|arm64/i.test(navigator.userAgent) ? 'arm64' : 'x64'
}

/** Points every link and size on the page at this release. */
function showRelease(d: Downloads) {
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-dl]')) {
    const file = assetAt(d, a.dataset.dl!)
    if (file) a.href = file.url
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-dl-size]')) {
    const file = assetAt(d, el.dataset.dlSize!)
    if (file) el.textContent = megabytes(file.size)
  }
  for (const el of document.querySelectorAll('[data-dl-version]')) el.textContent = d.version
  for (const el of document.querySelectorAll('[data-dl-headline]'))
    el.textContent = releaseHeadline(d)
  for (const el of document.querySelectorAll('[data-dl-date]')) el.textContent = releaseDay(d)
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-dl-notes]')) a.href = d.url
  document.querySelector<HTMLElement>('[data-dl-status]')!.hidden = false
  document.querySelector<HTMLElement>('[data-dl-fallback]')!.hidden = true
}

const NAMES: Record<OS, string> = { mac: 'macOS', windows: 'Windows', linux: 'Linux' }

const FILES: Record<OS, (arch: Arch) => { path: string; what: string; others: string }> = {
  mac: (arch) => ({
    path: `mac.dmg.${arch}`,
    what: arch === 'arm64' ? 'For Apple silicon' : 'For Intel Macs',
    others: arch === 'arm64' ? 'Intel and other platforms' : 'Apple silicon and other platforms',
  }),
  windows: () => ({ path: 'windows.exe', what: 'For x64 and arm64', others: 'Other platforms' }),
  linux: (arch) => ({
    path: `linux.appimage.${arch}`,
    what: `AppImage for ${arch}`,
    others: '.deb, .rpm and other platforms',
  }),
}

/** The hero button, and the matching file in the download section, for this computer. */
function showVisitor(d: Downloads | null, os: OS, arch: Arch) {
  const { path, what, others } = FILES[os](arch)
  const card = document.querySelector(`[data-platform="${os}"]`)!
  card.toggleAttribute('data-yours', true)
  for (const a of card.querySelectorAll<HTMLElement>('[data-dl]')) {
    a.toggleAttribute('data-pick', a.dataset.dl === path)
  }
  const file = d && assetAt(d, path)
  if (!file) return
  document.querySelector<HTMLAnchorElement>('[data-hero-download]')!.href = file.url
  document.querySelector('[data-hero-label]')!.textContent = `Download for ${NAMES[os]}`
  const note = document.querySelector<HTMLElement>('[data-hero-note]')!
  note.innerHTML = `${what}, ${megabytes(file.size)}. <a href="#download">${others}</a>`
  note.hidden = false
}

export async function mountDownloads() {
  const built = JSON.parse(
    document.getElementById('downloads-data')!.textContent!,
  ) as Downloads | null
  const os = detectOS()
  const arch = os && (await detectArch(os))
  if (os) showVisitor(built, os, arch!)

  // A newer release than the build knew about: switch everything over to it.
  const fresh = await fetchLatest()
  if (!fresh || fresh.version === built?.version) return
  showRelease(fresh)
  if (os) showVisitor(fresh, os, arch!)
}

void mountDownloads()
