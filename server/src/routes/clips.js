"use strict";
const fs = require('node:fs').promises;
const path = require('node:path');
const express = require('express');
const { body, param, query } = require('express-validator');
const { knex } = require('../database/db');
const { config } = require('../config');
const { t } = require('../i18n');
const { requireAuthenticatedWrite, getRequestUsername } = require('../auth/accessControl');
const { isValidRequest } = require('./utils/validate');
const { normalizeTrackPath } = require('../filesystem/trackReference');
const { resolvePathInside } = require('../filesystem/pathSafety');
const { getTrackList, toTree, ensureIsJsonObject, supportedMediaExtList } = require('../filesystem/utils');
const clips = express.Router(), playlists = express.Router();
clips.use(requireAuthenticatedWrite);
playlists.use(requireAuthenticatedWrite);
const user = req => getRequestUsername(req, config);
const idRule = () => param('id').isInt({ min: 1 });
const nameRule = (max = 120) => body('name').isString().trim().isLength({ min: 1, max });
const rangeRules = () => [body('startSeconds').isFloat({ min: 0, max: 2147483647 }), body('endSeconds').isFloat({ min: 0, max: 2147483647 })];
function fail(key, status = 400) { const error = new Error(t(`clips.${key}`)); error.status = status; throw error; }
function report(error, res, next) {
    if (error.status) return res.status(error.status).send({ error: error.message });
    if (/unique|duplicate/i.test(error.message)) return res.status(409).send({ error: t('library.duplicateName') });
    next(error);
}
function userClips(req, connection = knex) {
    const result = connection('t_clip as c').join('t_work as w', 'w.id', 'c.work_id').where('c.user_name', user(req));
    if (req.query.nsfw === '1') result.where('w.nsfw', false);
    return result;
}
async function ownList(req, connection = knex) {
    const list = await connection('t_clip_playlist').where({ id: Number(req.params.id), user_name: user(req) }).first();
    if (!list) fail('missingList', 404);
    return list;
}
async function resolveClip(req, clip, cache = new Map()) {
    if (!cache.has(clip.work_id)) cache.set(clip.work_id, (async () => {
        const work = await knex('t_work').where('id', clip.work_id).first();
        if (!work || (req.query.nsfw === '1' && work.nsfw !== false && work.nsfw !== 0)) fail('missing', 404);
        const root = config.rootFolders.find(folder => folder.name === work.root_folder);
        if (!root) fail('fileMissing', 404);
        await fs.access(root.path);
        const directory = resolvePathInside(path.resolve(root.path), work.dir);
        return { work, root, tracks: await getTrackList(work.id, directory, ensureIsJsonObject(work.memo) || {}) };
    })());
    const { work, root, tracks } = await cache.get(clip.work_id);
    const target = tracks.find(track => track.relativePath === clip.relative_path && supportedMediaExtList.includes(track.ext));
    if (!target) fail('fileMissing', 404);
    if (Number.isFinite(target.duration) && clip.end_seconds > Math.round(target.duration * 1000) / 1000) fail('rangeInvalid');
    let tree = toTree([target], work.title, work.dir, root);
    while (tree[0]?.type === 'folder') tree = tree[0].children;
    return { ...tree[0], nsfw: work.nsfw == null ? null : Boolean(work.nsfw), clipId: clip.id, clipName: clip.name, clipStart: Number(clip.start_seconds), clipEnd: Number(clip.end_seconds) };
}
function inputClip(req) {
    const start_seconds = Number(req.body.startSeconds), end_seconds = Number(req.body.endSeconds);
    if (end_seconds <= start_seconds) fail('rangeInvalid');
    return { start_seconds, end_seconds, name: req.body.name, note: req.body.note || '' };
}

clips.get('/', query('workId').optional().isInt({ min: 1 }), query('relativePath').optional().isString().isLength({ min: 1, max: 2048 }), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        const rows = userClips(req).select('c.*', 'w.title as work_title').orderBy('c.updated_at', 'desc').orderBy('c.id', 'desc');
        if (req.query.workId) rows.where('c.work_id', Number(req.query.workId));
        if (req.query.relativePath) rows.where('c.relative_path', req.query.relativePath.replace(/\\/g, '/'));
        res.send({ clips: await rows });
    } catch (error) { next(error); }
});
clips.post('/', body('workId').isInt({ min: 1 }), body('relativePath').isString().isLength({ min: 1, max: 2048 }), ...rangeRules(), nameRule(), body('note').optional().isString().isLength({ max: 500 }), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        let relative_path;
        try { relative_path = normalizeTrackPath(req.body.relativePath); } catch { fail('rangeInvalid'); }
        const value = { ...inputClip(req), user_name: user(req), work_id: Number(req.body.workId), relative_path };
        await resolveClip(req, value);
        const [id] = await knex('t_clip').insert(value);
        res.status(201).send({ id: Number(id) });
    } catch (error) { report(error, res, next); }
});
clips.patch('/:id', idRule(), ...rangeRules(), nameRule(), body('note').optional().isString().isLength({ max: 500 }), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        const previous = await userClips(req).where('c.id', req.params.id).select('c.*').first();
        if (!previous) fail('missing', 404);
        const value = inputClip(req);
        if (previous.start_seconds !== value.start_seconds || previous.end_seconds !== value.end_seconds) await resolveClip(req, { ...previous, ...value });
        await knex('t_clip').where({ id: previous.id, user_name: user(req) }).update({ ...value, updated_at: knex.fn.now() });
        res.sendStatus(204);
    } catch (error) { report(error, res, next); }
});
clips.delete('/:id', idRule(), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try { res.sendStatus(await knex('t_clip').where({ id: req.params.id, user_name: user(req) }).del() ? 204 : 404); }
    catch (error) { next(error); }
});
clips.post('/:id/resolve', idRule(), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        const clip = await userClips(req).where('c.id', req.params.id).select('c.*').first();
        if (!clip) fail('missing', 404);
        res.send({ tracks: [await resolveClip(req, clip)] });
    } catch (error) { report(error, res, next); }
});

