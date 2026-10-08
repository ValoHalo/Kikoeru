"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const fs = require("fs");
const path = require("path");
const { body, param, query } = require("express-validator");
const { t } = require("../i18n");
const { config } = require("../config");
const db = require("../database/db");
const { getRequestUsername, requireAuthenticatedWrite } = require("../auth/accessControl");
const { ensureIsJsonObject, getTrackList, toTree, supportedMediaExtList } = require("../filesystem/utils");
const { resolvePathInside } = require("../filesystem/pathSafety");
const { isValidRequest } = require("./utils/validate");

const router = express.Router();
const invalidValue = (_value, { path }) => t('validation.invalidValue', { field: path });
const bookmarkId = () => param('id', invalidValue).isInt({ min: 1 });
const name = () => body('name', invalidValue).isString().trim().isLength({ max: 120 });
const note = () => body('note', invalidValue).isString().trim().isLength({ max: 500 });

function userBookmarks(req) {
    return db.knex('t_bookmark').where('user_name', getRequestUsername(req, config));
}

function visibleWorks(req) {
    const works = db.knex('t_work');
    if (req.query.nsfw === '1') works.where('nsfw', false);
    return works;
}

function relativePathValidator(validator) {
    return validator.isString().isLength({ min: 1, max: 2048 }).bail()
        .customSanitizer(value => value.replace(/\\/g, '/'))
        .custom(value => {
            resolvePathInside(path.resolve('.'), value);
            return !path.win32.isAbsolute(value) && value.split('/').every(part => part && part !== '.' && part !== '..');
        });
}

router.get('/', query('workId', invalidValue).isInt({ min: 1 }),
    relativePathValidator(query('relativePath', invalidValue).optional()), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        if (!getRequestUsername(req, config)) return res.send({ bookmarks: [] });
        const rows = userBookmarks(req).select('id', 'work_id', 'relative_path', 'seconds', 'name', 'note')
            .where('work_id', Number(req.query.workId))
            .whereIn('work_id', visibleWorks(req).select('id'));
        if (req.query.relativePath !== undefined) rows.where('relative_path', req.query.relativePath);
        res.send({ bookmarks: await rows.orderBy('relative_path').orderBy('seconds').orderBy('id') });
    }
    catch (error) { next(error); }
});

router.post('/', requireAuthenticatedWrite, body('workId', invalidValue).isInt({ min: 1 }),
    relativePathValidator(body('relativePath', invalidValue)),
    body('seconds', invalidValue).isInt({ min: 0, max: 2147483647 }), name().optional(), note().optional(), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        const work = await visibleWorks(req).where('id', Number(req.body.workId)).first('id');
        if (!work) return res.status(404).send({ error: t('metadata.unavailable') });
        const bookmark = {
            user_name: getRequestUsername(req, config),
            work_id: Number(req.body.workId),
            relative_path: req.body.relativePath,
            seconds: Number(req.body.seconds),
            name: req.body.name || '',
            note: req.body.note || '',
        };
        const [id] = await db.knex('t_bookmark').insert(bookmark);
        res.status(201).send({ id: Number(id) });
    }
    catch (error) { next(error); }
});

router.patch('/:id', requireAuthenticatedWrite, bookmarkId(), name().optional(), note().optional(),
    body('', invalidValue).custom(value => value.name !== undefined || value.note !== undefined), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        const changes = {};
        if (req.body.name !== undefined) changes.name = req.body.name;
        if (req.body.note !== undefined) changes.note = req.body.note;
        const updated = await userBookmarks(req).where('id', Number(req.params.id)).update(changes);
        if (!updated) return res.status(404).send({ error: t('bookmark.missing') });
        res.status(204).end();
    }
    catch (error) { next(error); }
});

router.delete('/:id', requireAuthenticatedWrite, bookmarkId(), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        const deleted = await userBookmarks(req).where('id', Number(req.params.id)).del();
        if (!deleted) return res.status(404).send({ error: t('bookmark.missing') });
        res.status(204).end();
    }
    catch (error) { next(error); }
});

router.post('/:id/resolve', requireAuthenticatedWrite, bookmarkId(), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        const bookmark = await userBookmarks(req).where('id', Number(req.params.id)).first();
        if (!bookmark) return res.status(404).send({ error: t('bookmark.missing') });
        const work = await visibleWorks(req).where('id', bookmark.work_id).first();
        if (!work) return res.status(404).send({ error: t('metadata.unavailable') });
        const rootFolder = config.rootFolders.find(folder => folder.name === work.root_folder);
        if (!rootFolder) return res.status(500).send({ error: t('media.folderMissing', { root_folder: work.root_folder }) });
        // A disconnected library is a request failure, not a missing bookmark target.
        await fs.promises.access(rootFolder.path);
        const workDirectory = resolvePathInside(rootFolder.path, work.dir);
        const fileName = resolvePathInside(workDirectory, bookmark.relative_path);
        let missing = false;
        try {
            missing = !(await fs.promises.stat(fileName)).isFile();
        }
        catch (error) {
            if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
            missing = true;
        }
        if (missing) {
            await userBookmarks(req).where('id', bookmark.id).del();
            return res.status(410).send({ code: 'BOOKMARK_FILE_MISSING', error: t('bookmark.fileMissing') });
        }
        const tracks = await getTrackList(work.id, workDirectory, ensureIsJsonObject(work.memo) || {});
        const target = tracks.find(track => track.relativePath === bookmark.relative_path && supportedMediaExtList.includes(track.ext));
        if (!target) return res.status(404).send({ error: t('bookmark.trackUnavailable') });
        let tree = toTree(tracks.filter(track => track.subtitle === target.subtitle && supportedMediaExtList.includes(track.ext)), work.title, work.dir, rootFolder);
        while (tree.length === 1 && tree[0].type === 'folder') tree = tree[0].children;
        const queue = tree.map(track => ({ ...track, nsfw: work.nsfw == null ? null : Boolean(work.nsfw) }));
        res.send({ queue, index: queue.findIndex(track => track.relativePath === bookmark.relative_path), seconds: bookmark.seconds });
    }
    catch (error) { next(error); }
});

exports.default = router;
