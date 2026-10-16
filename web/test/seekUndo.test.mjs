import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import test, { before } from 'node:test'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const localStorageStub = 'const LocalStorage = { has: () => false, getItem: () => null, set: () => {}, remove: () => {} }'
let mutations
let getters

before(async () => {
  const gettersUrl = moduleUrl(await readFile(new URL('../src/store/module-AudioPlayer/getters.js', import.meta.url), 'utf8'))
  const stateUrl = moduleUrl((await readFile(new URL('../src/store/module-AudioPlayer/state.js', import.meta.url), 'utf8'))
    .replace("import { LocalStorage } from 'quasar'", localStorageStub))
  const mutationsUrl = moduleUrl((await readFile(new URL('../src/store/module-AudioPlayer/mutations.js', import.meta.url), 'utf8'))
    .replace("import { LocalStorage } from 'quasar'", localStorageStub)
    .replace("'./getters'", JSON.stringify(gettersUrl))
    .replace("'./state'", JSON.stringify(stateUrl)))
  mutations = (await import(mutationsUrl)).default
  getters = (await import(gettersUrl)).default
})

function playerState () {
  return {
    queue: [{ hash: '1/track.mp3' }],
    queueIndex: 0,
    duration: 600,
    currentTime: 90.6,
    newCurrentTime: -1,
    seekUndo: [],
    seekRedo: [],
    seekUndoHash: '',
    seekOrigin: null,
    seekCause: 'automatic',
  }
}

function hydrate (state, seconds, snapshot = state.seekUndo) {
  mutations.HYDRATE_SEEK_UNDO(state, {
    hash: '1/track.mp3',
    positions: seconds.map((value, index) => ({ id: seconds.length - index, seconds: value })),
    snapshot,
  })
}

test('each press restores the preceding saved position without toggling back to the departure point', () => {
  const state = playerState()
  hydrate(state, [90.5, 90, 60, '20', null, '', -1, Infinity, 'invalid'])
  assert.equal(getters.canUndoSeek(state), true)

  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, 60)
  assert.equal(state.seekCause, 'undo')
  state.currentTime = 60
  mutations.SET_NEW_CURRENT_TIME(state, -1)
  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, 20)
  assert.equal(getters.canUndoSeek(state), false)
  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, 20)
})

test('saved positions and locally captured departures form one continuous history', () => {
  const state = playerState()
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 120, from: 90 })
  state.currentTime = 120
  mutations.SET_NEW_CURRENT_TIME(state, -1)
  hydrate(state, [120, 90, 60, 20])

  const restored = []
  while (getters.canUndoSeek(state)) {
    mutations.UNDO_SEEK(state)
    restored.push(state.newCurrentTime)
  }
  assert.deepEqual(restored, [90, 60, 20])
})

test('whole-second saves overlap precise local departures without restoring the same point twice', () => {
  const state = playerState()
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 120, from: 90.6 })
  state.currentTime = 120
  mutations.SET_NEW_CURRENT_TIME(state, -1)
  hydrate(state, [120, 90, 60, 20])

  const restored = []
  while (getters.canUndoSeek(state)) {
    mutations.UNDO_SEEK(state)
    restored.push(state.newCurrentTime)
  }
  assert.deepEqual(restored, [90.6, 60, 20])
})

test('positions beyond the current duration are discarded when a file becomes shorter', () => {
  const state = playerState()
  state.seekUndo = [900]
  state.seekUndoHash = '1/track.mp3'
  hydrate(state, [900, 60, 20])

  const restored = []
  while (getters.canUndoSeek(state)) {
    mutations.UNDO_SEEK(state)
    restored.push(state.newCurrentTime)
  }
  assert.equal(state.duration, 600)
  assert.deepEqual(restored, [60, 20])
})

test('a response arriving after an undo cannot restore an already consumed record', () => {
  const state = playerState()
  hydrate(state, [60, 20])
  const snapshot = state.seekUndo
  mutations.UNDO_SEEK(state)
  assert.deepEqual(state.seekRedo, [90.6])
  hydrate(state, [60, 20], snapshot)
  assert.deepEqual(state.seekRedo, [90.6])
  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, 20)
  assert.equal(getters.canUndoSeek(state), false)
})

test('manual seeks made during a history request remain available without importing stale records', () => {
  const state = playerState()
  const snapshot = state.seekUndo
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 120, from: 90 })
  hydrate(state, [60, 20], snapshot)
  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, 90)
  assert.equal(getters.canUndoSeek(state), false)
})

test('a changed track or cleared user history rejects old requests and disables stale undo', () => {
  const state = playerState()
  hydrate(state, [60, 20])
  const snapshot = state.seekUndo
  state.queue = [{ hash: '2/other.mp3' }]
  assert.equal(getters.canUndoSeek(state), false)
  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, -1)
  hydrate(state, [45], snapshot)
  assert.deepEqual(state.seekUndo, [20, 60])

  state.queue = [{ hash: '1/track.mp3' }]
  mutations.CLEAR_SEEK_UNDO(state)
  hydrate(state, [60, 20], snapshot)
  assert.equal(getters.canUndoSeek(state), false)
  assert.deepEqual(state.seekUndo, [])
})

test('history keeps the most recent 100 positions for both saved records and new seeks', () => {
  const state = playerState()
  state.currentTime = 300
  hydrate(state, Array.from({ length: 120 }, (_, index) => 120 - index))
  assert.equal(state.seekUndo.length, 100)
  assert.equal(state.seekUndo[0], 21)
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 400, from: 300 })
  assert.equal(state.seekUndo.length, 100)
  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, 300)
  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, 120)
})

