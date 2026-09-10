"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "kikoeru-update-manager-"));
process.env.KIKOERU_DATA_DIR = runtime;
process.env.FREEZE_CONFIG_FILE = "1";
process.env.NODE_ENV = "test";

const updateManager = require("../../src/update/updateManager");

test.after(() => {
    fs.rmSync(runtime, { recursive: true, force: true });
});

test("cached update errors use the language of each status request", async (context) => {
    const httpClient = require('../../src/network/httpClient');
    const { localizeRequest } = require('../../src/i18n');
    const request = (locale, action) => {
        let result;
        localizeRequest({ acceptsLanguages: () => locale }, null, () => { result = action(); });
        return result;
    };
    const network = context.mock.method(httpClient, 'get', async () => ({ data: {} }));
    await assert.rejects(request('zh-CN', () => updateManager.checkForUpdates({ force: true })), /GitHub Release 没有返回有效版本/);
    const english = request('en', () => updateManager.getStatus());
    const chinese = request('zh-CN', () => updateManager.getStatus());
    assert.equal(english.error, 'GitHub Release did not return a valid version');
    assert.equal(chinese.error, 'GitHub Release 没有返回有效版本');
    assert.equal(english.phase, 'error');
    assert.equal(network.mock.callCount(), 1);
});

test("install kind honors launcher and container declarations", () => {
    assert.equal(updateManager.detectInstallKind({ KIKOERU_INSTALL_KIND: "windows-portable" }, "win32", false), "windows-portable");
    assert.equal(updateManager.detectInstallKind({ KIKOERU_INSTALL_KIND: "container" }, "linux", false), "container");
    assert.equal(updateManager.detectInstallKind({}, "win32", true), "windows-portable");
    assert.equal(updateManager.detectInstallKind({}, "linux", false), "source");
});

test("release asset selection matches platform archives", () => {
    const release = {
        assets: [
            { name: "kikoeru-linux-x64-948fc5.tar.gz" },
            { name: "kikoeru-win-x64-948fc5.zip" },
            { name: "source.zip" },
        ],
    };
    assert.equal(updateManager.selectReleaseAsset(release, "windows-portable").name, "kikoeru-win-x64-948fc5.zip");
    assert.equal(updateManager.selectReleaseAsset(release, "linux-portable").name, "kikoeru-linux-x64-948fc5.tar.gz");
    assert.equal(updateManager.selectReleaseAsset(release, "source", "darwin", "x64"), null);
    assert.equal(updateManager.selectReleaseAsset(release, "linux-portable", "linux", "arm64"), null);
});

test("GitHub SHA-256 digest parsing rejects incomplete values", () => {
    const digest = "A".repeat(64);
    assert.equal(updateManager.parseSha256Digest(`sha256:${digest}`), digest.toLowerCase());
    assert.equal(updateManager.parseSha256Digest("sha256:1234"), null);
    assert.equal(updateManager.parseSha256Digest(null), null);
});

test("successful startup accepts a pending marker written with a UTF-8 BOM", () => {
    const updates = path.join(runtime, "updates");
    const pendingPath = path.join(updates, "startup-pending.json");
    const resultPath = path.join(updates, "last-result.json");
    fs.mkdirSync(updates, { recursive: true });
    fs.writeFileSync(pendingPath, `\uFEFF${JSON.stringify({ fromVersion: "0.7.5", targetVersion: "v0.7.6" })}`);

    assert.equal(updateManager.markStartupSuccessful(), true);
    const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    assert.equal(result.status, "installed");
    assert.equal(result.fromVersion, "0.7.5");
    assert.equal(result.targetVersion, "v0.7.6");
    assert.ok(Date.parse(result.completedAt));
    assert.equal(fs.existsSync(pendingPath), false);
});
