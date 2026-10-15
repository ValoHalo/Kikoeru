export function parseClipTime (value) {
  const text = String(value).trim()
  if (!/^\d+(?::\d{1,2}){0,2}(?:\.\d{1,3})?$/.test(text)) return NaN
  const parts = text.split(':').map(Number)
  if (parts.length > 1 && parts[parts.length - 1] >= 60) return NaN
  if (parts.length === 3 && parts[1] >= 60) return NaN
  return parts.reduce((seconds, part) => seconds * 60 + part, 0)
}

export function formatClipTime (seconds) {
  const milliseconds = Math.max(0, Math.round((Number(seconds) || 0) * 1000))
  const minutes = Math.floor(milliseconds / 60000)
  const remainder = ((milliseconds % 60000) / 1000).toFixed(3).replace(/\.?0+$/, '')
  return `${String(minutes).padStart(2, '0')}:${Number(remainder) < 10 ? '0' : ''}${remainder || '0'}`
}

export function validClipRange (start, end, duration = Infinity) {
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= Math.round(duration * 1000) / 1000
}
