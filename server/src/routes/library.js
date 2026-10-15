"use strict";
const { t } = require('../i18n');

const express = require("express");
const { body, param, query } = require("express-validator");
const { config } = require("../config");
const db = require("../database/db");
const { getRequestUsername, requireAuthenticatedWrite } = require("../auth/accessControl");
const normalize = require("./utils/normalize").default;
const { isValidRequest } = require("./utils/validate");
const { prepareWorks } = require('./utils/workVisibility');

const router = express.Router();
const PAGE_SIZE = config.pageSize || 12;

router.post('/batch', requireAuthenticatedWrite,
    body('workIds').isArray({ min: 1, max: 1000 }), body('workIds.*').isInt({ min: 1 }),
    body('action').isIn(['archive', 'unarchive', 'progress', 'collection']),
    body('progress').optional({ nullable: true }).isIn(['marked', 'listening', 'listened', 'replay', 'postponed']),
    body('collectionId').optional().isInt({ min: 1 }), async (req, res, next) => {
        if (!isValidRequest(req, res)) return;
        const { action, progress, collectionId } = req.body;
        if ((action === 'progress' && progress === undefined) || (action === 'collection' && !collectionId)) return res.status(400).send({ error: t('library.batchInvalid') });
        try {
            const result = await db.knex.transaction(async trx => {
                const user_name = username(req);
                const requested = [...new Set(req.body.workIds.map(Number))];
                const works = trx('t_work').whereIn('id', requested).select('id');
                if (req.query.nsfw === '1') works.where('nsfw', false);
                const ids = (await works).map(row => Number(row.id));
                const changed = [], unchanged = [];
                if (action === 'collection' && !(await trx('t_work_collection').where({ id: collectionId, user_name }).first())) {
                    const error = new Error(t('library.collectionMissing')); error.status = 404; throw error;
                }
                let position = action === 'collection' ? Number((await trx('t_work_collection_item').where('collection_id', collectionId).max('position as position').first()).position ?? -1) + 1 : 0;
                for (const work_id of ids) {
                    if (action === 'progress') {
                        const previous = await trx('t_review').where({ user_name, work_id }).first();
                        if ((previous?.progress ?? null) === progress) { unchanged.push(work_id); continue; }
                        await trx('t_review').insert({ user_name, work_id, progress }).onConflict(['user_name', 'work_id']).merge({ progress, updated_at: trx.fn.now() });
                    } else if (action === 'collection') {
                        const identity = { collection_id: Number(collectionId), work_id };
                        if (await trx('t_work_collection_item').where(identity).first()) { unchanged.push(work_id); continue; }
                        await trx('t_work_collection_item').insert({ ...identity, position: position++ });
                    } else {
                        const previous = await trx('t_work_user_state').where({ user_name, work_id }).first();
                        if (Boolean(previous) === (action === 'archive')) { unchanged.push(work_id); continue; }
                        if (action === 'archive') await trx('t_work_user_state').insert({ user_name, work_id });
                        else await trx('t_work_user_state').where({ user_name, work_id }).del();
                    }
                    changed.push(work_id);
                }
                return { changed, unchanged, missing: requested.filter(id => !ids.includes(id)) };
            });
            res.send(result);
        } catch (error) {
            if (error.status) return res.status(error.status).send({ error: error.message });
            next(error);
        }
    });

router.get('/missing', query('page').optional().isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        const currentPage = Number(req.query.page) || 1;
        const { works, totalCount } = await db.getMissingWorks(username(req), {
            limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE, nsfw: req.query.nsfw === '1' ? 1 : 0,
        });
        normalize(works, { dateOnly: true });
        await prepareWorks(works, req.query.nsfw === '1');
        res.send({ works, pagination: { currentPage, pageSize: PAGE_SIZE, totalCount } });
    }
    catch (error) { next(error); }
});

function username(req) {
    return getRequestUsername(req, config);
}

router.get('/archived', query('page', (_value, { path }) => t('validation.invalidValue', { field: path })).optional().isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const currentPage = Number(req.query.page) || 1;
        const { works, totalCount } = await db.getArchivedWorks(username(req), {
            limit: PAGE_SIZE,
            offset: (currentPage - 1) * PAGE_SIZE,
            nsfw: req.query.nsfw === '1' ? 1 : 0,
        });
        normalize(works, { dateOnly: true });
        await prepareWorks(works, req.query.nsfw === '1');
        res.send({ works, pagination: { currentPage, pageSize: PAGE_SIZE, totalCount } });
    }
    catch (error) {
        next(error);
    }
});

