"use strict";
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

async function resolveItems(items) {
    const workIds = [...new Set(items.map(item => Number(item.work_id)).filter(Number.isInteger))];
    const works = workIds.length > 0
        ? await db.knex('t_work').select('id', 'title', 'root_folder', 'dir', 'memo').whereIn('id', workIds)
        : [];
    const workMap = new Map(works.map(work => [Number(work.id), work]));
    const trackMaps = new Map();
    for (const work of works) {
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
        const track = trackMaps.get(workId) && trackMaps.get(workId).get(relativePath);
        if (track) {
            return {
                ...track,
                itemId: Number(item.id),
                position: Number(item.position),
                available: true,
            };
        }
        const work = workMap.get(workId);
        return {
            itemId: Number(item.id),
            workId,
            relativePath,
            title: item.title,
            workTitle: item.work_title || (work && work.title) || '',
            position: Number(item.position),
            available: false,
        };
    });
}

function playlistItemValidators(optional = false) {
    const arrayValidator = optional ? body('items').optional() : body('items');
    return [
        arrayValidator.isArray({ min: optional ? 0 : 1, max: 10000 }),
        body('items.*.workId').isInt({ min: 1 }),
        body('items.*.relativePath').isString().isLength({ min: 1, max: 2048 }),
        body('items.*.title').isString().isLength({ min: 1, max: 512 }),
        body('items.*.workTitle').optional().isString().isLength({ max: 512 }),
    ];
}

router.get('/', async (req, res, next) => {
    try {
        const username = getRequestUsername(req, config);
        if (!username) {
            res.send({ playlists: [] });
            return;
        }
        const playlists = await db.getPlaylists(username);
        res.send({ playlists: playlists.map(item => ({ ...item, item_count: Number(item.item_count) })) });
    }
    catch (error) {
        next(error);
    }
});

router.post('/', requireAuthenticatedWrite, body('name').trim().isLength({ min: 1, max: 80 }), ...playlistItemValidators(false), async (req, res) => {
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
            res.status(409).send({ error: '播放列表名称已存在' });
            return;
        }
        console.error(error);
        res.status(500).send({ error: '保存播放列表失败' });
    }
});

router.get('/:id', param('id').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const result = await db.getPlaylist(getRequestUsername(req, config), Number(req.params.id));
        if (!result) {
            res.status(404).send({ error: '播放列表不存在' });
            return;
        }
        res.send({ playlist: result.playlist, items: await resolveItems(result.items) });
    }
    catch (error) {
        next(error);
    }
});

router.patch('/:id', requireAuthenticatedWrite, param('id').isInt({ min: 1 }), body('name').trim().isLength({ min: 1, max: 80 }), async (req, res) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const updated = await db.renamePlaylist(getRequestUsername(req, config), Number(req.params.id), req.body.name);
        if (!updated) {
            res.status(404).send({ error: '播放列表不存在' });
            return;
        }
        res.send({ message: '播放列表已重命名' });
    }
    catch (error) {
        const message = String(error && error.message || error);
        res.status(/unique|duplicate/i.test(message) ? 409 : 500).send({ error: /unique|duplicate/i.test(message) ? '播放列表名称已存在' : '重命名播放列表失败' });
    }
});

router.delete('/:id', requireAuthenticatedWrite, param('id').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const deleted = await db.deletePlaylist(getRequestUsername(req, config), Number(req.params.id));
        if (!deleted) {
            res.status(404).send({ error: '播放列表不存在' });
            return;
        }
        res.status(204).end();
    }
    catch (error) {
        next(error);
    }
});

router.post('/:id/items', requireAuthenticatedWrite, param('id').isInt({ min: 1 }), ...playlistItemValidators(false), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const added = await db.addPlaylistItems(getRequestUsername(req, config), Number(req.params.id), req.body.items.map(normalizeInputItem));
        if (!added) {
            res.status(404).send({ error: '播放列表不存在' });
            return;
        }
        res.status(201).send({ message: '曲目已加入播放列表' });
    }
    catch (error) {
        next(error);
    }
});

router.delete('/:id/items/:itemId', requireAuthenticatedWrite, param('id').isInt({ min: 1 }), param('itemId').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const deleted = await db.deletePlaylistItem(getRequestUsername(req, config), Number(req.params.id), Number(req.params.itemId));
        if (!deleted) {
            res.status(404).send({ error: '播放列表或曲目不存在' });
            return;
        }
        res.status(204).end();
    }
    catch (error) {
        next(error);
    }
});

router.put('/:id/items/order', requireAuthenticatedWrite, param('id').isInt({ min: 1 }), body('itemIds').isArray({ min: 0, max: 10000 }), body('itemIds.*').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const reordered = await db.reorderPlaylistItems(getRequestUsername(req, config), Number(req.params.id), req.body.itemIds);
        if (!reordered) {
            res.status(400).send({ error: '播放列表不存在，或曲目顺序与服务器不一致' });
            return;
        }
        res.send({ message: '曲目顺序已保存' });
    }
    catch (error) {
        next(error);
    }
});

exports.default = router;
