"use strict";

const path = require('path');
const fs = require('fs').promises;
const watcher = require('@parcel/watcher');
const { config, configFolderDir } = require('../config');
const db = require('../database/db');
const { getFolderList, tryMatchWorkCodeFromTopPath } = require('./utils');
const { codeToIdNumber, idNumberToCode } = require('./idConverter');
const { isPathInside } = require('./pathSafety');
const { inspectWorkFolder } = require('./workSnapshot');
const { WatchQueue } = require('./watchQueue');
const { processWatchedFolder } = require('./scannerModules');

const roots = new Map(config.rootFolders.map(root => [root.name, root]));
const subscriptions = new Map();
let nextId = 0;
let nextReconcile = 0;
let saving = false;
let dirty = false;

function rootFor(folder) {
    const root = roots.get(folder.rootFolderName);
    return root && path.resolve(root.path) === folder.rootPath ? root : null;
}
async function inspect(folder) {
    const root = rootFor(folder);
    return root ? inspectWorkFolder(root, folder.relativePath) : { state: 'unavailable' };
}
async function execute(folder, snapshot, current) {
    const id = ++nextId;
    await new Promise((resolve, reject) => {
        const granted = message => {
            if (!['scan-granted', 'scan-denied'].includes(message?.type) || message.id !== id) return;
            process.removeListener('message', granted);
            if (message.type === 'scan-denied') reject(new Error('Scan temporarily unavailable'));
            else resolve();
        };
        process.on('message', granted);
        process.send({ type: 'scan-request', id });
    });
    try {
        const latest = await inspect(folder);
        if (!current() || latest.busy || latest.state === 'unavailable' || latest.fingerprint !== snapshot.fingerprint) return 'changed';
        const result = await processWatchedFolder({ ...folder, absolutePath: path.resolve(rootFor(folder).path, folder.relativePath) }, latest);
        const after = await inspect(folder);
        return after.fingerprint !== snapshot.fingerprint ? 'changed' : result;
    }
    finally { process.send({ type: 'scan-done', id }); }
}
const queue = new WatchQueue({ statePath: path.join(configFolderDir, '..', 'watcher-state.json'), inspect, execute });

function folderFrom(root, relativePath) {
    const match = tryMatchWorkCodeFromTopPath(relativePath);
    if (!match || match.codeFolderPath.split(path.sep).length > config.scannerMaxRecursionDepth) return null;
    return { rootFolderName: root.name, rootPath: path.resolve(root.path), relativePath: match.codeFolderPath,
        absolutePath: path.resolve(root.path, match.codeFolderPath), code: idNumberToCode(codeToIdNumber(match.code)) };
}
function eventsReceived(root, error, events) {
    if (error) {
        console.error(`[FileWatcher] 监听错误 (${root.name}):`, error.message);
        // Restart the native backend as a unit after an error; disk state remains authoritative.
        process.exitCode = 1;
        process.disconnect();
        return;
    }
    for (const event of events || []) {
        if (!event || typeof event.path !== 'string') continue;
        if (!isPathInside(path.resolve(root.path), path.resolve(event.path))) continue;
        const folder = folderFrom(root, path.relative(root.path, event.path));
        if (folder) { queue.notify(folder); dirty = true; }
        else nextReconcile = Math.min(nextReconcile, Date.now() + 5000);
    }
}
async function reconcile() {
    for (const root of roots.values()) {
        try {
            await fs.readdir(root.path);
            if (!subscriptions.has(root.name)) {
                const subscription = await watcher.subscribe(root.path, (error, events) => eventsReceived(root, error, events), {
                    ignore: ['**/node_modules/**', '**/.git/**', '**/@eaDir/**', '**/System Volume Information/**'],
                });
                subscriptions.set(root.name, subscription);
                console.log(`[FileWatcher] 已开始监听: ${root.name}`);
            }
            const folders = [];
            for await (const folder of getFolderList(root)) folders.push({ ...folder, rootPath: path.resolve(root.path) });
            const works = await db.knex('t_work').select('dir', 'id').where('root_folder', root.name);
            for (const work of works) folders.push({ rootFolderName: root.name, rootPath: path.resolve(root.path),
                relativePath: work.dir, absolutePath: path.resolve(root.path, work.dir), code: idNumberToCode(work.id) });
            queue.reconcile(folders);
            dirty = true;
        }
        catch (error) { console.error(`[FileWatcher] 目录不可用 (${root.name}):`, error.message); }
    }
}
async function main() {
    if (!process.send) throw new Error('Watcher requires a supervisor');
    process.on('disconnect', () => process.exit(process.exitCode || 0));
    if (!process.connected) return;
    await queue.load();
    for (const [key, entry] of queue.entries) if (!rootFor(entry.folder)) queue.entries.delete(key);
    setInterval(() => process.send({ type: 'heartbeat' }), 5000);
    let reconciling = false;
    setInterval(() => {
        if (dirty && !saving) {
            dirty = false;
            saving = true;
            queue.save().catch(error => { dirty = true; console.error('[FileWatcher] 保存状态失败:', error.message); })
                .finally(() => { saving = false; });
        }
        if (!reconciling && Date.now() >= nextReconcile) {
            reconciling = true;
            nextReconcile = Date.now() + 5 * 60 * 1000;
            reconcile().catch(error => console.error('[FileWatcher] 目录核对失败:', error.message))
                .finally(() => { reconciling = false; });
        }
        queue.tick().catch(error => console.error('[FileWatcher] 队列处理失败:', error.message));
    }, 1000);
}
main().catch(error => { console.error('[FileWatcher] 启动失败:', error); process.exit(1); });
