"use strict";

const express = require("express");
const { requireAdministrator } = require("../auth/accessControl");
const updateManager = require("../update/updateManager");

const router = express.Router();
router.use(requireAdministrator);

function sendError(res, error) {
    res.status(400).send({ error: error.message || String(error) });
}

router.get("/status", (_req, res) => {
    res.send(updateManager.getStatus());
});

router.post("/check", async (_req, res) => {
    try {
        res.send(await updateManager.checkForUpdates({ force: true }));
    }
    catch (error) {
        sendError(res, error);
    }
});

router.post("/download", (_req, res) => {
    res.status(202).send(updateManager.beginDownload());
});

router.delete("/download", (_req, res) => {
    if (!updateManager.cancelDownload()) {
        res.status(409).send({ error: "当前没有正在进行的更新下载" });
        return;
    }
    res.status(204).end();
});

router.post("/install", async (_req, res) => {
    try {
        res.status(202).send(await updateManager.requestInstall());
    }
    catch (error) {
        sendError(res, error);
    }
});

module.exports = router;
