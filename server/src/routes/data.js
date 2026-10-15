"use strict";

const express = require('express');
const multer = require('multer');
const { requireAdministrator } = require('../auth/accessControl');
const { config } = require('../config');
const { knex } = require('../database/db');
const transfer = require('../database/dataTransfer');
const { scanCoordinator } = require('../filesystem/scanCoordinator');
const runtimeState = require('../runtimeState');
const { t } = require('../i18n');
const { version } = require('../../package.json');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: transfer.MAX_BYTES, files: 1, fields: 1, fieldSize: 1024 * 1024 } }).single('file');
let importing = false;
router.use(requireAdministrator);
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

function receive(req, res, next) {
    upload(req, res, error => {
        if (error) return res.status(400).send({ error: t(error.code === 'LIMIT_FILE_SIZE' ? 'dataTransfer.tooLarge' : 'dataTransfer.uploadFailed') });
        next();
    });
}

function report(error, res) {
    if (!error.status) console.error('Data transfer failed:', error);
    res.status(error.status || 500).send({ error: error.status ? error.message : t('dataTransfer.failed') });
}

router.get('/export', async (_req, res) => {
    try {
        const buffer = await transfer.exportData(knex, version);
        res.attachment(`kikoeru-data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`).type('application/json').send(buffer);
    } catch (error) { report(error, res); }
});

router.post('/preview', receive, async (req, res) => {
    try {
        const input = transfer.readImport(req.file && req.file.buffer);
        res.send(await transfer.previewImport(input, knex, config.rootFolders));
    } catch (error) { report(error, res); }
});

router.post('/import', receive, async (req, res) => {
    if (importing || runtimeState.scannerActive || runtimeState.scannerPending || runtimeState.installing) return res.status(409).send({ error: t('dataTransfer.busy') });
    importing = true;
    try {
        let options;
        try { options = JSON.parse(req.body.options); }
        catch { return res.status(400).send({ error: t('dataTransfer.previewRequired') }); }
        const input = transfer.readImport(req.file && req.file.buffer);
        const counts = await scanCoordinator.run(() => transfer.importData(input, options, knex, config.rootFolders));
        res.send({ counts });
    } catch (error) { report(error, res); }
    finally { importing = false; }
});

module.exports = router;