function finishSeek (state) {
  state.currentTime = state.newCurrentTime
  mutations.SET_NEW_CURRENT_TIME(state, -1)
}

test('undo and redo traverse A to B to C in both directions and disable exhausted actions', () => {
  const state = playerState()
  state.currentTime = 10
  assert.equal(getters.canUndoSeek(state), false)
  assert.equal(getters.canRedoSeek(state), false)
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 20 })
  finishSeek(state)
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 30 })
  finishSeek(state)
  assert.equal(getters.canUndoSeek(state), true)
  assert.equal(getters.canRedoSeek(state), false)

  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, 20)
  finishSeek(state)
  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, 10)
  finishSeek(state)
  assert.equal(getters.canUndoSeek(state), false)
  assert.equal(getters.canRedoSeek(state), true)
  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, -1)

  mutations.REDO_SEEK(state)
  assert.equal(state.newCurrentTime, 20)
  assert.equal(state.seekCause, 'redo')
  finishSeek(state)
  mutations.REDO_SEEK(state)
  assert.equal(state.newCurrentTime, 30)
  finishSeek(state)
  assert.equal(getters.canUndoSeek(state), true)
  assert.equal(getters.canRedoSeek(state), false)
  mutations.REDO_SEEK(state)
  assert.equal(state.newCurrentTime, -1)
})

test('rapid seeks, undo and redo use pending targets before the media reports its position', () => {
  const state = playerState()
  state.currentTime = 10
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 20 })
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 30 })
  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, 20)
  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, 10)
  mutations.REDO_SEEK(state)
  assert.equal(state.newCurrentTime, 20)
  mutations.REDO_SEEK(state)
  assert.equal(state.newCurrentTime, 30)
  assert.equal(state.currentTime, 10)
})

test('a new seek after undo replaces the redo branch while an unchanged or invalid seek preserves it', () => {
  const state = playerState()
  state.currentTime = 10
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 20 })
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 30 })
  mutations.UNDO_SEEK(state)
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 20 })
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: NaN })
  assert.equal(getters.canRedoSeek(state), true)
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 40 })
  assert.equal(getters.canRedoSeek(state), false)
  mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, 20)
  mutations.REDO_SEEK(state)
  assert.equal(state.newCurrentTime, 40)
})

test('redo is isolated from other files and clearing discards both directions and pending history loads', () => {
  const state = playerState()
  state.currentTime = 10
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 20 })
  const snapshot = state.seekUndo
  mutations.UNDO_SEEK(state)
  state.queue = [{ hash: '2/other.mp3' }]
  assert.equal(getters.canUndoSeek(state), false)
  assert.equal(getters.canRedoSeek(state), false)
  mutations.REDO_SEEK(state)
  assert.equal(state.newCurrentTime, 10)

  state.currentTime = 5
  mutations.SET_NEW_CURRENT_TIME(state, -1)
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 8 })
  assert.deepEqual(state.seekUndo, [5])
  assert.deepEqual(state.seekRedo, [])
  mutations.UNDO_SEEK(state)
  assert.equal(getters.canRedoSeek(state), true)
  mutations.CLEAR_SEEK_UNDO(state)
  state.queue = [{ hash: '1/track.mp3' }]
  hydrate(state, [60, 20], snapshot)
  assert.equal(getters.canUndoSeek(state), false)
  assert.equal(getters.canRedoSeek(state), false)
  assert.deepEqual(state.seekUndo, [])
  assert.deepEqual(state.seekRedo, [])
})

test('a full undo and redo cycle keeps only the latest 100 departures in each direction', () => {
  const state = playerState()
  state.currentTime = 0
  for (let seconds = 1; seconds <= 120; seconds++) mutations.REQUEST_MANUAL_SEEK(state, { seconds })
  assert.equal(state.seekUndo.length, 100)
  while (getters.canUndoSeek(state)) mutations.UNDO_SEEK(state)
  assert.equal(state.newCurrentTime, 20)
  assert.equal(state.seekRedo.length, 100)
  while (getters.canRedoSeek(state)) mutations.REDO_SEEK(state)
  assert.equal(state.newCurrentTime, 120)
  assert.equal(state.seekUndo.length, 100)
  assert.equal(state.seekRedo.length, 0)
})

test('clearing cancels pending manual, undo and redo targets before the media applies them', () => {
  for (const action of ['manual', 'undo', 'redo']) {
    const state = playerState()
    state.currentTime = 10
    mutations.REQUEST_MANUAL_SEEK(state, { seconds: 20 })
    if (action !== 'manual') mutations.UNDO_SEEK(state)
    if (action === 'redo') mutations.REDO_SEEK(state)
    assert.equal(state.seekCause, action)
    assert.equal(state.newCurrentTime >= 0, true)

    state.queue = [{ hash: '2/other.mp3' }]
    mutations.CLEAR_SEEK_UNDO(state)
    assert.equal(state.newCurrentTime, -1)
    assert.equal(state.seekCause, 'automatic')
    assert.equal(getters.canUndoSeek(state), false)
    assert.equal(getters.canRedoSeek(state), false)
  }
})

test('clearing preserves a pending automatic restore target after a manual seek', () => {
  const state = playerState()
  mutations.REQUEST_MANUAL_SEEK(state, { seconds: 20 })
  mutations.SET_NEW_CURRENT_TIME(state, 45)
  state.queue = [{ hash: '2/other.mp3' }]
  mutations.CLEAR_SEEK_UNDO(state)
  assert.equal(state.newCurrentTime, 45)
  assert.equal(state.seekCause, 'automatic')
  assert.deepEqual(state.seekUndo, [])
  assert.deepEqual(state.seekRedo, [])
})
