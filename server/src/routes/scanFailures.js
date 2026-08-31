"use strict";

const express = require("express");
const db = require("../database/db");
const { requireAdministrator } = require("../auth/accessControl");

const router = express.Router();
router.use(requireAdministrator);

router.get('/', async (_req, res, next) => {
    try {
        res.send({ failures: await db.getScanFailures() });
    }
    catch (error) {
        next(error);
    }
});

router.delete('/', async (_req, res, next) => {
    try {
        const deleted = await db.clearScanFailures();
        res.send({ message: `已清除 ${deleted} 条失败记录` });
    }
    catch (error) {
        next(error);
    }
});

module.exports = router;
