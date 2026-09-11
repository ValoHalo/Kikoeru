"use strict";

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { fork } = require('node:child_process');
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'kikoeru-availability-'));
fs.mkdirSync(path.join(runtime, 'config'));
fs.mkdirSync(path.join(runtime, 'sqlite'));
fs.writeFileSync(path.join(runtime, 'config', 'config.json'), JSON.stringify({ sqliteType: 'better-sqlite3', dbUseDefaultPath: true }));
process.env.KIKOERU_DATA_DIR = runtime;
process.env.FREEZE_CONFIG_FILE = '1';
const { config } = require('../../src/config');
const db = require('../../src/database/db');
const { createSchema } = require('../../src/database/schema');
const { inspectWorkFolder } = require('../../src/filesystem/workSnapshot');
const { reconcileAvailability } = require('../../src/filesystem/workAvailability');
const { prepareWorks } = require('../../src/routes/utils/workVisibility');
const root = { name: 'Library', path: path.join(runtime, 'library') };
config.rootFolders = [root];
test.before(async () => {
    fs.mkdirSync(root.path);
    await createSchema(db.knex);
    await db.knex('t_circle').insert({ id: 1, name: 'Circle' });
    await db.knex('t_user').insert({ name: 'admin', password: 'admin', group: 'administrator' });
    await db.knex('t_work').insert({ id: 123456, root_folder: root.name, dir: 'RJ123456', title: 'Preserved work', circle_id: 1, lyric_status: '' });
    await db.updateUserReview('admin', 123456, 5, 'Preserved review', '', false, false);
    await db.updatePlayHistroy('admin', 123456, JSON.stringify({ queue: [], index: 0, seconds: 42 }));
});
test.after(async () => { await db.knex.destroy(); fs.rmSync(runtime, { recursive: true, force: true }); });

test('missing works are hidden, retained and restored without losing personal records', async () => {
    await reconcileAvailability(db, [root]);
    assert.equal((await db.getWorksBy('admin')).length, 0);
    assert.equal((await db.getMissingWorks('admin')).totalCount, 1);
    const metadata = await db.getWorkMetadata(123456, 'admin');
    await prepareWorks(metadata);
    assert.equal(metadata[0].files_missing, true);
    assert.equal((await db.knex('t_review').first()).review_text, 'Preserved review');
    assert.ok((await db.knex('t_play_histroy').first()).state.includes('42'));
    fs.mkdirSync(path.join(root.path, 'RJ123456'));
    fs.writeFileSync(path.join(root.path, 'RJ123456', 'track.wav'), 'audio fixture');
    await reconcileAvailability(db, [root]);
    assert.equal((await db.getWorksBy('admin')).length, 1);
    assert.equal((await db.getMissingWorks('admin')).totalCount, 0);
});

test('an offline root or incomplete file cannot mark an available work missing', async () => {
    fs.renameSync(root.path, `${root.path}-offline`);
    try {
        assert.equal((await inspectWorkFolder(root, 'RJ123456')).state, 'unavailable');
        await reconcileAvailability(db, [root]);
        assert.equal((await db.getWorksBy('admin')).length, 1);
    }
    finally { fs.renameSync(`${root.path}-offline`, root.path); }
    fs.writeFileSync(path.join(root.path, 'RJ123456', 'next.wav'), '');
    assert.equal((await inspectWorkFolder(root, 'RJ123456')).busy, true);
    await reconcileAvailability(db, [root]);
    assert.equal((await db.getWorksBy('admin')).length, 1);
    fs.unlinkSync(path.join(root.path, 'RJ123456', 'next.wav'));
});

test('automatic scan failures are persisted and completed tasks release their logs', async t => {
    const utils = require('../../src/filesystem/utils');
    t.mock.method(utils, 'scrapeWorkMemo', async () => { throw new Error('File still being copied'); });
    const { processWatchedFolder } = require('../../src/filesystem/scannerModules');
    let state;
    const originalSend = process.send;
    process.send = message => { if (message.event === 'SCAN_INIT_STATE') state = message.payload; };
    try {
        for (let i = 0; i < 10; i++) {
            assert.equal(await processWatchedFolder({ code: 'RJ123456', rootFolderName: root.name, relativePath: 'RJ123456',
                absolutePath: path.join(root.path, 'RJ123456') }, { state: 'present' }), 'failed');
        }
        process.emit('message', { emit: 'SCAN_INIT_STATE' });
        assert.equal(state.tasks.length, 0);
        assert.equal(state.mainLogs.length, 0);
        assert.equal(state.failedTasks.length, 0);
        const failure = await db.knex('t_scan_failure').first();
        assert.equal(failure.attempts, 10);
        assert.match(failure.message, /still being copied/);
    }
    finally { process.send = originalSend; }
});

