"use strict";

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { WatchQueue } = require('../../src/filesystem/watchQueue');
const { ScanCoordinator } = require('../../src/filesystem/scanCoordinator');
const { WatcherSupervisor } = require('../../src/filesystem/fileWatcher');

function makeQueue(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kikoeru-watch-queue-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    let time = 0;
    const scans = [];
    const snapshots = new Map();
    const options = { statePath: path.join(dir, 'state.json'), now: () => time,
        inspect: async folder => snapshots.get(folder.code) || { state: 'present', fingerprint: 'initial' },
        execute: async folder => { scans.push(folder.code); return 'added'; },
        quietMs: 5, stableMs: 5, verifyMs: 60, retryMs: 30, logger: { error() {} } };
    const queue = new WatchQueue(options);
    const folder = code => ({ rootFolderName: 'Library', rootPath: dir, relativePath: code, code });
    return { queue, options, scans, snapshots, folder, tick: async at => { time = at; await queue.tick(); } };
}

test('SMB writes delay only their own work and late files cause a second scan', async t => {
    const h = makeQueue(t);
    h.queue.notify(h.folder('RJ100001'));
    h.queue.notify(h.folder('RJ100002'));
    await h.tick(5);
    h.queue.notify(h.folder('RJ100002'));
    await h.tick(10);
    assert.deepEqual(h.scans, ['RJ100001']);
    h.snapshots.set('RJ100001', { state: 'present', fingerprint: 'late-subtitle' });
    h.queue.notify(h.folder('RJ100001'));
    await h.tick(15);
    await h.tick(15);
    await h.tick(20);
    await h.tick(20);
    assert.equal(h.scans.filter(code => code === 'RJ100001').length, 2);
    assert.equal(h.scans.filter(code => code === 'RJ100002').length, 1);
});

test('changing or incomplete files are not scanned and an event during scanning stays pending', async t => {
    const h = makeQueue(t);
    const folder = h.folder('RJ100001');
    h.queue.notify(folder);
    h.snapshots.set(folder.code, { state: 'present', fingerprint: 'a', busy: true });
    await h.tick(5);
    assert.equal(h.scans.length, 0);
    h.snapshots.set(folder.code, { state: 'present', fingerprint: 'b' });
    await h.tick(35);
    h.snapshots.set(folder.code, { state: 'present', fingerprint: 'c' });
    await h.tick(40);
    assert.equal(h.scans.length, 0);
    h.queue.execute = async () => { h.queue.notify(folder); return 'added'; };
    await h.tick(45);
    assert.equal([...h.queue.entries.values()][0].pending, true);
    assert.equal([...h.queue.entries.values()][0].completedSignature, undefined);
});

test('more than 1024 candidates and duplicate codes survive a restart with failures pending', async t => {
    const h = makeQueue(t);
    for (let i = 0; i < 1025; i++) h.queue.notify(h.folder(`RJ${100000 + i}`));
    h.queue.notify({ ...h.folder('RJ100000'), rootFolderName: 'Other' });
    await h.queue.save();
    const restored = new WatchQueue(h.options);
    await restored.load();
    assert.equal(restored.entries.size, 1026);
    h.queue.execute = async () => 'failed';
    await h.tick(5);
    await h.tick(10);
    assert.equal(h.queue.entries.size, 1026);
    assert.ok([...h.queue.entries.values()].every(entry => entry.pending));
});

test('manual and automatic scans cannot overlap and cancelled requests release their place', async () => {
    const state = {};
    const coordinator = new ScanCoordinator(state);
    let release;
    const first = coordinator.run(() => new Promise(resolve => { release = resolve; }));
    const controller = new AbortController();
    const cancelled = coordinator.run(() => assert.fail('cancelled request ran'), controller.signal);
    const rejection = assert.rejects(cancelled, /cancelled/);
    controller.abort();
    let secondRan = false;
    const second = coordinator.run(() => { secondRan = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.scannerActive, true);
    assert.equal(secondRan, false);
    release();
    await Promise.all([first, second, rejection]);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.scannerActive, false);
    state.installing = true;
    await assert.rejects(coordinator.run(() => {}), /unavailable/);
});

test('duplicate candidates remain pending until the original path can be reconsidered', async t => {
    const h = makeQueue(t);
    h.queue.execute = async () => 'duplicate';
    h.queue.notify(h.folder('RJ100001'));
    await h.tick(5);
    await h.tick(10);
    const entry = [...h.queue.entries.values()][0];
    assert.equal(entry.pending, true);
    assert.equal(entry.completedSignature, undefined);
    h.queue.execute = async () => 'added';
    await h.tick(300010);
    await h.tick(300015);
    assert.equal(entry.completedSignature, 'initial');
});

test('an update reservation rejects a watcher request explicitly', async () => {
    const messages = [];
    const child = new EventEmitter();
    child.connected = true;
    child.send = (message, callback) => { messages.push(message); callback?.(); };
    child.kill = () => child.emit('exit', 0, null);
    const supervisor = new WatcherSupervisor({ spawn: () => child,
        coordinator: new ScanCoordinator({ installing: true }), logger: { error() {} } });
    try {
        supervisor.start();
        child.emit('message', { type: 'scan-request', id: 9 });
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(messages, [{ type: 'scan-denied', id: 9 }]);
    }
    finally { await supervisor.stop(); }
});

test('a crashed watcher releases its scan and restarts without restarting the server', async () => {
    const children = [];
    const state = {};
    const supervisor = new WatcherSupervisor({ retryMs: 5, coordinator: new ScanCoordinator(state), logger: { error() {} },
        spawn: () => {
            const child = new EventEmitter();
            child.connected = true;
            child.send = (_message, callback) => callback?.();
            child.kill = () => { child.connected = false; child.emit('exit', 1, null); };
            children.push(child);
            return child;
        } });
    try {
        supervisor.start();
        children[0].emit('message', { type: 'scan-request', id: 1 });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(state.scannerActive, true);
        children[0].kill();
        await new Promise(resolve => setTimeout(resolve, 30));
        assert.equal(children.length, 2);
        assert.equal(state.scannerActive, false);
    }
    finally { supervisor.stop(); }
});
