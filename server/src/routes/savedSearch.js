"use strict";
const router = require('express').Router();
const { body, param } = require('express-validator');
const { isValidRequest } = require('./utils/validate');
const { requireAuthenticatedWrite, getRequestUsername } = require('../auth/accessControl');
const { knex } = require('../database/db');
const { config } = require('../config');
const { normalizeSavedSearch } = require('../database/savedSearch');
const { t } = require('../i18n');
router.use(requireAuthenticatedWrite);
const rows = req => knex('t_saved_search').where('user_name', getRequestUsername(req, config));
router.get('/', async (req, res, next) => {
    try {
        const searches = await rows(req).orderBy('name').select('id', 'name', 'query');
        res.send({ searches: searches.map(row => ({ ...row, query: typeof row.query === 'string' ? JSON.parse(row.query) : row.query })) });
    } catch (error) { next(error); }
});
router.post('/', body('name').isString().trim().isLength({ min: 1, max: 80 }), body('search').isObject(), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    let search;
    try { search = normalizeSavedSearch(req.body.search); }
    catch { return res.status(400).send({ error: t('library.invalidSearch') }); }
    try {
        const [id] = await knex('t_saved_search').insert({ user_name: getRequestUsername(req, config), name: req.body.name, query: JSON.stringify(search) });
        res.status(201).send({ id: Number(id) });
    } catch (error) {
        if (/unique|duplicate/i.test(error.message)) return res.status(409).send({ error: t('library.duplicateName') });
        next(error);
    }
});
router.patch('/:id', param('id').isInt({ min: 1 }), body('name').isString().trim().isLength({ min: 1, max: 80 }), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try {
        const changed = await rows(req).where('id', req.params.id).update({ name: req.body.name, updated_at: knex.fn.now() });
        res.sendStatus(changed ? 204 : 404);
    } catch (error) {
        if (/unique|duplicate/i.test(error.message)) return res.status(409).send({ error: t('library.duplicateName') });
        next(error);
    }
});
router.delete('/:id', param('id').isInt({ min: 1 }), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try { res.sendStatus(await rows(req).where('id', req.params.id).del() ? 204 : 404); }
    catch (error) { next(error); }
});
module.exports = router;
