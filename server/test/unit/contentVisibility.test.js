"use strict";

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'kikoeru-content-visibility-'));
fs.mkdirSync(path.join(runtime, 'config'), { recursive: true });
fs.mkdirSync(path.join(runtime, 'sqlite'), { recursive: true });
fs.writeFileSync(path.join(runtime, 'config/config.json'), JSON.stringify({ sqliteType: 'better-sqlite3', dbUseDefaultPath: true }));
process.env.KIKOERU_DATA_DIR = runtime;
process.env.FREEZE_CONFIG_FILE = '1';
process.env.NODE_ENV = 'test';
const { config } = require('../../src/config');
config.auth = false;
config.pageSize = 1;
config.rootFolders = [];
const db = require('../../src/database/db');
const { createSchema } = require('../../src/database/schema');
const { prepareWorks } = require('../../src/routes/utils/workVisibility');
let server;
let baseUrl;
let playlistId;
let collectionId;

test.before(async () => {
    await createSchema(db.knex);
    await db.knex('t_user').insert({ name: 'admin', password: 'admin', group: 'administrator' });
    await db.knex('t_circle').insert({ id: 1, name: 'Circle' });
    await db.knex('t_work').insert([false, true, null, false].map((nsfw, index) => ({
        id: index + 1, nsfw, title: `Work ${index + 1}`, circle_id: 1,
        root_folder: 'test', dir: String(index + 1), lyric_status: '',
        release: '2026-09-08', rate_count_detail: '{}', memo: '{}',
    })));
    await db.knex('t_tag').insert([{ id: 1, name: 'Visible tag' }, { id: 2, name: 'Hidden tag' }]);
    await db.knex('r_tag_work').insert([{ tag_id: 1, work_id: 1 }, { tag_id: 1, work_id: 2 }, { tag_id: 2, work_id: 2 }]);
    const queue = [2, 1, 3, 4].map(id => ({ hash: `${id}/0`, title: `Track ${id}`, workTitle: `Work ${id}` }));
    for (const id of [1, 2, 3, 4]) {
        await db.updatePlayHistroy('admin', id, JSON.stringify({ queue, index: 1, seconds: 17 }));
        await db.updateUserReview('admin', id, 5, '', 'marked', false, false);
    }
    playlistId = await db.createPlaylist('admin', 'Mixed playlist', [2, 1, 3, 4].map(id => ({ work_id: id, relative_path: 'Track.mp3', title: `Track ${id}`, work_title: `Work ${id}` })));
    collectionId = await db.createWorkCollection('admin', 'Mixed collection');
    await db.addWorkCollectionItems('admin', collectionId, [2, 1, 3, 4]);
    const app = express();
    app.use('/api/histroy', require('../../src/routes/play_histroy').default);
    app.use('/api/review', require('../../src/routes/review').default);
    app.use('/api/playlists', require('../../src/routes/playlist').default);
    app.use('/api/library', require('../../src/routes/library'));
    app.use('/api', require('../../src/routes/metadata').default);
    server = await new Promise(resolve => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.knex.destroy();
    fs.rmSync(runtime, { recursive: true, force: true });
});

async function get(url) {
    const response = await fetch(`${baseUrl}${url}`);
    assert.equal(response.status, 200, url);
    return response.json();
}

test('SFW filtering precedes pagination in works, search, recent history and favourites', async () => {
    for (const url of ['/works?', '/search?keyword=Work&', '/circles/1/works?', '/histroy?', '/review?']) {
        const all = await get(`${url}page=1`);
        assert.equal(all.pagination.totalCount, 4, url);
        const first = await get(`${url}nsfw=1&page=1`);
        const second = await get(`${url}nsfw=1&page=2`);
        assert.equal(first.pagination.totalCount, 2, url);
        assert.equal(first.works.length, 1, url);
        assert.equal(second.works.length, 1, url);
        assert.deepEqual([...first.works, ...second.works].map(work => Number(work.id)).sort(), [1, 4], url);
    }
});

test('history queues omit hidden tracks and keep the selected visible track and position', async () => {
    const original = await db.knex('t_play_histroy').where('work_id', 1).first();
    const work = await get('/work/1?nsfw=1');
    assert.deepEqual(work.state.queue.map(track => track.workId), [1, 4]);
    assert.equal(work.state.index, 0);
    assert.equal(work.state.seconds, 17);
    assert.ok(work.state.queue.every(track => track.nsfw === false));
    const stored = await db.knex('t_play_histroy').where('work_id', 1).first();
    assert.equal(stored.state, original.state);
    const unrestricted = await get('/work/1');
    assert.equal(unrestricted.state.queue.length, 4);
});

test('hidden current tracks reset the visible queue position and related works are filtered', async () => {
    const [work] = await prepareWorks([{
        id: 1, nsfw: false, relatedWorks: [{ id: 2 }, { id: 3 }, { id: 4 }],
        state: { queue: [{ hash: '2/0' }, { hash: '1/0' }], index: 0, seconds: 42 },
    }], true);
    assert.deepEqual(work.relatedWorks.map(item => item.id), [4]);
    assert.equal(work.state.index, 0);
    assert.equal(work.state.seconds, 0);
    assert.deepEqual(work.state.queue.map(track => track.workId), [1]);
});

test('direct NSFW and unrated details and file listings are hidden only in SFW mode', async () => {
    for (const id of [2, 3]) {
        assert.equal((await fetch(`${baseUrl}/work/${id}?nsfw=1`)).status, 404);
        assert.equal((await fetch(`${baseUrl}/tracks/${id}?nsfw=1`)).status, 404);
        assert.equal(Number((await get(`/work/${id}`)).id), id);
    }
});

test('collections and saved playlists filter items and counts without removing saved data', async () => {
    assert.equal((await get('/playlists?nsfw=1')).playlists[0].item_count, 2);
    assert.equal((await get('/library/collections?nsfw=1')).collections[0].item_count, 2);
    const playlist = await get(`/playlists/${playlistId}?nsfw=1`);
    const collection = await get(`/library/collections/${collectionId}?nsfw=1`);
    assert.deepEqual(playlist.items.map(item => item.workId), [1, 4]);
    assert.deepEqual(collection.items.map(item => Number(item.id)), [1, 4]);
    assert.equal((await get(`/playlists/${playlistId}`)).items.length, 4);
    assert.equal((await get(`/library/collections/${collectionId}`)).items.length, 4);
    assert.equal((await get('/playlists')).playlists[0].item_count, 4);
});

test('archived works use filtered pagination while preserving archive records', async () => {
    for (const id of [1, 2, 3, 4]) await db.archiveWork('admin', id);
    try {
        const visible = await get('/library/archived?nsfw=1');
        assert.equal(visible.pagination.totalCount, 2);
        assert.equal(visible.works.length, 1);
        assert.equal(visible.works[0].nsfw, false);
        assert.equal((await get('/library/archived')).pagination.totalCount, 4);
    } finally {
        for (const id of [1, 2, 3, 4]) await db.unarchiveWork('admin', id);
    }
});

test('label lists and counts only include visible works in SFW mode', async () => {
    const tags = await get('/tags/?nsfw=1');
    assert.deepEqual(tags.map(tag => Number(tag.id)), [1]);
    assert.equal(Number(tags[0].count), 1);
    assert.equal((await get('/tags/')).length, 2);
    assert.equal(Number((await get('/circles/?nsfw=1'))[0].count), 2);
});

test('reordering visible collection and playlist items preserves hidden positions and membership', async () => {
    const original = await db.getPlaylist('admin', playlistId);
    const visibleIds = original.items.filter(item => [1, 4].includes(Number(item.work_id))).map(item => Number(item.id));
    assert.equal(await db.reorderPlaylistItems('admin', playlistId, visibleIds.slice().reverse(), true), true);
    assert.deepEqual((await db.getPlaylist('admin', playlistId)).items.map(item => Number(item.work_id)), [2, 4, 3, 1]);
    assert.equal(await db.reorderPlaylistItems('admin', playlistId, [visibleIds[0]], true), false);
    assert.equal(await db.reorderWorkCollectionItems('admin', collectionId, [4, 1], true), true);
    assert.deepEqual((await db.getWorkCollection('admin', collectionId)).items.map(item => Number(item.id)), [2, 4, 3, 1]);
    assert.equal(await db.reorderWorkCollectionItems('admin', collectionId, [4, 2], true), false);
});
