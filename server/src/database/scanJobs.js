"use strict";

async function createScanTables(knex) {
    if (!(await knex.schema.hasTable('t_scan_job'))) await knex.schema.createTable('t_scan_job', table => {
        table.increments('id');
        table.string('kind', 16).notNullable();
        table.string('status', 16).notNullable();
        table.string('phase', 16).notNullable().defaultTo('discovering');
        table.json('roots').notNullable();
        table.boolean('discovered').notNullable().defaultTo(false);
        table.integer('total').notNullable().defaultTo(0);
        table.integer('completed').notNullable().defaultTo(0);
        table.string('error_key', 32);
        table.text('error_detail');
        table.timestamps(true, true);
    });
    if (!(await knex.schema.hasTable('t_scan_job_item'))) await knex.schema.createTable('t_scan_job_item', table => {
        table.increments('id');
        table.integer('job_id').unsigned().notNullable();
        table.json('payload').notNullable();
        table.string('status', 16).notNullable().defaultTo('pending');
        table.string('result', 16);
        table.string('fingerprint', 64);
        table.foreign('job_id').references('id').inTable('t_scan_job').onDelete('CASCADE');
        table.index(['job_id', 'status']);
    });
    if (!(await knex.schema.hasTable('t_cover_status'))) await knex.schema.createTable('t_cover_status', table => {
        table.bigInteger('work_id').unsigned().notNullable();
        table.string('type', 32).notNullable();
        table.string('reason', 16).notNullable();
        table.bigInteger('expires_at').notNullable();
        table.primary(['work_id', 'type']);
        table.foreign('work_id').references('id').inTable('t_work').onDelete('CASCADE');
    });
}

async function jobStatus(knex, id) {
    const query = knex('t_scan_job').select('id', 'kind', 'status', 'phase', 'total', 'completed', 'error_key', 'error_detail', 'updated_at').orderBy('id', 'desc');
    if (id) query.where('id', id);
    const job = await query.first();
    if (!job) return null;
    const counts = await knex('t_scan_job_item').where({ job_id: job.id, status: 'done' }).select('result').count('* as count').groupBy('result');
    job.counts = Object.fromEntries(counts.map(row => [row.result, Number(row.count)]));
    return job;
}

async function recoverScanJobs(knex) {
    await knex.transaction(async trx => {
        const jobs = await trx('t_scan_job').whereIn('status', ['queued', 'running', 'pausing']).select('id');
        const ids = jobs.map(job => job.id);
        if (!ids.length) return;
        await trx('t_scan_job').whereIn('id', ids).update({ status: 'paused', error_key: 'interrupted', updated_at: trx.fn.now() });
        await trx('t_scan_job_item').whereIn('job_id', ids).where('status', 'running').update({ status: 'pending' });
    });
}

function classifyFailure(failure) {
    const text = String(failure.message || '');
    if (/EACCES|EPERM|\b401\b|\b403\b|permission|拒绝访问|权限/i.test(text)) return 'permission';
    if (/ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|timeout|超时|网络/i.test(text)) return 'network';
    if (/\b404\b|ENOENT|not found|不存在|找不到/i.test(text)) return 'missing';
    if (failure.stage === 'database' || /SQLITE|database|数据库/i.test(text)) return 'database';
    if (failure.stage === 'filesystem') return 'filesystem';
    return 'unknown';
}

