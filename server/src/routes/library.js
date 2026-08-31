"use strict";

const express = require("express");
const { body, param, query } = require("express-validator");
const { config } = require("../config");
const db = require("../database/db");
const { getRequestUsername, requireAuthenticatedWrite } = require("../auth/accessControl");
const normalize = require("./utils/normalize").default;
const { isValidRequest } = require("./utils/validate");

const router = express.Router();
const PAGE_SIZE = config.pageSize || 12;

function username(req) {
    return getRequestUsername(req, config);
}

router.get('/archived', query('page').optional().isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const currentPage = Number(req.query.page) || 1;
        const { works, totalCount } = await db.getArchivedWorks(username(req), {
            limit: PAGE_SIZE,
            offset: (currentPage - 1) * PAGE_SIZE,
        });
        normalize(works, { dateOnly: true });
        res.send({ works, pagination: { currentPage, pageSize: PAGE_SIZE, totalCount } });
    }
    catch (error) {
        next(error);
    }
});

router.put('/works/:workId/archive', requireAuthenticatedWrite, param('workId').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const archived = await db.archiveWork(username(req), Number(req.params.workId));
        if (!archived) {
            res.status(404).send({ error: '作品不存在' });
            return;
        }
        res.send({ message: '作品已归档' });
    }
    catch (error) {
        next(error);
    }
});

router.delete('/works/:workId/archive', requireAuthenticatedWrite, param('workId').isInt({ min: 1 }), async (req, res, next) => {
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
        const collections = await db.getWorkCollections(username(req));
        res.send({ collections: collections.map(item => ({ ...item, item_count: Number(item.item_count) })) });
    }
    catch (error) {
        next(error);
    }
});

router.post('/collections', requireAuthenticatedWrite, body('name').trim().isLength({ min: 1, max: 80 }), async (req, res) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const id = await db.createWorkCollection(username(req), req.body.name);
        res.status(201).send({ id: Number(id) });
    }
    catch (error) {
        const duplicate = /unique|duplicate/i.test(String(error && error.message || error));
        res.status(duplicate ? 409 : 500).send({ error: duplicate ? '分组名称已存在' : '创建作品分组失败' });
    }
});

router.get('/collections/:id', param('id').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const result = await db.getWorkCollection(username(req), Number(req.params.id));
        if (!result) {
            res.status(404).send({ error: '作品分组不存在' });
            return;
        }
        normalize(result.items, { dateOnly: true });
        res.send(result);
    }
    catch (error) {
        next(error);
    }
});

router.patch('/collections/:id', requireAuthenticatedWrite, param('id').isInt({ min: 1 }), body('name').trim().isLength({ min: 1, max: 80 }), async (req, res) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const updated = await db.renameWorkCollection(username(req), Number(req.params.id), req.body.name);
        if (!updated) {
            res.status(404).send({ error: '作品分组不存在' });
            return;
        }
        res.send({ message: '作品分组已重命名' });
    }
    catch (error) {
        const duplicate = /unique|duplicate/i.test(String(error && error.message || error));
        res.status(duplicate ? 409 : 500).send({ error: duplicate ? '分组名称已存在' : '重命名作品分组失败' });
    }
});

router.delete('/collections/:id', requireAuthenticatedWrite, param('id').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const deleted = await db.deleteWorkCollection(username(req), Number(req.params.id));
        if (!deleted) {
            res.status(404).send({ error: '作品分组不存在' });
            return;
        }
        res.status(204).end();
    }
    catch (error) {
        next(error);
    }
});

router.post('/collections/:id/items', requireAuthenticatedWrite, param('id').isInt({ min: 1 }), body('workIds').isArray({ min: 1, max: 1000 }), body('workIds.*').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const workIds = [...new Set(req.body.workIds.map(Number))];
        const added = await db.addWorkCollectionItems(username(req), Number(req.params.id), workIds);
        if (added === null) {
            res.status(404).send({ error: '作品分组不存在' });
            return;
        }
        res.status(201).send({ message: added ? `已加入 ${added} 个作品` : '所选作品已在分组中', added });
    }
    catch (error) {
        next(error);
    }
});

router.delete('/collections/:id/items/:workId', requireAuthenticatedWrite, param('id').isInt({ min: 1 }), param('workId').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const deleted = await db.removeWorkCollectionItem(username(req), Number(req.params.id), Number(req.params.workId));
        if (deleted === null) {
            res.status(404).send({ error: '作品分组不存在' });
            return;
        }
        res.status(204).end();
    }
    catch (error) {
        next(error);
    }
});

router.put('/collections/:id/items/order', requireAuthenticatedWrite, param('id').isInt({ min: 1 }), body('workIds').isArray({ min: 0, max: 1000 }), body('workIds.*').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res))
        return;
    try {
        const reordered = await db.reorderWorkCollectionItems(username(req), Number(req.params.id), req.body.workIds.map(Number));
        if (!reordered) {
            res.status(400).send({ error: '作品分组不存在，或作品顺序与服务器不一致' });
            return;
        }
        res.send({ message: '作品顺序已保存' });
    }
    catch (error) {
        next(error);
    }
});

module.exports = router;
