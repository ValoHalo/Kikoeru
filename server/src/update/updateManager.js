"use strict";
const { t } = require('../i18n');

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { config, configFolderDir } = require("../config");
const httpClient = require("../network/httpClient");
const runtimeState = require("../runtimeState");
const { isUpstreamUpdateAvailable } = require("../utils/versionComparison");
const packageJson = require("../../package.json");

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RELEASE_CACHE_MS = 5 * 60 * 1000;
const UPDATE_EXIT_GRACE_MS = 5000;
const EXIT_INSTALL_UPDATE = 42;
const dataRoot = path.dirname(configFolderDir);
const updatesRoot = path.join(dataRoot, "updates");
const statePath = path.join(updatesRoot, "state.json");
const installMarkerPath = path.join(updatesRoot, "install.json");
const startupPendingPath = path.join(updatesRoot, "startup-pending.json");
const lastResultPath = path.join(updatesRoot, "last-result.json");

let downloadController = null;
let downloadPromise = null;
let autoCheckTimer = null;
let latestRelease = null;
let lastCheckedAt = 0;
let state = {
    phase: "idle",
    downloadedBytes: 0,
    totalBytes: 0,
    error: null,
    packagePath: null,
    targetVersion: null,
};

function detectInstallKind(env = process.env, platform = process.platform, isPkg = Boolean(process.pkg)) {
    if (["windows-portable", "linux-portable", "container", "source"].includes(env.KIKOERU_INSTALL_KIND)) {
        return env.KIKOERU_INSTALL_KIND;
    }
    if (isPkg && platform === "win32")
        return "windows-portable";
    return "source";
}

function parseSha256Digest(digest) {
    const match = /^sha256:([0-9a-f]{64})$/i.exec(String(digest || "").trim());
    return match ? match[1].toLowerCase() : null;
}

function selectReleaseAsset(release, installKind, platform = process.platform, arch = process.arch) {
    if (!release || !Array.isArray(release.assets) || arch !== "x64")
        return null;
    const useWindows = installKind === "windows-portable" || (installKind === "source" && platform === "win32");
    const useLinux = installKind === "linux-portable" || installKind === "container" || (installKind === "source" && platform === "linux");
    const matcher = useWindows
        ? /^kikoeru-win-x64-[0-9a-f]+\.zip$/i
        : useLinux
            ? /^kikoeru-linux-x64-[0-9a-f]+\.tar\.gz$/i
            : null;
    return matcher ? release.assets.find(asset => matcher.test(asset.name)) || null : null;
}

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
    }
    catch (_) {
        return null;
    }
}

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2));
    removeFile(filePath);
    fs.renameSync(temporaryPath, filePath);
}

function removeFile(filePath) {
    try {
        fs.rmSync(filePath, { force: true });
    }
    catch (_) {}
}

function updateError(key) {
    const error = new Error(t(key));
    error.messageKey = key;
    return error;
}

function sanitizeVersion(tagName) {
    if (!/^v?[0-9A-Za-z][0-9A-Za-z._-]*$/.test(String(tagName || ""))) {
        throw updateError('updateManager.versionInvalid');
    }
    return String(tagName);
}

function restorePersistedState() {
    const persisted = readJson(statePath);
    if (!persisted || persisted.phase !== "ready" || !persisted.packagePath || !fs.existsSync(persisted.packagePath))
        return;
    if (!isUpstreamUpdateAvailable(persisted.targetVersion, packageJson.version)) {
        removeFile(statePath);
        return;
    }
    state = {
        ...state,
        ...persisted,
        error: null,
    };
}

function installSupport() {
    const installKind = detectInstallKind();
    if (installKind === "container")
        return { supported: false, reason: 'updateManager.updateContainer' };
    if (installKind === "source")
        return { supported: false, reason: 'updateManager.updateSource' };
    if (process.env.KIKOERU_UPDATE_SUPERVISOR !== "1")
        return { supported: false, reason: 'updateManager.useLauncher' };
    if (!String(config.sqliteType || "").includes("sqlite"))
        return { supported: false, reason: 'updateManager.externalDatabase' };
    return { supported: true, reason: null };
}

function downloadSupport() {
    const installKind = detectInstallKind();
    if (installKind === "container")
        return { supported: false, reason: 'updateManager.downloadContainer' };
    if (installKind === "source")
        return { supported: false, reason: 'updateManager.updateSource' };
    return { supported: true, reason: null };
}