router.put('/works/:workId/archive', requireAuthenticatedWrite, param('workId', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const archived = await db.archiveWork(username(req), Number(req.params.workId));
        if (!archived) {
            res.status(404).send({ error: t('library.workMissing') });
            return;
        }
        res.send({ message: t('library.archived') });
    }
    catch (error) {
        next(error);
    }
});

router.delete('/works/:workId/archive', requireAuthenticatedWrite, param('workId', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        await db.unarchiveWork(username(req), Number(req.params.workId));
        res.status(204).end();
    }
    catch (error) {
        next(error);
    }
});

router.get('/collections', async (req, res, next) => {
    try {
        const collections = await db.getWorkCollections(username(req), req.query.nsfw === '1');
        res.send({ collections: collections.map(item => ({ ...item, item_count: Number(item.item_count) })) });
    }
    catch (error) {
        next(error);
    }
});

router.post('/collections', requireAuthenticatedWrite, body('name', (_value, { path }) => t('validation.invalidValue', { field: path })).trim().isLength({ min: 1, max: 80 }), async (req, res) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const id = await db.createWorkCollection(username(req), req.body.name);
        res.status(201).send({ id: Number(id) });
    }
    catch (error) {
        const duplicate = /unique|duplicate/i.test(String(error && error.message || error));
        res.status(duplicate ? 409 : 500).send({ error: duplicate ? t('library.duplicateName') : t('library.createFailed') });
    }
});

router.get('/collections/:id', param('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const result = await db.getWorkCollection(username(req), Number(req.params.id));
        if (!result) {
            res.status(404).send({ error: t('library.collectionMissing') });
            return;
        }
        normalize(result.items, { dateOnly: true });
        if (req.query.nsfw === '1') result.items = result.items.filter(work => work.nsfw === false);
        await prepareWorks(result.items, req.query.nsfw === '1');
        res.send(result);
    }
    catch (error) {
        next(error);
    }
});

router.patch('/collections/:id', requireAuthenticatedWrite, param('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), body('name', (_value, { path }) => t('validation.invalidValue', { field: path })).trim().isLength({ min: 1, max: 80 }), async (req, res) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const updated = await db.renameWorkCollection(username(req), Number(req.params.id), req.body.name);
        if (!updated) {
            res.status(404).send({ error: t('library.collectionMissing') });
            return;
        }
        res.send({ message: t('library.renamed') });
    }
    catch (error) {
        const duplicate = /unique|duplicate/i.test(String(error && error.message || error));
        res.status(duplicate ? 409 : 500).send({ error: duplicate ? t('library.duplicateName') : t('library.renameFailed') });
    }
});

router.delete('/collections/:id', requireAuthenticatedWrite, param('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const deleted = await db.deleteWorkCollection(username(req), Number(req.params.id));
        if (!deleted) {
            res.status(404).send({ error: t('library.collectionMissing') });
            return;
        }
        res.status(204).end();
    }
    catch (error) {
        next(error);
    }
});

router.post('/collections/:id/items', requireAuthenticatedWrite, param('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), body('workIds', (_value, { path }) => t('validation.invalidValue', { field: path })).isArray({ min: 1, max: 1000 }), body('workIds.*', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const workIds = [...new Set(req.body.workIds.map(Number))];
        const added = await db.addWorkCollectionItems(username(req), Number(req.params.id), workIds);
        if (added === null) {
            res.status(404).send({ error: t('library.collectionMissing') });
            return;
        }
        res.status(201).send({ message: added ? t('library.added', { count: added }) : t('library.alreadyAdded'), added });
    }
    catch (error) {
        next(error);
    }
});

router.delete('/collections/:id/items/:workId', requireAuthenticatedWrite, param('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), param('workId', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const deleted = await db.removeWorkCollectionItem(username(req), Number(req.params.id), Number(req.params.workId));
        if (deleted === null) {
            res.status(404).send({ error: t('library.collectionMissing') });
            return;
        }
        res.status(204).end();
    }
    catch (error) {
        next(error);
    }
});

router.put('/collections/:id/items/order', requireAuthenticatedWrite, param('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), body('workIds', (_value, { path }) => t('validation.invalidValue', { field: path })).isArray({ min: 0, max: 1000 }), body('workIds.*', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const reordered = await db.reorderWorkCollectionItems(username(req), Number(req.params.id), req.body.workIds.map(Number), req.query.nsfw === '1');
        if (!reordered) {
            res.status(400).send({ error: t('library.orderMismatch') });
            return;
        }
        res.send({ message: t('library.orderSaved') });
    }
    catch (error) {
        next(error);
    }
});

module.exports = router;
