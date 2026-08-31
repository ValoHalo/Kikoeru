"use strict";

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

function sanitizeVersion(tagName) {
    if (!/^v?[0-9A-Za-z][0-9A-Za-z._-]*$/.test(String(tagName || ""))) {
        throw new Error("GitHub Release 的版本号格式无效");
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
        return { supported: false, reason: "容器版本需要通过 Docker 或 Podman 更新镜像" };
    if (installKind === "source")
        return { supported: false, reason: "源码运行模式请通过 Git 更新或下载新的发行包" };
    if (process.env.KIKOERU_UPDATE_SUPERVISOR !== "1")
        return { supported: false, reason: "请通过发行包中的启动脚本运行 Kikoeru" };
    if (!String(config.sqliteType || "").includes("sqlite"))
        return { supported: false, reason: "使用外部数据库时需要手动完成应用更新" };
    return { supported: true, reason: null };
}

function downloadSupport() {
    const installKind = detectInstallKind();
    if (installKind === "container")
        return { supported: false, reason: "容器版本通过 Docker 或 Podman 拉取新镜像" };
    if (installKind === "source")
        return { supported: false, reason: "源码运行模式请通过 Git 更新或下载新的发行包" };
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
        installUnsupportedReason: support.reason,
        downloadSupported: download.supported,
        downloadUnsupportedReason: download.reason,
        updateAvailable: latestRelease
            ? isUpstreamUpdateAvailable(latestRelease.tag_name, packageJson.version)
            : null,
        release: publicRelease(latestRelease),
        lastCheckedAt: lastCheckedAt ? new Date(lastCheckedAt).toISOString() : null,
        phase: state.phase,
        downloadedBytes: state.downloadedBytes,
        totalBytes: state.totalBytes,
        targetVersion: state.targetVersion,
        error: state.error,
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
        throw new Error("GitHub Release 没有返回有效版本");
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
        state.error = error.message || String(error);
        throw error;
    }
}

async function downloadUpdate() {
    if (state.phase === "downloading")
        return getStatus();
    if (!latestRelease)
        await checkForUpdates({ force: true });
    if (!isUpstreamUpdateAvailable(latestRelease.tag_name, packageJson.version))
        throw new Error("当前已经是最新版本");

    const download = downloadSupport();
    if (!download.supported)
        throw new Error(download.reason);
    const installKind = detectInstallKind();
    const asset = selectReleaseAsset(latestRelease, installKind);
    if (!asset)
        throw new Error("当前系统没有可用的更新包");
    const expectedDigest = parseSha256Digest(asset.digest);
    if (!expectedDigest)
        throw new Error("GitHub Release 没有提供可校验的 SHA-256");

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
            throw new Error("更新包 SHA-256 校验失败");
        if (asset.size && state.downloadedBytes !== Number(asset.size))
            throw new Error("更新包大小与 GitHub Release 不一致");
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
        state.error = error.name === "CanceledError" ? "下载已取消" : error.message || String(error);
        throw new Error(state.error);
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
        state.error = error.message || String(error);
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
        throw new Error(support.reason);
    if (runtimeState.scannerActive)
        throw new Error("扫描任务运行中，请等待扫描完成后再安装更新");
    if (state.phase !== "ready" || !state.packagePath || !fs.existsSync(state.packagePath))
        throw new Error("更新包尚未下载完成");

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
        try {
            await db.knex.destroy();
        }
        finally {
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