function publicRelease(release) {
    if (!release)
        return null;
    const installKind = detectInstallKind();
    const asset = selectReleaseAsset(release, installKind);
    return {
        version: release.tag_name,
        name: release.name || release.tag_name,
        prerelease: Boolean(release.prerelease),
        publishedAt: release.published_at || null,
        url: release.html_url || null,
        asset: asset ? {
            name: asset.name,
            size: Number(asset.size) || 0,
            digest: asset.digest || null,
        } : null,
    };
}

function getStatus() {
    const installKind = detectInstallKind();
    const support = installSupport();
    const download = downloadSupport();
    return {
        currentVersion: packageJson.version,
        installKind,
        installSupported: support.supported,
        installUnsupportedReason: support.reason ? t(support.reason) : null,
        downloadSupported: download.supported,
        downloadUnsupportedReason: download.reason ? t(download.reason) : null,
        updateAvailable: latestRelease
            ? isUpstreamUpdateAvailable(latestRelease.tag_name, packageJson.version)
            : null,
        release: publicRelease(latestRelease),
        lastCheckedAt: lastCheckedAt ? new Date(lastCheckedAt).toISOString() : null,
        phase: state.phase,
        downloadedBytes: state.downloadedBytes,
        totalBytes: state.totalBytes,
        targetVersion: state.targetVersion,
        error: state.error?.messageKey ? t(state.error.messageKey) : state.error?.message || (state.error == null ? null : String(state.error)),
        lastResult: readJson(lastResultPath),
        settings: {
            checkUpdate: Boolean(config.checkUpdate),
            checkBetaUpdate: Boolean(config.checkBetaUpdate),
            autoDownloadUpdate: Boolean(config.autoDownloadUpdate),
        },
    };
}

async function fetchLatestRelease() {
    const url = config.checkBetaUpdate
        ? "https://api.github.com/repos/ValoHalo/Kikoeru/releases"
        : "https://api.github.com/repos/ValoHalo/Kikoeru/releases/latest";
    const response = await httpClient.get(url, {
        timeout: 10000,
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "Kikoeru-Updater",
        },
    });
    const release = Array.isArray(response.data)
        ? response.data.find(item => item && !item.draft)
        : response.data;
    if (!release || !release.tag_name)
        throw updateError('updateManager.releaseMissing');
    return release;
}

async function checkForUpdates({ force = false } = {}) {
    if (!force && latestRelease && Date.now() - lastCheckedAt < RELEASE_CACHE_MS)
        return getStatus();
    if (state.phase !== "downloading")
        state.phase = "checking";
    state.error = null;
    try {
        latestRelease = await fetchLatestRelease();
        lastCheckedAt = Date.now();
        if (state.phase === "checking")
            state.phase = state.packagePath ? "ready" : "idle";
        return getStatus();
    }
    catch (error) {
        if (state.phase === "checking")
            state.phase = "error";
        state.error = error;
        throw error;
    }
}

async function downloadUpdate() {
    if (state.phase === "downloading")
        return getStatus();
    if (!latestRelease)
        await checkForUpdates({ force: true });
    if (!isUpstreamUpdateAvailable(latestRelease.tag_name, packageJson.version))
        throw updateError('updateManager.alreadyLatest');

    const download = downloadSupport();
    if (!download.supported)
        throw updateError(download.reason);
    const installKind = detectInstallKind();
    const asset = selectReleaseAsset(latestRelease, installKind);
    if (!asset)
        throw updateError('updateManager.assetMissing');
    const expectedDigest = parseSha256Digest(asset.digest);
    if (!expectedDigest)
        throw updateError('updateManager.checksumMissing');

    const targetVersion = sanitizeVersion(latestRelease.tag_name);
    const targetFolder = path.join(updatesRoot, targetVersion);
    const packagePath = path.join(targetFolder, asset.name);
    const partialPath = `${packagePath}.part`;
    fs.mkdirSync(targetFolder, { recursive: true });
    removeFile(partialPath);

    downloadController = new AbortController();
    state = {
        phase: "downloading",
        downloadedBytes: 0,
        totalBytes: Number(asset.size) || 0,
        error: null,
        packagePath: null,
        targetVersion,
    };
    const hash = crypto.createHash("sha256");
    const progress = new Transform({
        transform(chunk, _encoding, callback) {
            hash.update(chunk);
            state.downloadedBytes += chunk.length;
            callback(null, chunk);
        },
    });

    try {
        const response = await httpClient.get(asset.browser_download_url, {
            responseType: "stream",
            timeout: 0,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            signal: downloadController.signal,
            headers: { "User-Agent": "Kikoeru-Updater" },
        });
        await pipeline(response.data, progress, fs.createWriteStream(partialPath));
        const actualDigest = hash.digest("hex");
        if (actualDigest !== expectedDigest)
            throw updateError('updateManager.checksumMismatch');
        if (asset.size && state.downloadedBytes !== Number(asset.size))
            throw updateError('updateManager.sizeMismatch');
        removeFile(packagePath);
        fs.renameSync(partialPath, packagePath);
        state = {
            ...state,
            phase: "ready",
            packagePath,
            error: null,
            digest: expectedDigest,
            assetName: asset.name,
        };
        writeJson(statePath, state);
        return getStatus();
    }
    catch (error) {
        removeFile(partialPath);
        state.phase = "error";
        state.error = error.name === "CanceledError" ? updateError('updateManager.cancelled') : error;
        throw state.error;
    }
    finally {
        downloadController = null;
    }
}

