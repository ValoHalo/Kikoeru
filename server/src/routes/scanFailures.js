"use strict";
const { t } = require('../i18n');

const express = require("express");
const db = require("../database/db");
const { requireAdministrator } = require("../auth/accessControl");

const router = express.Router();
router.use(requireAdministrator);

router.get('/', async (_req, res, next) => {
    try {
        const failures = await db.getScanFailures();
        const missingCovers = await db.knex('t_cover_status').join('t_work', 't_work.id', 't_cover_status.work_id')
            .select('t_cover_status.*', 't_work.title').orderBy('expires_at', 'desc').limit(100);
        res.send({ failures: failures.map(failure => ({ ...failure, category: require('../database/scanJobs').classifyFailure(failure) })), missingCovers });
    }
    catch (error) {
        next(error);
    }
});

router.delete('/', async (_req, res, next) => {
    try {
        const deleted = await db.clearScanFailures();
        res.send({ message: t('scanFailures.cleared', { count: deleted }) });
    }
    catch (error) {
        next(error);
    }
});

module.exports = router;
