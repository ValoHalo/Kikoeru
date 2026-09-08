"use strict";

const db = require('../../database/db');

function trackWorkId(track, fallback) {
    return Number(track.workId) || Number(String(track.hash || '').split('/')[0]) || Number(fallback);
}

async function prepareWorks(works, sfwOnly = false) {
    const ratings = new Map(works.map(work => [Number(work.id), work.nsfw]));
    const ids = new Set();
    for (const work of works) {
        for (const track of work.state?.queue || []) ids.add(trackWorkId(track, work.id));
        if (sfwOnly) for (const related of work.relatedWorks || []) ids.add(Number(related.id));
    }
    const missing = [...ids].filter(id => Number.isInteger(id) && id > 0 && !ratings.has(id));
    if (missing.length) {
        const rows = await db.knex('t_work').select('id', 'nsfw').whereIn('id', missing);
        for (const row of rows) ratings.set(Number(row.id), row.nsfw);
    }
    const isSfw = id => ratings.get(id) === false || ratings.get(id) === 0;
    for (const work of works) {
        if (sfwOnly) work.relatedWorks = (work.relatedWorks || []).filter(related => isSfw(Number(related.id)));
        if (!Array.isArray(work.state?.queue)) continue;
        const state = work.state;
        const originalIndex = Number(state.index) || 0;
        const current = state.queue[originalIndex];
        for (const track of state.queue) {
            track.workId = trackWorkId(track, work.id);
            const nsfw = ratings.get(track.workId);
            track.nsfw = nsfw == null ? null : Boolean(nsfw);
        }
        if (!sfwOnly) continue;
        const queue = state.queue.filter(track => isSfw(track.workId));
        const index = queue.indexOf(current);
        if (queue.length !== state.queue.length) {
            work.state = { ...state, queue, index: Math.max(0, index), seconds: index < 0 ? 0 : state.seconds };
        }
    }
    return works;
}

module.exports = { prepareWorks };