function beginDownload() {
    if (downloadPromise)
        return getStatus();
    downloadPromise = downloadUpdate()
        .catch((error) => {
        state.phase = "error";
        state.error = error;
    })
        .finally(() => {
        downloadPromise = null;
    });
    return getStatus();
}

function cancelDownload() {
    if (!downloadController)
        return false;
    downloadController.abort();
    return true;
}

async function prepareDatabaseForUpdate() {
    const db = require("../database/db");
    await db.knex.raw("PRAGMA wal_checkpoint(FULL)");
}

async function requestInstall() {
    const support = installSupport();
    if (!support.supported)
        throw updateError(support.reason);
    if (runtimeState.scannerActive)
        throw updateError('updateManager.scannerRunning');
    if (state.phase !== "ready" || !state.packagePath || !fs.existsSync(state.packagePath))
        throw updateError('updateManager.downloadIncomplete');

    await prepareDatabaseForUpdate();
    const marker = {
        fromVersion: packageJson.version,
        targetVersion: state.targetVersion,
        packagePath: state.packagePath,
        digest: state.digest,
        assetName: state.assetName,
        installKind: detectInstallKind(),
        createdAt: new Date().toISOString(),
    };
    writeJson(installMarkerPath, marker);
    state.phase = "installing";
    writeJson(statePath, state);

    setTimeout(async () => {
        const db = require("../database/db");
        const forceExitTimer = setTimeout(() => process.exit(EXIT_INSTALL_UPDATE), UPDATE_EXIT_GRACE_MS);
        try {
            await db.knex.destroy();
        }
        finally {
            clearTimeout(forceExitTimer);
            process.exit(EXIT_INSTALL_UPDATE);
        }
    }, 1200);
    return getStatus();
}

function markStartupSuccessful() {
    const pending = readJson(startupPendingPath);
    if (!pending)
        return false;
    writeJson(lastResultPath, {
        status: "installed",
        fromVersion: pending.fromVersion,
        targetVersion: pending.targetVersion,
        completedAt: new Date().toISOString(),
    });
    removeFile(startupPendingPath);
    removeFile(installMarkerPath);
    removeFile(statePath);
    state = {
        phase: "idle",
        downloadedBytes: 0,
        totalBytes: 0,
        error: null,
        packagePath: null,
        targetVersion: null,
    };
    return true;
}

async function runAutomaticCheck() {
    if (!config.checkUpdate)
        return;
    try {
        const status = await checkForUpdates({ force: true });
        if (config.autoDownloadUpdate && status.updateAvailable && state.phase !== "ready")
            await downloadUpdate();
    }
    catch (error) {
        console.warn(`自动检查更新失败: ${error.message || error}`);
    }
}

function startAutoUpdateChecks() {
    if (autoCheckTimer)
        return;
    const initialTimer = setTimeout(runAutomaticCheck, 10000);
    initialTimer.unref();
    autoCheckTimer = setInterval(runAutomaticCheck, CHECK_INTERVAL_MS);
    autoCheckTimer.unref();
}

restorePersistedState();

module.exports = {
    EXIT_INSTALL_UPDATE,
    beginDownload,
    cancelDownload,
    checkForUpdates,
    detectInstallKind,
    downloadUpdate,
    getStatus,
    markStartupSuccessful,
    parseSha256Digest,
    requestInstall,
    selectReleaseAsset,
    startAutoUpdateChecks,
};
