let active = null
let origin = null

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function cancelCoverTransition () {
  if (!active) return
  const current = active
  active = null
  clearTimeout(current.timer)
  cancelAnimationFrame(current.positionFrame)
  current.animation?.cancel()
  current.overlay.remove()
  current.source.style.visibility = current.sourceVisibility
  if (current.target) current.target.style.visibility = current.targetVisibility
  window.removeEventListener('resize', cancelCoverTransition)
  window.removeEventListener('wheel', cancelCoverTransition)
  window.removeEventListener('touchmove', cancelCoverTransition)
}

export function prepareCoverTransition (event) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  if (event.target.closest('[data-no-cover-transition], [role="button"], button')) return
  const link = event.target.closest('a[href]')
  if (!link || link.target === '_blank' || link.hasAttribute('download')) return
  const url = new URL(link.href, window.location.href)
  const match = url.pathname.match(/^\/work\/(\d+)$/)
  if (!match || url.origin !== window.location.origin || url.pathname === window.location.pathname) return

  const card = link.closest('.q-card, .q-item')
  const source = card?.querySelector('.q-img')
  if (beginCoverTransition(source, match[1], url.pathname)) {
    origin = { id: match[1], fullPath: window.location.pathname + window.location.search + window.location.hash, source }
  }
}

function beginCoverTransition (source, id, destination, returning = false) {
  cancelCoverTransition()
  if (reducedMotion()) return
  const sourceImage = source?.querySelector('img.q-img__image')
  if (!sourceImage?.complete || !sourceImage.naturalWidth) return
  const rect = source.getBoundingClientRect()
  if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight) return

  const imageStyle = getComputedStyle(sourceImage)
  const sourceRadius = getComputedStyle(source).borderRadius || '8px'
  const overlay = document.createElement('div')
  overlay.className = 'work-cover-transition'
  overlay.setAttribute('aria-hidden', 'true')
  Object.assign(overlay.style, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: '2900',
    overflow: 'hidden',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: sourceRadius,
    transformOrigin: 'top left',
    willChange: 'transform, opacity'
  })
  const image = document.createElement('img')
  image.src = sourceImage.currentSrc || sourceImage.src
  image.alt = ''
  Object.assign(image.style, {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: imageStyle.objectFit,
    objectPosition: imageStyle.objectPosition,
    filter: imageStyle.filter
  })
  overlay.append(image)
  document.body.append(overlay)
  active = {
    id,
    destination,
    returning,
    source,
    sourceVisibility: source.style.visibility,
    startRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    overlay,
    scrollReady: false,
    timer: setTimeout(cancelCoverTransition, 800)
  }
  source.style.visibility = 'hidden'
  window.addEventListener('resize', cancelCoverTransition, { passive: true })
  window.addEventListener('wheel', cancelCoverTransition, { passive: true })
  window.addEventListener('touchmove', cancelCoverTransition, { passive: true })
  return true
}

export function prepareReturnCoverTransition (to, from) {
  if (!origin || from.path !== `/work/${origin.id}` || to.fullPath !== origin.fullPath) return
  beginCoverTransition(document.querySelector('.work-details .work-cover'), origin.id, to.fullPath, true)
}

export function checkCoverTransitionRoute (to, from, failure) {
  if (active && (failure || (active.returning ? to.fullPath : to.path) !== active.destination)) cancelCoverTransition()
  if (origin && to.fullPath !== origin.fullPath && to.path !== `/work/${origin.id}`) origin = null
}

export function coverTransitionScrollReady (to) {
  if (!active || (active.returning ? to.fullPath : to.path) !== active.destination) return
  active.scrollReady = true
  if (active.returning) findReturnCover(active)
}

function findReturnCover (current) {
  // Cached lists reactivate before scroll restoration; other lists may fetch again.
  requestAnimationFrame(() => {
    if (active !== current) return
    const original = origin?.source
    const target = original?.isConnected ? original : [...document.querySelectorAll(`.q-layout a[href="/work/${current.id}"]`)]
      .map(link => link.closest('.q-card, .q-item')?.querySelector('.q-img'))
      .find(Boolean)
    if (target) finishCoverTransition(current.id, target)
    else findReturnCover(current)
  })
}

export async function finishCoverTransition (id, target) {
  const current = active
  if (!current || current.id !== String(id) || current.target) return
  current.target = target
  current.targetVisibility = target.style.visibility
  target.style.visibility = 'hidden'

  // Forward navigation mounts the detail cover immediately at its destination;
  // return navigation to cached/virtual lists waits for scroll restoration to settle.
  const requiredStableFrames = current.returning ? 2 : 1
  let previousRect = null
  let stableFrames = 0
  while (active === current && stableFrames < requiredStableFrames) {
    await new Promise(resolve => requestAnimationFrame(resolve))
    const nextRect = target.getBoundingClientRect()
    if (!current.returning) {
      if (current.scrollReady && nextRect.width > 0 && nextRect.height > 0) stableFrames = 1
    } else {
      const unchanged = previousRect && ['left', 'top', 'width', 'height'].every(key => Math.abs(nextRect[key] - previousRect[key]) < 0.5)
      stableFrames = current.scrollReady && unchanged ? stableFrames + 1 : 0
      previousRect = nextRect
    }
  }
  if (active !== current) return
  if (!target.isConnected) return cancelCoverTransition()
  const rect = target.getBoundingClientRect()
  if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight) return cancelCoverTransition()

  clearTimeout(current.timer)
  current.timer = setTimeout(cancelCoverTransition, 600)

  const targetRadius = getComputedStyle(target).borderRadius || '8px'
  const dx = current.startRect.left - rect.left
  const dy = current.startRect.top - rect.top
  const sx = current.startRect.width / rect.width
  const sy = current.startRect.height / rect.height

  // Position overlay at destination and FLIP via GPU-composited transform only.
  Object.assign(current.overlay.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: targetRadius
  })

  // Follow layout shifts during flight (e.g. async metadata load) instead of aborting.
  const trackedRect = { left: rect.left, top: rect.top }
  const syncPosition = () => {
    if (active !== current) return
    if (!target.isConnected) return cancelCoverTransition()
    const latest = target.getBoundingClientRect()
    if (Math.abs(latest.left - trackedRect.left) > 0.5 || Math.abs(latest.top - trackedRect.top) > 0.5) {
      trackedRect.left = latest.left
      trackedRect.top = latest.top
      current.overlay.style.left = `${latest.left}px`
      current.overlay.style.top = `${latest.top}px`
    }
    current.positionFrame = requestAnimationFrame(syncPosition)
  }
  current.positionFrame = requestAnimationFrame(syncPosition)

  current.animation = current.overlay.animate([
    { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})` },
    { transform: 'translate3d(0, 0, 0) scale(1, 1)' }
  ], { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' })

  try {
    await current.animation.finished
    if (active !== current) return
    target.style.visibility = current.targetVisibility
    current.animation = current.overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 90, fill: 'forwards' })
    await current.animation.finished
  } catch {
    // Cancellation also restores both covers.
  } finally {
    if (active === current) cancelCoverTransition()
  }
}

export const coverTransition = {
  mounted: (element, binding) => { if (!active?.returning) finishCoverTransition(binding.value, element) },
  updated: (element, binding) => { if (!active?.returning) finishCoverTransition(binding.value, element) },
  beforeUnmount: element => {
    if (active?.target === element) cancelCoverTransition()
  }
}

if (import.meta.hot) import.meta.hot.dispose(cancelCoverTransition)
