/**
 * The cluster's colors. Pods take the app's status colors in both themes; the plate, the
 * nodes and their labels have a palette per theme.
 */
import type { Health } from '../../lib/icons'

export type RGB = [number, number, number]

export const STATUS: Record<Health, RGB> = {
  healthy: [44, 164, 72],
  progressing: [57, 135, 229],
  warning: [238, 168, 34],
  critical: [232, 72, 76],
  neutral: [112, 112, 122],
}

/** The dashed line and outline under a pod that can't be scheduled. */
export const UNSCHEDULED_LINE = 'rgba(250,178,25,0.6)'

export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

/** The color, darkened (f below 1) as a CSS color. */
export const shade = ([r, g, b]: RGB, f: number) =>
  `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`

/** The color, mixed with white by t, as a CSS color. */
export const lighten = (c: RGB, t: number) => {
  const [r, g, b] = mix(c, [255, 255, 255], t)
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
}

export const rgba = ([r, g, b]: RGB, alpha: number) => `rgba(${r},${g},${b},${alpha})`

export interface Palette {
  /** The two lower plates of the mark: gradient from, gradient to, back edges. */
  ghost: [string, string, string][]
  baseTop: [number, string][]
  baseLeft: string
  baseRight: string
  grid: string
  baseEdge: string
  clusterDot: string
  clusterName: string
  clusterMeta: string
  tileTop: string
  tileTopHot: string
  tileTopDown: string
  tileLeft: string
  tileRight: string
  tileEdge: string
  tileEdgeHot: string
  tileEdgeDown: string
  tileEdgeWarn: string
  nodeName: string
  conditionOk: string
  conditionWarn: string
  conditionDown: string
  meterTrack: string
  meterFill: string
  meterHot: string
  /** How glows mix in: light adds up on a dark plate; on a light one it would vanish. */
  glow: GlobalCompositeOperation
  glowAlpha: number
  shadow: RGB
  shadowAlpha: number
  hotOutline: string
}

export const PALETTES: Record<'dark' | 'light', Palette> = {
  dark: {
    ghost: [
      ['rgba(90,157,240,0.22)', 'rgba(30,86,176,0.10)', 'rgba(140,194,255,0.35)'],
      ['rgba(90,157,240,0.30)', 'rgba(30,86,176,0.14)', 'rgba(140,194,255,0.45)'],
    ],
    baseTop: [
      [0, '#1c2a4d'],
      [0.55, '#131c34'],
      [1, '#0d1326'],
    ],
    baseLeft: '#0b1122',
    baseRight: '#080c19',
    grid: 'rgba(140,194,255,0.05)',
    baseEdge: 'rgba(255,255,255,0.22)',
    clusterDot: 'rgba(63,185,80,1)',
    clusterName: 'rgba(242,242,244,0.78)',
    clusterMeta: 'rgba(161,161,170,0.6)',
    tileTop: '#181c29',
    tileTopHot: '#1d2233',
    tileTopDown: '#15161c',
    tileLeft: '#10131b',
    tileRight: '#0b0d14',
    tileEdge: 'rgba(255,255,255,0.09)',
    tileEdgeHot: 'rgba(255,255,255,0.2)',
    tileEdgeDown: 'rgba(248,81,73,0.55)',
    tileEdgeWarn: 'rgba(250,178,25,0.45)',
    nodeName: 'rgba(242,242,244,0.82)',
    conditionOk: 'rgba(139,139,148,0.85)',
    conditionWarn: 'rgba(227,160,8,0.95)',
    conditionDown: 'rgba(248,81,73,0.95)',
    meterTrack: 'rgba(57,135,229,0.16)',
    meterFill: 'rgba(57,135,229,0.95)',
    meterHot: 'rgba(250,178,25,0.95)',
    glow: 'lighter',
    glowAlpha: 0.42,
    shadow: [0, 0, 0],
    shadowAlpha: 0.35,
    hotOutline: 'rgba(255,255,255,0.55)',
  },
  light: {
    ghost: [
      ['rgba(42,120,214,0.12)', 'rgba(42,120,214,0.04)', 'rgba(42,120,214,0.28)'],
      ['rgba(42,120,214,0.18)', 'rgba(42,120,214,0.07)', 'rgba(42,120,214,0.38)'],
    ],
    baseTop: [
      [0, '#ffffff'],
      [0.55, '#f0f4fa'],
      [1, '#e4ebf6'],
    ],
    baseLeft: '#cfd9e8',
    baseRight: '#bdcbdf',
    grid: 'rgba(42,120,214,0.07)',
    baseEdge: 'rgba(42,120,214,0.3)',
    clusterDot: 'rgba(12,163,12,1)',
    clusterName: 'rgba(11,11,15,0.8)',
    clusterMeta: 'rgba(82,82,91,0.7)',
    tileTop: '#ffffff',
    tileTopHot: '#f2f7fe',
    tileTopDown: '#f3f3f5',
    tileLeft: '#dbe2ec',
    tileRight: '#c9d3e0',
    tileEdge: 'rgba(12,12,20,0.1)',
    tileEdgeHot: 'rgba(42,120,214,0.45)',
    tileEdgeDown: 'rgba(208,59,59,0.6)',
    tileEdgeWarn: 'rgba(214,150,0,0.6)',
    nodeName: 'rgba(11,11,15,0.82)',
    conditionOk: 'rgba(113,113,122,0.95)',
    conditionWarn: 'rgba(138,90,0,1)',
    conditionDown: 'rgba(180,35,24,1)',
    meterTrack: 'rgba(42,120,214,0.16)',
    meterFill: 'rgba(42,120,214,0.95)',
    meterHot: 'rgba(237,161,0,0.95)',
    glow: 'source-over',
    glowAlpha: 0.26,
    shadow: [12, 20, 40],
    shadowAlpha: 0.18,
    hotOutline: 'rgba(11,11,15,0.45)',
  },
}

/** The palette for the page's current theme. */
export const currentPalette = (): Palette =>
  PALETTES[document.documentElement.dataset.theme === 'light' ? 'light' : 'dark']
