"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const config_1 = require("../config");
const upgrade_1 = require("../upgrade");
const httpClient = require("../network/httpClient");
const package_json_1 = __importDefault(require("../../package.json"));
const VersionCheckCache_1 = require("../utils/VersionCheckCache");
const versionComparison_1 = require("../utils/versionComparison");
const initialGitHubResponse = {
    latest_stable: null,
    latest_release: null,
};
async function fetchLatestVersions() {
    const urlLatestStable = 'https://api.github.com/repos/ValoHalo/Kikoeru/releases/latest';
    const urlLatestRelease = 'https://api.github.com/repos/ValoHalo/Kikoeru/releases';
    const requestOptions = { timeout: 10000 };
    const [responseStable, responseLatest] = await Promise.all([
        httpClient.get(urlLatestStable, requestOptions),
        httpClient.get(urlLatestRelease, requestOptions),
    ]);
    if (!responseStable.data
        || !responseLatest.data
        || !responseStable.data.tag_name
        || !responseLatest.data[0]
        || !responseLatest.data[0].tag_name) {
        throw new Error('GitHub release response is missing version tags');
    }
    const latest_stable = responseStable.data.tag_name;
    const latest_release = responseLatest.data[0].tag_name;
    return { latest_stable, latest_release };
}
const versionCache = new VersionCheckCache_1.VersionCheckCache(fetchLatestVersions, {
    ttlMs: 5 * 60 * 1000,
    initialValue: initialGitHubResponse,
});
router.get('/', async (_req, res) => {
    const lockReason = '新版解决了旧版扫描时将かの仔和こっこ识别为同一个人的问题，建议进行扫描以自动修复这一问题';
    const latest = await versionCache.get();
    const selectedLatest = config_1.config.checkBetaUpdate
        ? latest.latest_release
        : latest.latest_stable;
    const update_available = (0, versionComparison_1.isUpstreamUpdateAvailable)(selectedLatest, package_json_1.default.version);
    res.send({
        current: package_json_1.default.version,
        ...latest,
        update_available,
        notifyUser: config_1.config.checkUpdate,
        lockFileExists: upgrade_1.updateLock.isLockFilePresent,
        lockReason: upgrade_1.updateLock.isLockFilePresent ? lockReason : null
    });
});
exports.default = router;