playlists.get('/', async (req, res, next) => {
    try { res.send({ playlists: await knex('t_clip_playlist').where('user_name', user(req)).orderBy('updated_at', 'desc') }); }
    catch (error) { next(error); }
});
playlists.post('/', nameRule(80), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try { const [id] = await knex('t_clip_playlist').insert({ user_name: user(req), name: req.body.name }); res.status(201).send({ id: Number(id) }); }
    catch (error) { report(error, res, next); }
});
playlists.patch('/:id', idRule(), nameRule(80), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try { await ownList(req); await knex('t_clip_playlist').where('id', req.params.id).update({ name: req.body.name, updated_at: knex.fn.now() }); res.sendStatus(204); }
    catch (error) { report(error, res, next); }
});
playlists.delete('/:id', idRule(), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try { await ownList(req); await knex('t_clip_playlist').where('id', req.params.id).del(); res.sendStatus(204); }
    catch (error) { report(error, res, next); }
});
function listItems(req, connection = knex) {
    return userClips(req, connection).join('t_clip_playlist_item as i', 'i.clip_id', 'c.id')
        .where('i.clip_playlist_id', Number(req.params.id)).select('c.*', 'w.title as work_title', 'i.id as item_id', 'i.position').orderBy('i.position').orderBy('i.id');
}
playlists.get('/:id', idRule(), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try { res.send({ playlist: await ownList(req), items: await listItems(req) }); }
    catch (error) { report(error, res, next); }
});
playlists.post('/:id/items', idRule(), body('clipIds').isArray({ min: 1, max: 1000 }), body('clipIds.*').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        await knex.transaction(async trx => {
            await ownList(req, trx);
            const ids = req.body.clipIds.map(Number);
            const allowed = new Set((await userClips(req, trx).whereIn('c.id', ids).select('c.id')).map(row => Number(row.id)));
            if (ids.some(id => !allowed.has(id))) fail('missing', 404);
            const row = await trx('t_clip_playlist_item').where('clip_playlist_id', req.params.id).max('position as position').first();
            let position = Number(row.position ?? -1) + 1;
            for (const clip_id of ids) await trx('t_clip_playlist_item').insert({ clip_playlist_id: Number(req.params.id), clip_id, position: position++ });
            await trx('t_clip_playlist').where('id', req.params.id).update({ updated_at: trx.fn.now() });
        });
        res.sendStatus(201);
    } catch (error) { report(error, res, next); }
});
playlists.delete('/:id/items/:itemId', idRule(), param('itemId').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try { await ownList(req); res.sendStatus(await knex('t_clip_playlist_item').where({ id: req.params.itemId, clip_playlist_id: req.params.id }).del() ? 204 : 404); }
    catch (error) { report(error, res, next); }
});
playlists.put('/:id/items/order', idRule(), body('itemIds').isArray({ max: 1000 }), body('itemIds.*').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        await knex.transaction(async trx => {
            await ownList(req, trx);
            const items = await listItems(req, trx), ids = req.body.itemIds.map(Number);
            if (new Set(ids).size !== ids.length || ids.length !== items.length || ids.some(id => !items.some(item => item.item_id === id))) fail('orderInvalid');
            for (let i = 0; i < ids.length; i++) await trx('t_clip_playlist_item').where('id', ids[i]).update({ position: items[i].position });
        });
        res.sendStatus(204);
    } catch (error) { report(error, res, next); }
});
playlists.post('/:id/resolve', idRule(), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        await ownList(req);
        const items = await listItems(req), tracks = [], unavailable = [], cache = new Map();
        for (const clip of items) {
            try { tracks.push(await resolveClip(req, clip, cache)); }
            catch { unavailable.push(clip.item_id); }
        }
        if (!tracks.length) fail('fileMissing', 404);
        res.send({ tracks, unavailable });
    } catch (error) { report(error, res, next); }
});
module.exports = { clips, playlists };
