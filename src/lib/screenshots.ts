/**
 * The app's screenshots, straight from its repository, where `npm run screenshots` keeps every
 * screen up to date, light and dark. jsDelivr serves the repository's main branch (its cache
 * is cleared for each screenshot that changes), so the site shows the app as it is now without
 * being built again. Names never change. Each comes at 1440 × 900, and at twice that for
 * high-density screens.
 */
export const SCREENSHOTS =
  'https://cdn.jsdelivr.net/gh/KubeStacks/KubeStacks@main/docs/screenshots/'

export type Variant = 'dark' | 'light'

/** A screenshot's attributes for an <img>, by its name in the app's docs/screenshots. */
export function screenshot(name: string, variant: Variant) {
  const file = `${SCREENSHOTS}${name}-${variant}`
  return {
    src: `${file}-1x.webp`,
    srcset: `${file}-1x.webp 1440w, ${file}.webp 2880w`,
    width: 1440,
    height: 900,
  }
}

export const VARIANTS: readonly Variant[] = ['dark', 'light']
