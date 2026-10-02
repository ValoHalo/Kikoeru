export const TOOLTIP_DELAY = 600
export const TOOLTIP_TOUCH_HIDE_DELAY = 1200

export function bindTooltipTrigger (anchor, { show, hide, delay = TOOLTIP_DELAY }) {
  const document = anchor.ownerDocument
  const window = document.defaultView
  let timer
  let touch
  let showing = false
  let suppressClick = false

  function cancel () {
    clearTimeout(timer)
    timer = undefined
    touch = undefined
    document.removeEventListener('pointerdown', onDocumentPointerDown, { capture: true })
    document.removeEventListener('pointermove', onPointerMove, { capture: true })
    document.removeEventListener('pointerup', onPointerUp, { capture: true })
    document.removeEventListener('pointercancel', cancel, { capture: true })
    document.removeEventListener('scroll', cancel, { capture: true })
    document.removeEventListener('keydown', onKeyDown, { capture: true })
    window?.removeEventListener('blur', cancel)
    if (showing) {
      showing = false
      hide()
    }
  }

  function schedule (event) {
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    document.addEventListener('scroll', cancel, { capture: true, passive: true })
    document.addEventListener('keydown', onKeyDown, true)
    window?.addEventListener('blur', cancel)
    timer = setTimeout(() => {
      timer = undefined
      if (!anchor.isConnected || anchor.matches(':disabled, [aria-disabled="true"]')) {
        cancel()
        return
      }
      showing = true
      if (touch) suppressClick = true
      show(event)
    }, delay)
  }

  function onPointerEnter (event) {
    if (event.pointerType === 'touch') return
    cancel()
    schedule(event)
  }

  function onPointerLeave () {
    if (!touch) cancel()
  }

  function onPointerDown (event) {
    cancel()
    suppressClick = false
    if (!['touch', 'pen'].includes(event.pointerType) || event.isPrimary === false) return
    touch = { id: event.pointerId, x: event.clientX, y: event.clientY }
    document.addEventListener('pointermove', onPointerMove, { capture: true, passive: true })
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('pointercancel', cancel, true)
    schedule(event)
  }

  function onDocumentPointerDown (event) {
    if (!touch || event.pointerId !== touch.id) cancel()
  }

  function onPointerMove (event) {
    if (touch && event.pointerId === touch.id &&
        Math.hypot(event.clientX - touch.x, event.clientY - touch.y) >= 10) {
      cancel()
    }
  }

  function onPointerUp (event) {
    if (!touch || event.pointerId !== touch.id) return
    touch = undefined
    if (!showing) {
      cancel()
      return
    }
    document.removeEventListener('pointermove', onPointerMove, { capture: true })
    document.removeEventListener('pointerup', onPointerUp, { capture: true })
    document.removeEventListener('pointercancel', cancel, { capture: true })
    timer = setTimeout(cancel, TOOLTIP_TOUCH_HIDE_DELAY)
  }

  function onClick (event) {
    // Keep the release after a long press from activating the button or link.
    if (suppressClick && event.detail !== 0) {
      suppressClick = false
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    suppressClick = false
    cancel()
  }

  function onContextMenu (event) {
    if (touch || suppressClick) event.preventDefault()
  }

  function onFocusIn (event) {
    if (!touch && event.target.matches(':focus-visible')) {
      cancel()
      schedule(event)
    }
  }

  function onFocusOut (event) {
    if (!anchor.contains(event.relatedTarget)) cancel()
  }

  function onKeyDown (event) {
    if (event.key === 'Escape') cancel()
  }

  const listeners = {
    pointerenter: onPointerEnter,
    pointerleave: onPointerLeave,
    pointerdown: onPointerDown,
    click: onClick,
    contextmenu: onContextMenu,
    focusin: onFocusIn,
    focusout: onFocusOut
  }
  for (const [name, listener] of Object.entries(listeners)) {
    const capture = name !== 'pointerenter' && name !== 'pointerleave'
    anchor.addEventListener(name, listener, { capture })
  }

  return () => {
    cancel()
    for (const [name, listener] of Object.entries(listeners)) {
      const capture = name !== 'pointerenter' && name !== 'pointerleave'
      anchor.removeEventListener(name, listener, { capture })
    }
  }
}
