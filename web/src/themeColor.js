import { colors, setCssVar } from 'quasar'

export const DEFAULT_ACCENT_COLOR = '#1976D2'
export const ACCENT_COLOR_KEY = 'kikoeru-accent-color'
export const ACCENT_COLOR_EVENT = 'kikoeru-accent-color-change'
const RGB_HEX_PATTERN = /^#?[0-9a-f]{6}$/i
let activeAccentColor = DEFAULT_ACCENT_COLOR

function readableAccent (color, background, direction) {
  const backgroundLuminance = colors.luminosity(background)
  for (let amount = 0; amount <= 100; amount += 5) {
    const candidate = colors.lighten(color, amount * direction)
    const luminance = colors.luminosity(candidate)
    const contrast = (Math.max(luminance, backgroundLuminance) + 0.05) / (Math.min(luminance, backgroundLuminance) + 0.05)
    if (contrast >= 4.5) return candidate
  }
}

export function normalizeAccentColor (value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!RGB_HEX_PATTERN.test(trimmed)) return null
  return `#${trimmed.replace(/^#/, '').toUpperCase()}`
}

export function readAccentColor () {
  return normalizeAccentColor(window.localStorage.getItem(ACCENT_COLOR_KEY)) || activeAccentColor
}

export function hasSavedAccentColor () {
  return normalizeAccentColor(window.localStorage.getItem(ACCENT_COLOR_KEY)) !== null
}

export function applyAccentColor (value, { persist = true } = {}) {
  const next = normalizeAccentColor(value) || DEFAULT_ACCENT_COLOR
  const hex = next.slice(1)
  const rgb = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16)).join(', ')

  activeAccentColor = next
  setCssVar('primary', next)
  setCssVar('accent', next)
  document.documentElement.style.setProperty('--kikoeru-accent-rgb', rgb)
  // Keep the chosen fill color; adjust foregrounds to meet text contrast.
  document.documentElement.style.setProperty('--kikoeru-on-accent', colors.luminosity(next) > 0.179 ? '#000000' : '#ffffff')
  document.documentElement.style.setProperty('--kikoeru-accent-text-light', readableAccent(next, '#ededed', -1))
  document.documentElement.style.setProperty('--kikoeru-accent-text-dark', readableAccent(next, '#333333', 1))
  if (persist) window.localStorage.setItem(ACCENT_COLOR_KEY, next)
  window.dispatchEvent(new CustomEvent(ACCENT_COLOR_EVENT, { detail: { color: next, persist } }))
  return next
}
