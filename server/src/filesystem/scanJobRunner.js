"use strict";
const { EventEmitter } = require('node:events');
const { fork } = require('node:child_process');
const path = require('node:path');
const { knex } = require('../database/db');
const { config } = require('../config');
const { t } = require('../i18n');
const { jobStatus } = require('../database/scanJobs');
const { scanCoordinator } = require('./scanCoordinator');
const runtimeState = require('../runtimeState');
const events = new EventEmitter();
let active = null;
let starting = false;

function conflict(key) { const error = new Error(t(`scanJobs.${key}`)); error.status = 409; throw error; }
async function publish(id) { const job = await jobStatus(knex, id); events.emit('message', { event: 'SCAN_JOB', payload: job }); return job; }

async function startJob(kind, resumeId) {
    if (starting || active || runtimeState.installing) conflict('busy');
    starting = true;
    let job;
    try {
        if (resumeId) {
            job = await knex('t_scan_job').where('id', resumeId).first();
            if (!job || job.status !== 'paused') conflict('cannotResume');
            const roots = typeof job.roots === 'string' ? JSON.parse(job.roots) : job.roots;
            if (JSON.stringify(roots) !== JSON.stringify(config.rootFolders)) conflict('rootsChanged');
            await knex('t_scan_job').where('id', job.id).update({ status: 'queued', error_key: null, error_detail: null, updated_at: knex.fn.now() });
        } else {
            if (await knex('t_scan_job').whereIn('status', ['queued', 'running', 'pausing', 'paused']).first()) conflict('unfinished');
            const [id] = await knex('t_scan_job').insert({ kind, status: 'queued', roots: JSON.stringify(config.rootFolders) });
            job = { id: Number(id), kind };
            const old = await knex('t_scan_job').whereIn('status', ['completed', 'cancelled']).orderBy('id', 'desc').offset(1).select('id');
            if (old.length) await knex('t_scan_job').whereIn('id', old.map(row => row.id)).del();
        }
        const request = { id: job.id, controller: new AbortController(), child: null };
        active = request;
        scanCoordinator.run(() => new Promise((resolve, reject) => {
            const child = fork(path.join(__dirname, 'scanJobWorker.js'), [String(job.id)], { windowsHide: true, env: { ...process.env, KIKOERU_RETRY_COVERS: ['retry', 'covers'].includes(job.kind) ? '1' : '0' } });
            request.child = child;
            child.on('message', message => { if (message.event) events.emit('message', message); });
            child.once('error', reject);
            child.once('exit', (code, signal) => code || signal ? reject(new Error(`Scanner exited: ${code ?? signal}`)) : resolve());
        }), request.controller.signal).catch(async error => {
            const current = await knex('t_scan_job').where('id', job.id).first();
            if (current && !['completed', 'cancelled', 'paused'].includes(current.status)) {
                await knex('t_scan_job').where('id', job.id).update({ status: 'paused', error_key: 'interrupted', error_detail: error.message, updated_at: knex.fn.now() });
            }
        }).finally(async () => { if (active === request) active = null; await publish(job.id); });
        return await publish(job.id);
    } finally { starting = false; }
}

async function pauseJob(id) {
    const updated = await knex('t_scan_job').where('id', id).whereIn('status', ['queued', 'running']).update({ status: active?.child ? 'pausing' : 'paused', updated_at: knex.fn.now() });
    if (!updated) conflict('cannotPause');
    if (active?.id === Number(id) && !active.child) active.controller.abort();
    return publish(id);
}

async function cancelJob(id) {
    const updated = await knex('t_scan_job').where('id', id).whereIn('status', ['queued', 'running', 'pausing', 'paused']).update({ status: 'cancelled', updated_at: knex.fn.now() });
    if (!updated) conflict('cannotCancel');
    if (active?.id === Number(id)) {
        active.controller.abort();
        if (active.child) active.child.kill();
    }
    return publish(id);
}

function sendState() { if (active?.child?.connected) active.child.send({ emit: 'SCAN_INIT_STATE' }, () => {}); }
module.exports = { events, startJob, pauseJob, cancelJob, sendState };
