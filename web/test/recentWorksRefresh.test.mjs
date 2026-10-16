import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test, { before } from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const { parse, compileScript } = require('@vue/compiler-sfc')
const savedWatcher = '$store.state.AudioPlayer.historySavedRevision'
let component

before(async () => {
  const filename = new URL('../src/components/RecentWorks.vue', import.meta.url)
  const { descriptor, errors } = parse(await readFile(filename, 'utf8'), { filename: filename.pathname })
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: 'recent-works-refresh' })
  const edits = script.scriptAst.filter(node => node.type === 'ImportDeclaration').map(node => ({
    start: node.start,
    end: node.end,
    value: node.specifiers.map(specifier => `const ${specifier.local.name} = {};`).join('\n'),
  }))
  const exported = script.scriptAst.find(node => node.type === 'ExportDefaultDeclaration')
  edits.push({ start: exported.start, end: exported.declaration.start, value: 'module.exports = ' })
  const source = edits.sort((a, b) => b.start - a.start).reduce((text, edit) => text.slice(0, edit.start) + edit.value + text.slice(edit.end), script.content)
  const context = { module: { exports: {} } }
  vm.runInNewContext(source, context, { filename: filename.pathname })
  component = context.module.exports
})

function fixture () {
  const requests = []
  const existing = [{ id: 1 }]
  const context = {
    ...component.data(),
    works: existing,
    $refs: {},
    $axios: {
      get: () => new Promise((resolve, reject) => { requests.push({ resolve, reject }) }),
    },
  }
  for (const [name, method] of Object.entries(component.methods)) context[name] = method.bind(context)
  const notify = watcher => component.watch[watcher].call(context)
  const respond = async (index, works) => {
    requests[index].resolve({ data: { works, pagination: { currentPage: 1, pageSize: 12, totalCount: works.length } } })
    await nextTurn()
  }
  return { context, requests, existing, notify, respond }
}

test('saved playback refresh keeps the visible list until new data arrives', async () => {
  const { context, existing, requests, notify, respond } = fixture()
  notify(savedWatcher)
  assert.equal(context.works, existing)
  assert.equal(context.isLoading, true)
  assert.equal(requests.length, 1)
  const updated = [{ id: 2 }, { id: 1 }]
  await respond(0, updated)
  assert.equal(context.works, updated)
  assert.equal(context.isLoading, false)
})

test('a failed background refresh retains the visible list', async () => {
  const { context, existing, requests, notify } = fixture()
  notify(savedWatcher)
  requests[0].reject(new Error('offline'))
  await nextTurn()
  assert.equal(context.works, existing)
  assert.equal(context.isLoading, false)
  assert.equal(context.loadError, true)
})

test('switching accounts and clearing history immediately remove prior data', async () => {
  for (const watcher of ['$store.state.User.name', '$store.state.AudioPlayer.historyRevision']) {
    const { context, existing, notify, respond } = fixture()
    notify(watcher)
    assert.notEqual(context.works, existing)
    assert.equal(context.works.length, 0)
    await respond(0, [])
    assert.equal(context.works.length, 0)
  }
})

test('an earlier refresh cannot replace the next account list after switching users', async () => {
  const { context, requests, notify, respond } = fixture()
  notify(savedWatcher)
  notify('$store.state.User.name')
  assert.equal(context.works.length, 0)
  assert.equal(requests.length, 2)
  const nextAccount = [{ id: 3 }]
  await respond(1, nextAccount)
  await respond(0, [{ id: 1 }])
  assert.equal(context.works, nextAccount)
  assert.equal(context.isLoading, false)
})
