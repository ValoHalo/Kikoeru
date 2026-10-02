import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import test from 'node:test'
import { bindTooltipTrigger, TOOLTIP_DELAY, TOOLTIP_TOUCH_HIDE_DELAY } from '../src/utils/tooltipTrigger.mjs'

function fixture (t) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const document = new EventTarget()
  document.defaultView = new EventTarget()
  const anchor = new EventTarget()
  Object.assign(anchor, {
    ownerDocument: document,
    isConnected: true,
    disabled: false,
    keyboardFocus: false,
    matches (selector) { return selector === ':focus-visible' ? this.keyboardFocus : this.disabled },
    contains (target) { return target === this }
  })
  const events = []
  const dispose = bindTooltipTrigger(anchor, {
    show: event => events.push(['show', event.type]),
    hide: () => events.push(['hide'])
  })
  t.after(dispose)
  const fire = (target, type, values = {}) => {
    const event = new Event(type, { cancelable: true })
    Object.assign(event, { pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 20, clientY: 20, detail: 1 }, values)
    target.dispatchEvent(event)
    return event
  }
  const hover = () => fire(anchor, 'pointerenter', { pointerType: 'mouse' })
  const press = () => {
    fire(document, 'pointerdown')
    fire(anchor, 'pointerdown')
  }
  return { anchor, document, events, dispose, fire, hover, press }
}

test('hover waits and leaving, clicking or scrolling cancels a pending tooltip', t => {
  const f = fixture(t)
  for (const [target, type] of [[f.anchor, 'pointerleave'], [f.anchor, 'click'], [f.document, 'scroll']]) {
    f.hover()
    t.mock.timers.tick(TOOLTIP_DELAY - 1)
    assert.deepEqual(f.events, [])
    f.fire(target, type)
    t.mock.timers.tick(TOOLTIP_DELAY)
    assert.deepEqual(f.events, [])
  }
  f.hover()
  t.mock.timers.tick(TOOLTIP_DELAY)
  assert.deepEqual(f.events, [['show', 'pointerenter']])
  f.fire(f.anchor, 'pointerleave')
  assert.deepEqual(f.events.at(-1), ['hide'])
})

test('short taps still activate controls without showing a tooltip', t => {
  const f = fixture(t)
  f.fire(f.anchor, 'pointerenter')
  t.mock.timers.tick(TOOLTIP_DELAY)
  assert.deepEqual(f.events, [])
  f.press()
  t.mock.timers.tick(100)
  f.fire(f.document, 'pointerup')
  const click = f.fire(f.anchor, 'click')
  assert.equal(click.defaultPrevented, false)
  t.mock.timers.tick(TOOLTIP_DELAY)
  assert.deepEqual(f.events, [])
})

test('long press shows a readable tooltip and suppresses only the release click', t => {
  const f = fixture(t)
  f.press()
  t.mock.timers.tick(TOOLTIP_DELAY - 1)
  assert.deepEqual(f.events, [])
  // Small finger movements should not cancel the hold.
  f.fire(f.document, 'pointermove', { clientX: 23, clientY: 24 })
  t.mock.timers.tick(1)
  assert.deepEqual(f.events, [['show', 'pointerdown']])
  f.fire(f.document, 'pointerup')
  assert.equal(f.fire(f.anchor, 'click').defaultPrevented, true)
  t.mock.timers.tick(TOOLTIP_TOUCH_HIDE_DELAY - 1)
  assert.equal(f.events.length, 1)
  t.mock.timers.tick(1)
  assert.deepEqual(f.events.at(-1), ['hide'])
  f.press()
  f.fire(f.document, 'pointerup')
  assert.equal(f.fire(f.anchor, 'click').defaultPrevented, false)
})

test('dragging, cancelled gestures and additional fingers cancel long press', t => {
  const f = fixture(t)
  for (const [type, values] of [
    ['pointermove', { clientX: 40 }],
    ['pointercancel', {}],
    ['pointerdown', { pointerId: 2, isPrimary: false }],
    ['scroll', {}]
  ]) {
    f.press()
    f.fire(f.document, type, values)
    t.mock.timers.tick(TOOLTIP_DELAY)
    assert.deepEqual(f.events, [])
    assert.equal(getEventListeners(f.document, 'pointermove').length, 0)
  }
})

test('keyboard focus is delayed and Escape dismisses without blocking keyboard clicks', t => {
  const f = fixture(t)
  f.anchor.keyboardFocus = true
  f.fire(f.anchor, 'focusin')
  t.mock.timers.tick(TOOLTIP_DELAY)
  assert.deepEqual(f.events, [['show', 'focusin']])
  f.fire(f.document, 'keydown', { key: 'Escape' })
  assert.deepEqual(f.events.at(-1), ['hide'])
  f.press()
  t.mock.timers.tick(TOOLTIP_DELAY)
  assert.equal(f.fire(f.anchor, 'click', { detail: 0 }).defaultPrevented, false)
})

test('disabled, detached and disposed triggers cannot show delayed tooltips', t => {
  const f = fixture(t)
  f.hover()
  f.anchor.disabled = true
  t.mock.timers.tick(TOOLTIP_DELAY)
  f.anchor.disabled = false
  f.press()
  f.anchor.isConnected = false
  t.mock.timers.tick(TOOLTIP_DELAY)
  f.anchor.isConnected = true
  f.hover()
  f.dispose()
  t.mock.timers.tick(TOOLTIP_DELAY)
  f.hover()
  t.mock.timers.tick(TOOLTIP_DELAY)
  assert.deepEqual(f.events, [])
  assert.equal(getEventListeners(f.document, 'pointerdown').length, 0)
  assert.equal(getEventListeners(f.anchor, 'pointerenter').length, 0)
})
