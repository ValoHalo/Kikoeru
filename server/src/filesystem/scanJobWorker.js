"use strict";
const fs = require('node:fs').promises;
const path = require('node:path');
const { config } = require('../config');
const db = require('../database/db');
const { runScanJob } = require('../database/scanJobs');
const scanner = require('./scannerModules');
const { getFolderList, sortFoldersByCreatedTime } = require('./utils');
const { idNumberToCode, codeToIdNumber, isCustomCode } = require('./idConverter');
const { inspectWorkFolder } = require('./workSnapshot');
const { setWorkMissing } = require('./workAvailability');
const { resolvePathInside } = require('./pathSafety');

const onParentDisconnect = () => process.exit(1);
process.once('disconnect', onParentDisconnect);
const id = Number(process.argv[2]);
const send = job => { if (process.connected) process.send({ event: 'SCAN_JOB', payload: job }, () => {}); };
const payloadFor = work => ({ workId: Number(work.id), code: idNumberToCode(work.id), rootFolderName: work.root_folder, relativePath: work.dir });

async function main() {
    const job = await db.knex('t_scan_job').where('id', id).first();
    if (!job) throw new Error('Scan job not found');
    await fs.mkdir(config.coverFolderDir, { recursive: true });
    const needsFiles = ['scan', 'files', 'retry'].includes(job.kind);
    await runScanJob(db.knex, id, {
        concurrency: config.maxParallelism,
        publish: send,
        async validateRoots() {
            if (!needsFiles) return;
            for (const root of config.rootFolders) {
                try { await fs.readdir(root.path); }
                catch { const error = new Error(root.name); error.scanKey = 'rootUnavailable'; throw error; }
            }
        },
        async discover(running) {
            if (job.kind === 'scan') {
                let folders = [];
                for (const root of config.rootFolders) {
                    for await (const folder of getFolderList(root, '', 0, { warn: console.warn, error: console.error, info: console.log })) {
                        if (folders.length % 100 === 0 && !(await running())) return [];
                        folders.push({ code: folder.code, rootFolderName: folder.rootFolderName, relativePath: folder.relativePath, createdAtMs: folder.createdAtMs });
                    }
                }
                const works = await db.knex('t_work').select('id', 'root_folder', 'dir');
                if (!works.length) folders = sortFoldersByCreatedTime(folders).map(folder => ({ ...folder, initialCreatedAt: Number.isFinite(folder.createdAtMs) ? new Date(folder.createdAtMs).toISOString() : undefined }));
                const unique = new Map();
                for (const folder of folders) unique.set(isCustomCode(folder.code) ? JSON.stringify([folder.rootFolderName, folder.relativePath]) : folder.code, folder);
                folders = [...unique.values()];
                if (!config.skipCleanup) {
                    const present = new Set(folders.map(folder => JSON.stringify([folder.rootFolderName, folder.relativePath])));
                    for (const work of works) {
                        if (config.rootFolders.some(root => root.name === work.root_folder) && !present.has(JSON.stringify([work.root_folder, work.dir]))) folders.push({ ...payloadFor(work), availability: true });
                    }
                }
                return folders;
            }
            if (job.kind === 'retry') {
                return (await db.getScanFailures()).map(failure => ({ code: failure.code, workId: codeToIdNumber(failure.code), rootFolderName: failure.root_folder, relativePath: failure.relative_dir, stage: failure.stage }));
            }
            const works = db.knex('t_work').select('id', 'root_folder', 'dir');
            if (job.kind === 'covers') works.whereIn('id', db.knex('t_cover_status').distinct('work_id'));
            return (await works).map(payloadFor);
        },
        async inspect(payload) {
            if (!needsFiles) return { state: 'present', fingerprint: 'metadata' };
            const root = config.rootFolders.find(root => root.name === payload.rootFolderName);
            return root ? inspectWorkFolder(root, payload.relativePath) : { state: 'unavailable' };
        },
        async process(payload, snapshot) {
            const workId = payload.workId || codeToIdNumber(payload.code);
            const root = config.rootFolders.find(root => root.name === payload.rootFolderName);
            try {
                if (payload.availability || (needsFiles && snapshot.state !== 'present')) {
                    if (await db.knex('t_work').where('id', workId).first()) await setWorkMissing(db, workId, snapshot.state !== 'present');
                    return 'skipped';
                }
                let result;
                const work = await db.knex('t_work').where('id', workId).first();
                if (job.kind === 'metadata' || (job.kind === 'retry' && payload.stage === 'metadata' && work)) {
                    result = work ? await scanner.updateMetadata(workId, { refreshAll: true }) : 'skipped';
                    await scanner.finishFolderTask(payload, result);
                } else if (job.kind === 'files' || (job.kind === 'retry' && payload.stage === 'filesystem' && work)) {
                    result = work ? await scanner.scanWorkFile(work, -1, 0) : 'skipped';
                } else {
                    const folder = { ...payload, absolutePath: root ? resolvePathInside(path.resolve(root.path), payload.relativePath) : '' };
                    if (job.kind === 'scan' && work) {
                        const filesResult = await scanner.scanWorkFile(work, -1, 0);
                        if (filesResult === 'failed') return 'failed';
                    }
                    result = await scanner.processFolder(folder);
                    const stored = await db.knex('t_work').where('id', codeToIdNumber(folder.code)).first('id', 'root_folder', 'dir');
                    if (stored) Object.assign(payload, payloadFor(stored));
                    await scanner.finishFolderTask(payload, result);
                    if (stored && result !== 'failed') await setWorkMissing(db, stored.id, false);
                }
                return ['added', 'updated', 'skipped', 'failed'].includes(result) ? result : 'failed';
            } catch (error) {
                await db.recordScanFailure({ code: payload.code, rootFolder: payload.rootFolderName, relativeDir: payload.relativePath, stage: 'filesystem', message: error.message });
                return 'failed';
            }
        }
    });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await db.knex.destroy();
    process.removeListener('disconnect', onParentDisconnect);
    if (process.connected) process.disconnect();
});
