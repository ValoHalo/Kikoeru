import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test, { before } from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const { parse, compileScript } = require('@vue/compiler-sfc')
const components = {}
const mediaHandlers = new Map()

async function loadComponent (name) {
  const filename = new URL(`../src/components/${name}.vue`, import.meta.url)
  const { descriptor, errors } = parse(await readFile(filename, 'utf8'), { filename: filename.pathname })
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: name })
  const imports = {
    mapState: () => ({}),
    mapGetters: () => ({}),
    mapMutations: (namespace, names) => Object.fromEntries(names.map(name => [name, function (value) { this.$store.commit(`${namespace}/${name}`, value) }])),
  }
  const edits = script.scriptAst.filter(node => node.type === 'ImportDeclaration').map(node => ({
    start: node.start,
    end: node.end,
    value: node.specifiers.map(specifier => `const ${specifier.local.name} = __imports.${specifier.local.name} || {};`).join('\n'),
  }))
  const exported = script.scriptAst.find(node => node.type === 'ExportDefaultDeclaration')
  edits.push({ start: exported.start, end: exported.declaration.start, value: 'module.exports = ' })
  const source = edits.sort((a, b) => b.start - a.start).reduce((text, edit) => text.slice(0, edit.start) + edit.value + text.slice(edit.end), script.content)
  const context = {
    module: { exports: {} },
    __imports: imports,
    navigator: { mediaSession: { setActionHandler: (action, handler) => mediaHandlers.set(action, handler) } },
  }
  vm.runInNewContext(source, context, { filename: filename.pathname })
  return context.module.exports
}

before(async () => {
  for (const name of ['AudioElement', 'LyricSelection', 'BookmarksDialog', 'ClipPanel']) components[name] = await loadComponent(name)
})

function fixture (name, values = {}) {
  const commits = []
  const context = {
    $store: { state: { AudioPlayer: { queueIndex: 0 } }, commit: (type, payload) => commits.push({ type, payload }) },
    ...values,
  }
  for (const [methodName, method] of Object.entries(components[name].methods)) {
    if (typeof method === 'function') context[methodName] = method.bind(context)
  }
  Object.assign(context, values)
  return { context, commits }
}

function manualTargets (commits) {
  return commits.filter(event => event.type === 'AudioPlayer/REQUEST_MANUAL_SEEK').map(event => [event.payload.seconds, event.payload.from])
}

test('transport buttons and Media Session seeks record a manual departure', () => {
  const { context, commits } = fixture('AudioElement', { player: { currentTime: 90 }, rewindSeekTime: 5, forwardSeekTime: 30 })
  components.AudioElement.watch.rewindSeekMode.call(context, true)
  components.AudioElement.watch.forwardSeekMode.call(context, true)
  context.setupMediaSessionActionHandlers()
  mediaHandlers.get('seekbackward')({ seekOffset: 10 })
  mediaHandlers.get('seekforward')({ seekOffset: 20 })
  mediaHandlers.get('seekto')({ seekTime: 45 })
  assert.deepEqual(manualTargets(commits), [[85, 90], [120, 90], [80, 90], [110, 90], [45, 90]])
  assert.equal(context.player.currentTime, 90)
})

test('slider and lyric clicks use manual seeks with the appropriate departure position', () => {
  const slider = fixture('AudioElement', { player: { currentTime: 94 }, sliderOrigin: 90, isChangingCurrentTime: true })
  slider.context.onChangeSlider(180)
  assert.deepEqual(manualTargets(slider.commits), [[180, 90]])
  assert.equal(slider.context.sliderOrigin, null)
  const lyric = fixture('LyricSelection')
  lyric.context.seekToLine({ time: 60500 })
  assert.deepEqual(manualTargets(lyric.commits), [[60.5, undefined]])
})

test('a current-track bookmark starts a manual seek and preserves paused playback', async () => {
  const track = { hash: '1/main.mp3', mediaStreamUrl: '/api/media/stream/1/main.mp3', workId: 1 }
  const { context, commits } = fixture('BookmarksDialog', {
    track, queue: [track], currentPlayingFile: track, scopeKey: 'alice:1:main.mp3',
    playing: false, playingTranscode: false, resumeHistroySeconds: -1, jumping: false,
    $axios: { post: async () => ({ data: { queue: [track], index: 0, seconds: 45 } }) },
    reportError: error => { throw error },
  })
  await context.jumpToBookmark({ id: 1 })
  assert.deepEqual(manualTargets(commits), [[45, undefined]])
  assert.equal(commits.find(event => event.type === 'AudioPlayer/SET_QUEUE').payload.resetPlaying, false)
  assert.ok(commits.some(event => event.type === 'AudioPlayer/PAUSE'))
  assert.ok(!commits.some(event => event.type === 'AudioPlayer/SET_NEW_CURRENT_TIME'))
})

test('cross-track bookmark loading stays automatic and does not create a current-track departure', async () => {
  const track = { hash: '2/other.mp3', mediaStreamUrl: '/api/media/stream/2/other.mp3', workId: 2 }
  const { context, commits } = fixture('BookmarksDialog', {
    track: null, queue: [], currentPlayingFile: { hash: '1/main.mp3', mediaStreamUrl: '/api/media/stream/1/main.mp3' },
    scopeKey: 'alice:2', playingTranscode: false, resumeHistroySeconds: -1, jumping: false,
    $axios: { post: async () => ({ data: { queue: [track], index: 0, seconds: 45 } }) },
    reportError: error => { throw error },
  })
  await context.jumpToBookmark({ id: 1 })
  assert.deepEqual(manualTargets(commits), [])
  assert.equal(commits.find(event => event.type === 'AudioPlayer/SET_QUEUE').payload.resumeHistroySeconds, 45)
})

test('explicit clip previews record one manual seek', () => {
  const { context, commits } = fixture('ClipPanel', {
    rangeValid: true, playbackReady: true, track: { hash: '1/main.mp3' }, start: 30, end: 50, draft: { loop: true },
  })
  context.preview()
  assert.deepEqual(manualTargets(commits), [[30, undefined]])
  assert.ok(commits.some(event => event.type === 'AudioPlayer/SET_CLIP_RANGE'))
})

test('saved-position loading, clip loops and track repeat do not create manual seeks', () => {
  const player = { media: {}, duration: 600, currentTime: 0, play: () => {} }
  const { context, commits } = fixture('AudioElement', {
    player, resumeHistroyDone: false, resumeHistroySeconds: 45, notifyHistoryRestore: false,
    activeClipRange: null, playbackRate: 1, currentPlayingFile: { hash: '1/main.mp3' }, playing: false,
  })
  context.onCanplay()
  assert.equal(player.currentTime, 45)
  context.activeClipRange = { start: 30, end: 50, loop: true }
  context.clipBoundaryHandled = false
  context.playing = true
  player.currentTime = 50
  assert.equal(context.finishClip(false), true)
  assert.equal(player.currentTime, 30)
  context.playMode = { name: 'repeat once' }
  context.advanceTrack()
  assert.equal(player.currentTime, 0)
  assert.deepEqual(manualTargets(commits), [])
})