async function runScanJob(knex, id, handlers) {
    const jobs = () => knex('t_scan_job').where('id', id);
    const items = () => knex('t_scan_job_item').where('job_id', id);
    const running = async () => (await jobs().first('status'))?.status === 'running';
    let lastPublish = 0;
    const publish = async force => {
        if (!force && Date.now() - lastPublish < 1000) return;
        lastPublish = Date.now();
        await handlers.publish(await jobStatus(knex, id));
    };
    const pause = async (key, detail = '') => {
        await jobs().whereIn('status', ['running', 'pausing']).update({ status: 'pausing', error_key: key, error_detail: detail, updated_at: knex.fn.now() });
    };
    const inspect = async payload => {
        const snapshot = await handlers.inspect(payload);
        if (snapshot.state === 'unavailable' || snapshot.busy) {
            await pause(snapshot.busy ? 'filesBusy' : 'rootUnavailable', [payload.rootFolderName, payload.relativePath].filter(Boolean).join('/'));
            return null;
        }
        return snapshot;
    };
    const job = await jobs().first();
    if (job?.status === 'pausing') { await jobs().update({ status: 'paused' }); await publish(true); return; }
    if (!job || job.status !== 'queued') return;
    await jobs().update({ status: 'running', error_key: null, error_detail: null, updated_at: knex.fn.now() });
    try {
        await handlers.validateRoots(job);
        if (!job.discovered) {
            await jobs().update({ phase: 'discovering', completed: 0 });
            await items().del();
            const discovered = await handlers.discover(running);
            if (await running()) {
                await jobs().update({ total: discovered.length });
                for (let offset = 0; offset < discovered.length; offset += 100) {
                    if (!(await running())) break;
                    await knex('t_scan_job_item').insert(discovered.slice(offset, offset + 100).map(payload => ({ job_id: id, payload: JSON.stringify(payload), status: 'pending' })));
                }
                if (await running()) await jobs().update({ discovered: true });
            }
        } else {
            await items().where('status', 'running').update({ status: 'pending' });
            await jobs().update({ phase: 'checking' });
            const completed = await items().where('status', 'done').select('id', 'payload', 'fingerprint');
            for (const item of completed) {
                if (!(await running())) break;
                const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
                const snapshot = await inspect(payload);
                if (!snapshot) break;
                if (snapshot.fingerprint !== item.fingerprint) await items().where('id', item.id).update({ status: 'pending', result: null });
                await publish(false);
            }
        }
        const count = Number((await items().where('status', 'done').count('* as count').first()).count);
        await jobs().update({ completed: count, phase: 'processing' });
        const pending = await items().where('status', 'pending').orderBy('id').select('id', 'payload');
        let cursor = 0;
        const workers = Array.from({ length: Math.min(Math.max(1, handlers.concurrency || 1), 16, pending.length) }, async () => {
            while (await running()) {
                const item = pending[cursor++];
                if (!item) return;
                const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
                const snapshot = await inspect(payload);
                if (!snapshot || !(await running())) return;
                await items().where('id', item.id).update({ status: 'running' });
                const result = await handlers.process(payload, snapshot);
                const after = await inspect(payload);
                if (!after) { await items().where('id', item.id).update({ status: 'pending' }); return; }
                if (after.fingerprint !== snapshot.fingerprint) {
                    await items().where('id', item.id).update({ payload: JSON.stringify(payload), status: 'pending' });
                    await pause('filesBusy', [payload.rootFolderName, payload.relativePath].join('/'));
                    return;
                }
                await knex.transaction(async trx => {
                    await trx('t_scan_job_item').where('id', item.id).update({ payload: JSON.stringify(payload), status: 'done', result, fingerprint: after.fingerprint });
                    await trx('t_scan_job').where('id', id).increment('completed', 1).update({ updated_at: trx.fn.now() });
                });
                await publish(false);
            }
        });
        const outcomes = await Promise.allSettled(workers);
        const failure = outcomes.find(outcome => outcome.status === 'rejected');
        if (failure) throw failure.reason;
        const current = await jobs().first();
        if (current.status === 'pausing') await jobs().update({ status: 'paused' });
        else if (current.status === 'running') await jobs().update({ status: 'completed', updated_at: knex.fn.now() });
    } catch (error) {
        await jobs().whereNot('status', 'cancelled').update({ status: 'paused', error_key: error.scanKey || 'scanFailed', error_detail: error.message, updated_at: knex.fn.now() });
        await items().where('status', 'running').update({ status: 'pending' });
    }
    await publish(true);
}

module.exports = { createScanTables, jobStatus, recoverScanJobs, classifyFailure, runScanJob };
