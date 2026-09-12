import assert from 'node:assert/strict'
import test from 'node:test'
import { folderExists, initialWorkFolder, workFolderStorageKey } from '../src/utils/workFolder.mjs'

const tree = [
  { type: 'folder', title: 'mp3', children: [{ type: 'audio', title: 'track.mp3' }] },
  { type: 'folder', title: 'wav', children: [{ type: 'folder', title: '音声', children: [] }] }
]

test('a saved nested folder or root overrides the global preference', () => {
  assert.deepEqual(initialWorkFolder(tree, ['wav', '音声'], ['mp3']), ['wav', '音声'])
  assert.deepEqual(initialWorkFolder(tree, [], ['mp3']), [])
  assert.deepEqual(initialWorkFolder(tree, ['wav'], []), ['wav'])
})

test('missing, malformed and cleared defaults fall back to global preferences', () => {
  for (const saved of [null, ['deleted'], ['wav', 'deleted'], ['mp3', 'track.mp3'], 'wav', [42], ['']]) {
    assert.deepEqual(initialWorkFolder(tree, saved, ['mp3']), ['mp3'])
  }
  assert.deepEqual(initialWorkFolder(tree, ['deleted'], ['also deleted']), [])
  assert.equal(folderExists(tree, ['mp3', 'track.mp3']), false)
})

test('single-folder traversal remains the fallback and an explicit root stops it', () => {
  const single = [{ type: 'folder', title: 'outer', children: [tree[1]] }]
  assert.deepEqual(initialWorkFolder(single, null, []), ['outer', 'wav', '音声'])
  assert.deepEqual(initialWorkFolder(single, [], []), [])
})

test('defaults are isolated by user and work and do not share mutable paths', () => {
  assert.notEqual(workFolderStorageKey('alice', 1), workFolderStorageKey('bob', 1))
  assert.notEqual(workFolderStorageKey('alice', 1), workFolderStorageKey('alice', 2))
  const saved = ['wav']
  initialWorkFolder(tree, saved, ['mp3']).push('音声')
  assert.deepEqual(saved, ['wav'])
})
