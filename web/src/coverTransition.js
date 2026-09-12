let active = null
let origin = null

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function cancelCoverTransition () {
  if (!active) return
  const current = active
  active = null
  clearTimeout(current.timer)
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
  if (reducedMotion() || typeof Element.prototype.animate !== 'function') return
  const sourceImage = source?.querySelector('img.q-img__image')
  if (!sourceImage?.complete || !sourceImage.naturalWidth) return
  const rect = source.getBoundingClientRect()
  if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight) return

  const imageStyle = getComputedStyle(sourceImage)
  const overlay = document.createElement('div')
  overlay.className = 'work-cover-transition'
  overlay.setAttribute('aria-hidden', 'true')
  Object.assign(overlay.style, {
    position: 'fixed', pointerEvents: 'none', zIndex: '2900', overflow: 'hidden',
    left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
    borderRadius: '8px'
  })
  const image = document.createElement('img')
  image.src = sourceImage.currentSrc || sourceImage.src
  image.alt = ''
  Object.assign(image.style, {
    display: 'block', width: '100%', height: '100%', objectFit: imageStyle.objectFit,
    objectPosition: imageStyle.objectPosition, filter: imageStyle.filter
  })
  overlay.append(image)
  document.body.append(overlay)
  active = {
    id, destination, returning, source, sourceVisibility: source.style.visibility, overlay,
    timer: setTimeout(cancelCoverTransition, 220)
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
  if (active?.returning) findReturnCover(active)
  if (origin && to.fullPath !== origin.fullPath && to.path !== `/work/${origin.id}`) origin = null
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

  // Wait for the router's scroll restoration and the detail layout to settle.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  if (active !== current) return
  if (!target.isConnected || reducedMotion()) return cancelCoverTransition()
  const rect = target.getBoundingClientRect()
  if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight) return cancelCoverTransition()

  clearTimeout(current.timer)
  current.timer = setTimeout(cancelCoverTransition, 600)
  const start = current.overlay.style
  current.animation = current.overlay.animate([
    { left: start.left, top: start.top, width: start.width, height: start.height, borderRadius: start.borderRadius },
    { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: getComputedStyle(target).borderRadius }
  ], { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' })

  try {
    await current.animation.finished
    const image = target.querySelector('img.q-img__image')
    if (image && !image.complete) return cancelCoverTransition()
    if (active !== current) return
    target.style.visibility = current.targetVisibility
    current.animation = current.overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: 'forwards' })
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
