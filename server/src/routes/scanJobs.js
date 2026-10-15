"use strict";
const router = require('express').Router();
const { body, param } = require('express-validator');
const { requireAdministrator } = require('../auth/accessControl');
const { isValidRequest } = require('./utils/validate');
const { knex } = require('../database/db');
const { jobStatus } = require('../database/scanJobs');
const runner = require('../filesystem/scanJobRunner');
router.use(requireAdministrator);
function report(error, res, next) { if (error.status) res.status(error.status).send({ error: error.message }); else next(error); }
router.get('/', async (_req, res, next) => {
    try { res.send({ job: await jobStatus(knex) }); } catch (error) { next(error); }
});
router.post('/', body('kind').isIn(['scan', 'metadata', 'files', 'retry', 'covers']), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;
    try { res.status(202).send({ job: await runner.startJob(req.body.kind) }); }
    catch (error) { report(error, res, next); }
});
for (const [action, execute] of Object.entries({ pause: runner.pauseJob, cancel: runner.cancelJob, resume: id => runner.startJob(null, id) })) {
    router.post(`/:id/${action}`, param('id').isInt({ min: 1 }), async (req, res, next) => {
        if (!isValidRequest(req, res)) return;
        try { res.send({ job: await execute(Number(req.params.id)) }); }
        catch (error) { report(error, res, next); }
    });
}
module.exports = router;
