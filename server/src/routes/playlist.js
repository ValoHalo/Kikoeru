"use strict";
const { t } = require('../i18n');
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const path = require("path");
const { body, param } = require("express-validator");
const { config } = require("../config");
const db = require("../database/db");
const { getRequestUsername, requireAuthenticatedWrite } = require("../auth/accessControl");
const { ensureIsJsonObject, getTrackList, toTree } = require("../filesystem/utils");
const { isValidRequest } = require("./utils/validate");

const router = express.Router();

function flattenAudioTracks(tree, result = []) {
    for (const item of tree) {
        if (item.type === 'folder' && Array.isArray(item.children)) {
            flattenAudioTracks(item.children, result);
        }
        else if (item.type === 'audio') {
            result.push(item);
        }
    }
    return result;
}

function normalizeRelativePath(value) {
    return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function normalizeInputItem(item) {
    const relativePath = normalizeRelativePath(item.relativePath || [item.subtitle, item.title].filter(Boolean).join('/'));
    return {
        work_id: Number(item.workId),
        relative_path: relativePath,
        title: String(item.title || relativePath.split('/').pop() || ''),
        work_title: String(item.workTitle || ''),
    };
}

async function resolveItems(items, sfwOnly = false) {
    const workIds = [...new Set(items.map(item => Number(item.work_id)).filter(Number.isInteger))];
    const works = workIds.length > 0
        ? await db.knex('t_work').select('id', 'title', 'root_folder', 'dir', 'memo', 'nsfw').whereIn('id', workIds)
        : [];
    const workMap = new Map(works.map(work => [Number(work.id), work]));
    if (sfwOnly) items = items.filter(item => {
        const work = workMap.get(Number(item.work_id));
        return work && (work.nsfw === false || work.nsfw === 0);
    });
    const trackMaps = new Map();
    for (const work of works) {
        if (sfwOnly && work.nsfw !== false && work.nsfw !== 0) continue;
        const rootFolder = config.rootFolders.find(folder => folder.name === work.root_folder);
        const trackMap = new Map();
        if (rootFolder) {
            try {
                const memo = ensureIsJsonObject(work.memo) || {};
                const tracks = await getTrackList(work.id, path.join(rootFolder.path, work.dir), memo);
                const tree = toTree(tracks, work.title, work.dir, rootFolder);
                for (const track of flattenAudioTracks(tree)) {
                    trackMap.set(normalizeRelativePath(track.relativePath), track);
                }
            }
            catch (error) {
                console.warn(`Failed to resolve playlist tracks for work ${work.id}:`, error.message || error);
            }
        }
        trackMaps.set(Number(work.id), trackMap);
    }
    return items.map(item => {
        const workId = Number(item.work_id);
        const relativePath = normalizeRelativePath(item.relative_path);
        const work = workMap.get(workId);
        const nsfw = work?.nsfw == null ? null : Boolean(work.nsfw);
        const track = trackMaps.get(workId) && trackMaps.get(workId).get(relativePath);
        if (track) {
            return {
                ...track,
                nsfw,
                itemId: Number(item.id),
                position: Number(item.position),
                available: true,
            };
        }
        return {
            itemId: Number(item.id),
            workId,
            nsfw,
            relativePath,
            title: item.title,
            workTitle: item.work_title || (work && work.title) || '',
            position: Number(item.position),
            available: false,
        };
    });
}

function playlistItemValidators(optional = false) {
    const arrayValidator = optional ? body('items', (_value, { path }) => t('validation.invalidValue', { field: path })).optional() : body('items', (_value, { path }) => t('validation.invalidValue', { field: path }));
    return [
        arrayValidator.isArray({ min: optional ? 0 : 1, max: 10000 }),
        body('items.*.workId', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }),
        body('items.*.relativePath', (_value, { path }) => t('validation.invalidValue', { field: path })).isString().isLength({ min: 1, max: 2048 }),
        body('items.*.title', (_value, { path }) => t('validation.invalidValue', { field: path })).isString().isLength({ min: 1, max: 512 }),
        body('items.*.workTitle', (_value, { path }) => t('validation.invalidValue', { field: path })).optional().isString().isLength({ max: 512 }),
    ];
}