test('a duplicate cannot replace an inaccessible original but can replace a confirmed missing directory', async t => {
    const secondRoot = { name: 'Other', path: path.join(runtime, 'other') };
    const relativePath = 'RJ123456';
    fs.mkdirSync(path.join(secondRoot.path, relativePath), { recursive: true });
    fs.writeFileSync(path.join(secondRoot.path, relativePath, 'track.wav'), 'fixture');
    config.rootFolders = [root, secondRoot];
    const { processWatchedFolder } = require('../../src/filesystem/scannerModules');
    const folder = { rootFolderName: secondRoot.name, relativePath, code: relativePath, absolutePath: path.join(secondRoot.path, relativePath) };
    assert.equal(await processWatchedFolder(folder, { state: 'present' }), 'duplicate');
    fs.renameSync(root.path, `${root.path}-offline`);
    try {
        assert.equal(await processWatchedFolder(folder, { state: 'present' }), 'failed');
        assert.equal((await db.knex('t_work').first()).root_folder, root.name);
    }
    finally { fs.renameSync(`${root.path}-offline`, root.path); }
    fs.renameSync(path.join(root.path, relativePath), path.join(runtime, 'original-work'));
    const utils = require('../../src/filesystem/utils');
    t.mock.method(utils, 'scrapeWorkMemo', async () => ({ isContainLyric: false }));
    fs.mkdirSync(config.coverFolderDir, { recursive: true });
    for (const type of ['main', 'sam', '240x240']) fs.writeFileSync(path.join(config.coverFolderDir, `RJ123456_img_${type}.jpg`), 'fixture');
    try {
        assert.notEqual(await processWatchedFolder(folder, { state: 'present' }), 'failed');
        assert.equal((await db.knex('t_work').first()).root_folder, secondRoot.name);
        assert.equal((await db.knex('t_review').first()).review_text, 'Preserved review');
    }
    finally {
        fs.renameSync(path.join(runtime, 'original-work'), path.join(root.path, relativePath));
        await db.knex('t_work').where('id', 123456).update({ root_folder: root.name, dir: relativePath });
        config.rootFolders = [root];
    }
});

test('availability migration preserves existing works and can be rolled back', async () => {
    const connection = require('knex')({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    const migration = require('../../src/database/migrations/20260912000000_work_availability');
    try {
        await connection.schema.createTable('t_work', table => table.bigInteger('id').primary());
        await connection('t_work').insert({ id: 123456 });
        await migration.up(connection);
        await migration.up(connection);
        await connection('t_work_availability').insert({ work_id: 123456 });
        await migration.down(connection);
        assert.equal((await connection('t_work').first()).id, 123456);
    }
    finally { await connection.destroy(); }
});

test('native watcher detects late subtitles, hides missing files and recovers after a process restart', { timeout: 90000 }, async () => {
    const { WatcherSupervisor } = require('../../src/filesystem/fileWatcher');
    const { ScanCoordinator } = require('../../src/filesystem/scanCoordinator');
    const file = path.join(root.path, 'RJ123456', 'track.wav');
    await db.setWorkMemo(123456, { duration: { 'track.wav': 1 }, mtime: { 'track.wav': Math.round(fs.statSync(file).mtimeMs) } });
    fs.mkdirSync(config.coverFolderDir, { recursive: true });
    for (const type of ['main', 'sam', '240x240']) fs.writeFileSync(path.join(config.coverFolderDir, `RJ123456_img_${type}.jpg`), 'fixture');
    fs.writeFileSync(path.join(runtime, 'config', 'config.json'), JSON.stringify({ ...config, rootFolders: [root] }));
    const children = [];
    let logs = '';
    const supervisor = new WatcherSupervisor({ retryMs: 20, coordinator: new ScanCoordinator({}), logger: { error() {} },
        spawn: () => {
            const child = fork(path.resolve(__dirname, '../../src/filesystem/watcherWorker.js'), [], {
                env: { ...process.env, KIKOERU_DATA_DIR: runtime }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
            });
            child.stdout.on('data', data => { logs = (logs + data).slice(-8000); });
            child.stderr.on('data', data => { logs = (logs + data).slice(-8000); });
            children.push(child);
            return child;
        } });
    async function until(check) {
        const deadline = Date.now() + 25000;
        while (Date.now() < deadline) {
            if (await check()) return;
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        assert.fail(logs);
    }
    try {
        supervisor.start();
        await until(() => logs.includes('[FileWatcher] 已开始监听'));
        fs.writeFileSync(path.join(root.path, 'RJ123456', 'late.srt'), '1\n00:00:00,000 --> 00:00:01,000\nSubtitle\n');
        await until(async () => (await db.knex('t_work').where('id', 123456).first()).lyric_status.includes('local'));
        fs.renameSync(path.join(root.path, 'RJ123456'), path.join(runtime, 'parked'));
        await until(async () => Boolean(await db.knex('t_work_availability').where('work_id', 123456).first()));
        children[0].kill();
        await until(() => children.length === 2);
        fs.renameSync(path.join(runtime, 'parked'), path.join(root.path, 'RJ123456'));
        await until(async () => !(await db.knex('t_work_availability').where('work_id', 123456).first()));
        assert.equal((await db.knex('t_review').first()).review_text, 'Preserved review');
        assert.equal(await db.knex('t_work').where('id', 123456).first().then(Boolean), true);
    }
    finally {
        const child = supervisor.child;
        const exited = child && child.exitCode === null ? new Promise(resolve => child.once('exit', resolve)) : Promise.resolve();
        supervisor.stop();
        await exited;
    }
});