router.get('/', async (req, res, next) => {
    try {
        const username = getRequestUsername(req, config);
        if (!username) {
            res.send({ playlists: [] });
            return;
        }
        const playlists = await db.getPlaylists(username, req.query.nsfw === '1');
        res.send({ playlists: playlists.map(item => ({ ...item, item_count: Number(item.item_count) })) });
    }
    catch (error) {
        next(error);
    }
});

router.post('/', requireAuthenticatedWrite, body('name', (_value, { path }) => t('validation.invalidValue', { field: path })).trim().isLength({ min: 1, max: 80 }), ...playlistItemValidators(false), async (req, res) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const username = getRequestUsername(req, config);
        const items = (req.body.items || []).map(normalizeInputItem);
        const id = await db.createPlaylist(username, req.body.name, items);
        res.status(201).send({ id: Number(id) });
    }
    catch (error) {
        const message = String(error && error.message || error);
        if (/unique|duplicate/i.test(message)) {
            res.status(409).send({ error: t('playlist.duplicateName') });
            return;
        }
        console.error(error);
        res.status(500).send({ error: t('playlist.saveFailed') });
    }
});

router.get('/:id', param('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const result = await db.getPlaylist(getRequestUsername(req, config), Number(req.params.id));
        if (!result) {
            res.status(404).send({ error: t('playlist.missing') });
            return;
        }
        res.send({ playlist: result.playlist, items: await resolveItems(result.items, req.query.nsfw === '1') });
    }
    catch (error) {
        next(error);
    }
});

router.patch('/:id', requireAuthenticatedWrite, param('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), body('name', (_value, { path }) => t('validation.invalidValue', { field: path })).trim().isLength({ min: 1, max: 80 }), async (req, res) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const updated = await db.renamePlaylist(getRequestUsername(req, config), Number(req.params.id), req.body.name);
        if (!updated) {
            res.status(404).send({ error: t('playlist.missing') });
            return;
        }
        res.send({ message: t('playlist.renamed') });
    }
    catch (error) {
        const message = String(error && error.message || error);
        res.status(/unique|duplicate/i.test(message) ? 409 : 500).send({ error: /unique|duplicate/i.test(message) ? t('playlist.duplicateName') : t('playlist.renameFailed') });
    }
});

router.delete('/:id', requireAuthenticatedWrite, param('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const deleted = await db.deletePlaylist(getRequestUsername(req, config), Number(req.params.id));
        if (!deleted) {
            res.status(404).send({ error: t('playlist.missing') });
            return;
        }
        res.status(204).end();
    }
    catch (error) {
        next(error);
    }
});

router.post('/:id/items', requireAuthenticatedWrite, param('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), ...playlistItemValidators(false), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const added = await db.addPlaylistItems(getRequestUsername(req, config), Number(req.params.id), req.body.items.map(normalizeInputItem));
        if (!added) {
            res.status(404).send({ error: t('playlist.missing') });
            return;
        }
        res.status(201).send({ message: t('playlist.tracksAdded') });
    }
    catch (error) {
        next(error);
    }
});

router.delete('/:id/items/:itemId', requireAuthenticatedWrite, param('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), param('itemId', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const deleted = await db.deletePlaylistItem(getRequestUsername(req, config), Number(req.params.id), Number(req.params.itemId));
        if (!deleted) {
            res.status(404).send({ error: t('playlist.trackMissing') });
            return;
        }
        res.status(204).end();
    }
    catch (error) {
        next(error);
    }
});

router.put('/:id/items/order', requireAuthenticatedWrite, param('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), body('itemIds', (_value, { path }) => t('validation.invalidValue', { field: path })).isArray({ min: 0, max: 10000 }), body('itemIds.*', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const reordered = await db.reorderPlaylistItems(getRequestUsername(req, config), Number(req.params.id), req.body.itemIds, req.query.nsfw === '1');
        if (!reordered) {
            res.status(400).send({ error: t('playlist.orderMismatch') });
            return;
        }
        res.send({ message: t('playlist.orderSaved') });
    }
    catch (error) {
        next(error);
    }
});

exports.default = router;
