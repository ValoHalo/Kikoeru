"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const config_1 = require("../config");
const db = __importStar(require("../database/db"));
const express_validator_1 = require("express-validator");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const jschardet_1 = __importDefault(require("jschardet"));
const utils_1 = require("../filesystem/utils");
const url_1 = require("./utils/url");
const validate_1 = require("./utils/validate");
const iconv_lite_1 = __importDefault(require("iconv-lite"));
const lyricParser_1 = require("../filesystem/lyricParser");
const subtitleLanguage_1 = require("../filesystem/subtitleLanguage");
const audioProcessor = __importStar(require("../filesystem/audioProcessor"));
const PersistentCache_1 = require("../utils/PersistentCache");
const TaskQueue_1 = require("../utils/TaskQueue");
const pathSafety_1 = require("../filesystem/pathSafety");
const accessControl_1 = require("../auth/accessControl");
const supportedLyricExtensions = [".lrc", ".srt", ".vtt"];
async function addSubtitleLanguages(lyricTracks, rootFolder, workDir) {
    return Promise.all(lyricTracks.map(async (lyricTrack) => {
        const fileName = path_1.default.join(rootFolder.path, workDir, lyricTrack.subtitle || '', lyricTrack.title);
        try {
            return Object.assign({ language: await (0, subtitleLanguage_1.detectSubtitleFileLanguage)(fileName) }, lyricTrack);
        }
        catch (error) {
            console.warn(`[subtitle-language] 无法识别 ${fileName}: ${error.message || error}`);
            return Object.assign({ language: 'und' }, lyricTrack);
        }
    }));
}
function compareLyricTracks(left, right, preferredLanguage) {
    const leftLevel = Number(left.matchLevel);
    const rightLevel = Number(right.matchLevel);
    const leftRank = leftLevel < 0 ? Number.POSITIVE_INFINITY : leftLevel;
    const rightRank = rightLevel < 0 ? Number.POSITIVE_INFINITY : rightLevel;
    if (leftRank !== rightRank)
        return leftRank - rightRank;
    const leftPreferred = (0, subtitleLanguage_1.isPreferredSubtitleLanguage)(left.language, preferredLanguage);
    const rightPreferred = (0, subtitleLanguage_1.isPreferredSubtitleLanguage)(right.language, preferredLanguage);
    return Number(rightPreferred) - Number(leftPreferred);
}
const supportedTranscodeBitRates = new Set([128, 320]);
const defaultTranscodeBitRate = 128;
const transcodeFailedStatusTtlMs = 60 * 1000;
const transcodeCacheMetadataDirectoryName = ".source-fingerprints";
const transcodeTasks = new Map();
const transcodeTaskSourceFingerprints = new Map();
const transcodeTaskStatus = new Map();
const lufsCalculateTaskStatus = new Map();
const peakCalculateTaskStatus = new Map();
const lufsPersistentCache = new PersistentCache_1.PersistentCache(config_1.config.persistentLUFSCachePath, 500, (data) => {
    return !!data
        && isSourceFingerprint(data.sourceFingerprint)
        && !!data.audioInfo
        && data.audioInfo.loudnorm !== undefined
        && Array.isArray(data.audioInfo.peakLevels);
});
router.get('/stream/:id/:index', (0, express_validator_1.param)('id').isInt(), (0, express_validator_1.param)('index').isInt(), (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    db.knex('t_work')
        .select('root_folder', 'dir', 'memo')
        .where('id', '=', req.params.id)
        .first()
        .then((work) => {
        const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (rootFolder) {
            (0, utils_1.getTrackList)(req.params.id, path_1.default.join(rootFolder.path, work.dir), (0, utils_1.ensureIsJsonObject)(work.memo))
                .then(async (tracks) => {
                const track = tracks[req.params.index];
                const fileName = path_1.default.join(rootFolder.path, work.dir, track.subtitle || '', track.title);
                const extName = path_1.default.extname(fileName).toLocaleLowerCase();
                if (extName === '.txt' || extName === '.lrc') {
                    const fileBuffer = await fs_1.default.promises.readFile(fileName);
                    const charsetMatch = jschardet_1.default.detect(fileBuffer).encoding;
                    if (charsetMatch) {
                        res.setHeader('Content-Type', `text/plain; charset=${charsetMatch}`);
                    }
                }
                if (extName === '.flac') {
                    res.setHeader('Content-Type', `audio/flac`);
                }
                if (config_1.config.offloadMedia && extName !== '.txt' && extName !== '.lrc') {
                    const baseUrl = config_1.config.offloadStreamPath;
                    let offloadUrl = (0, url_1.joinFragments)(baseUrl, rootFolder.name, work.dir, track.subtitle || '', track.title);
                    if (process.platform === 'win32') {
                        offloadUrl = offloadUrl.replace(/\\/g, '/');
                    }
                    res.redirect(offloadUrl);
                }
                else {
                    res.sendFile(fileName);
                }
            })
                .catch(err => next(err));
        }
        else {
            res.status(500).send({ error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.` });
        }
    })
        .catch(err => next(err));
});
router.get('/download/:id/:index', (0, express_validator_1.param)('id').isInt(), (0, express_validator_1.param)('index').isInt(), (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    db.knex('t_work')
        .select('root_folder', 'dir', 'memo')
        .where('id', '=', req.params.id)
        .first()
        .then((work) => {
        const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (rootFolder) {
            (0, utils_1.getTrackList)(req.params.id, path_1.default.join(rootFolder.path, work.dir), (0, utils_1.ensureIsJsonObject)(work.memo))
                .then((tracks) => {
                const track = tracks[req.params.index];
                if (config_1.config.offloadMedia) {
                    const baseUrl = config_1.config.offloadDownloadPath;
                    let offloadUrl = (0, url_1.joinFragments)(baseUrl, rootFolder.name, work.dir, track.subtitle || '', track.title);
                    if (process.platform === 'win32') {
                        offloadUrl = offloadUrl.replace(/\\/g, '/');
                    }
                    res.redirect(offloadUrl);
                }
                else {
                    res.download(path_1.default.join(rootFolder.path, work.dir, track.subtitle || '', track.title));
                }
            })
                .catch(err => next(err));
        }
        else {
            res.status(500).send({ error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.` });
        }
    });
});
router.get('/query-lrc/:id/:index', (0, express_validator_1.param)('id').isInt(), (0, express_validator_1.param)('index').isInt(), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = req.params.id;
    const track_index = req.params.index;
    try {
        const work = await db.knex('t_work')
            .select('root_folder', 'dir', 'memo')
            .where('id', '=', work_id)
            .first();
        const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (!rootFolder) {
            res.status(500).send({ error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.` });
            return;
        }
        const tracks = await (0, utils_1.getTrackList)(work_id, path_1.default.join(rootFolder.path, work.dir), (0, utils_1.ensureIsJsonObject)(work.memo));
        const track = tracks[track_index];
        console.log("[find-lrc]", track.subtitle, track.title);
        const lyricTracks = tracks.filter((track) => {
            const ext = path_1.default.extname(track.title).toLowerCase();
            return supportedLyricExtensions.includes(ext);
        }).map(track => ({
            title: track.title,
            subtitle: track.subtitle || '',
            hash: track.hash,
            ext: track.ext,
        }));
        console.log("[find-lrc] tracks: ", lyricTracks);
        const fileBasename = path_1.default.parse(track.title).name;
        console.log("[find-lrc] fileBasename: ", fileBasename, track.title);
        const matchedTracks = await addSubtitleLanguages(lyricTracks.map((lrcTrack) => {
            let lyricName = lrcTrack.title;
            lyricName = path_1.default.parse(lyricName).name;
            const p = path_1.default.parse(lyricName);
            if (utils_1.supportedMediaExtList.includes(p.ext.toLowerCase())) {
                lyricName = p.name;
            }
            lyricName = (0, subtitleLanguage_1.stripSubtitleLanguageSuffix)(lyricName);
            let matchLevel = (0, utils_1.audioLyricMatchLevel)(fileBasename, lyricName);
            console.log("[find-lrc] ", fileBasename, lyricName, matchLevel);
            if (lrcTrack.subtitle != track.subtitle) {
                matchLevel += 0.5;
            }
            return Object.assign({ matchLevel }, lrcTrack);
        }), rootFolder, work.dir);
        matchedTracks.sort((left, right) => compareLyricTracks(left, right, req.query.language));
        console.log("[find-lrc] matchedTracks: ", matchedTracks);
        res.send({
            result: true,
            lyricList: matchedTracks,
        });
    }
    catch (err) {
        next(err);
    }
});
router.get('/fetch-lrc/:id/:hash', (0, express_validator_1.param)('id').isInt(), (0, express_validator_1.param)('hash').isInt(), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = req.params.id;
    const hash = req.params.hash;
    try {
        const work = await db.knex('t_work')
            .select('root_folder', 'dir', 'memo')
            .where('id', '=', work_id)
            .first();
        const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (!rootFolder) {
            res.status(500).send({ error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.` });
            return;
        }
        const tracks = await (0, utils_1.getTrackList)(work_id, path_1.default.join(rootFolder.path, work.dir), (0, utils_1.ensureIsJsonObject)(work.memo));
        const track = tracks[hash];
        const fileName = path_1.default.join(rootFolder.path, work.dir, track.subtitle || '', track.title);
        const fileBuffer = await fs_1.default.promises.readFile(fileName);
        const charsetMatch = jschardet_1.default.detect(fileBuffer).encoding;
        const fileContent = iconv_lite_1.default.decode(fileBuffer, charsetMatch);
        let lrc = [];
        let extension = path_1.default.extname(fileName);
        switch (extension) {
            case ".lrc":
                lrc = (0, lyricParser_1.parseLrc)(fileContent);
                break;
            case ".srt":
            case ".vtt":
                lrc = (0, lyricParser_1.parseSrtOrVtt)(fileContent);
                break;
            default:
                break;
        }
        res.send({
            result: true,
            message: '找到歌词文件',
            hash,
            lyricExtension: extension,
            language: (0, subtitleLanguage_1.detectSubtitleLanguage)(fileContent, track.title),
            lrc: lrc,
        });
    }
    catch (e) {
        next(e);
    }
});
router.post('/save-lrc/:id', accessControl_1.requireAdministrator, (0, express_validator_1.param)('id').isInt(), async (req, res, next) => {
    const work_id = req.params.id;
    const writePath = req.body.writePath;
    const lyricLines = req.body.lrc;
    if (typeof writePath !== 'string' || !writePath.toLowerCase().endsWith(".vtt")) {
        res.status(500).send({ error: `只能保存vtt格式的歌词文件，当前保存路径格式无效${writePath}` });
        return;
    }
    if (!Array.isArray(lyricLines)) {
        res.status(400).send({ error: '歌词内容必须是数组.' });
        return;
    }
    try {
        const work = await db.knex('t_work')
            .select('root_folder', 'dir', 'memo')
            .where('id', '=', work_id)
            .first();
        if (!work) {
            res.status(404).send({ error: `找不到作品: ${work_id}` });
            return;
        }
        const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (!rootFolder) {
            res.status(500).send({ error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.` });
            return;
        }
        const absWorkDir = path_1.default.join(rootFolder.path, work.dir);
        const absWritePath = (0, pathSafety_1.resolvePathInside)(absWorkDir, writePath, 'writePath');
        (0, pathSafety_1.assertExistingParentInside)(absWorkDir, absWritePath);
        let vtt_content = "WEBVTT\n\n";
        for (let i = 0; i < lyricLines.length; ++i) {
            const oneLyric = lyricLines[i];
            const startMillis = oneLyric.time;
            let endMills = oneLyric.timeEnd >= 0 ? oneLyric.timeEnd : null;
            if (endMills === null) {
                if (i === lyricLines.length - 1) {
                    endMills = startMillis + 60 * 1000 * 3600 * 3600;
                }
                else {
                    endMills = lyricLines[i + 1].time - 1;
                }
            }
            const startTs = (0, utils_1.formatSeconds)(startMillis / 1000, true);
            const endTs = (0, utils_1.formatSeconds)(endMills / 1000, true);
            vtt_content += `${startTs} --> ${endTs}\n${oneLyric.text}\n\n`;
        }
        fs_1.default.writeFileSync(absWritePath, vtt_content);
        res.send({
            result: true,
        });
    }
    catch (e) {
        next(e);
    }
});
router.get('/check-lrc/:id/:index', (0, express_validator_1.param)('id').isInt(), (0, express_validator_1.param)('index').isInt(), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = req.params.id;
    const track_index = req.params.index;
    try {
        const work = await db.knex('t_work')
            .select('root_folder', 'dir', 'memo')
            .where('id', '=', work_id)
            .first();
        const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (!rootFolder) {
            res.status(500).send({ error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.` });
            return;
        }
        const tracks = await (0, utils_1.getTrackList)(work_id, path_1.default.join(rootFolder.path, work.dir), (0, utils_1.ensureIsJsonObject)(work.memo));
        const track = tracks[track_index];
        console.log("[find-lrc]", track.subtitle, track.title);
        const lyricTracks = tracks.filter((track) => {
            const ext = path_1.default.extname(track.title).toLowerCase();
            return supportedLyricExtensions.includes(ext);
        }).map(track => ({
            title: track.title,
            subtitle: track.subtitle || '',
            hash: track.hash,
            ext: track.ext,
        }));
        console.log("[find-lrc] tracks: ", lyricTracks);
        const fileBasename = path_1.default.parse(track.title).name;
        console.log("[find-lrc] fileBasename: ", fileBasename, track.title);
        const matchedTracks = (await addSubtitleLanguages(lyricTracks.map((lrcTrack) => {
            let lyricName = lrcTrack.title;
            lyricName = path_1.default.parse(lyricName).name;
            const p = path_1.default.parse(lyricName);
            if (utils_1.supportedMediaExtList.includes(p.ext.toLowerCase())) {
                lyricName = p.name;
            }
            lyricName = (0, subtitleLanguage_1.stripSubtitleLanguageSuffix)(lyricName);
            let matchLevel = (0, utils_1.audioLyricMatchLevel)(fileBasename, lyricName);
            console.log("[find-lrc] ", fileBasename, lyricName, matchLevel);
            if (lrcTrack.subtitle != track.subtitle) {
                matchLevel += 0.5;
            }
            return Object.assign({ matchLevel }, lrcTrack);
        }), rootFolder, work.dir))
            .filter((lrcTrack) => lrcTrack.matchLevel >= 0);
        matchedTracks.sort((left, right) => compareLyricTracks(left, right, req.query.language));
        console.log("[find-lrc] matchedTracks: ", matchedTracks);
        if (matchedTracks.length == 0) {
            res.send({ result: false, message: '不存在歌词文件', hash: '' });
            return;
        }
        const bestLrcTrack = matchedTracks[0];
        const fileName = path_1.default.join(rootFolder.path, work.dir, bestLrcTrack.subtitle || '', bestLrcTrack.title);
        const fileBuffer = await fs_1.default.promises.readFile(fileName);
        const charsetMatch = jschardet_1.default.detect(fileBuffer).encoding;
        const fileContent = iconv_lite_1.default.decode(fileBuffer, charsetMatch);
        let lrc = [];
        switch (bestLrcTrack.ext) {
            case ".lrc":
                lrc = (0, lyricParser_1.parseLrc)(fileContent);
                break;
            case ".srt":
            case ".vtt":
                lrc = (0, lyricParser_1.parseSrtOrVtt)(fileContent);
                break;
            default:
                break;
        }
        res.send({
            result: true,
            message: '找到歌词文件',
            hash: bestLrcTrack.hash,
            lyricExtension: path_1.default.extname(bestLrcTrack.title).toLowerCase(),
            language: bestLrcTrack.language,
            lrc: lrc,
        });
    }
    catch (err) {
        next(err);
    }
});
function parseTranscodeBitRate(value) {
    if (value === undefined || value === null || value === '') {
        return defaultTranscodeBitRate;
    }
    const bitRate = Number(value);
    if (!Number.isInteger(bitRate) || !supportedTranscodeBitRates.has(bitRate)) {
        const error = new Error('仅支持 128 或 320 kbps 的转码码率.');
        error.code = 'UNSUPPORTED_TRANSCODE_BIT_RATE';
        error.status = 400;
        throw error;
    }
    return bitRate;
}
function getOrStartSharedTask(taskMap, taskIdentifier, startTask) {
    const existingTask = taskMap.get(taskIdentifier);
    if (existingTask) {
        return { promise: existingTask, started: false };
    }
    const taskPromise = (async () => startTask())();
    taskMap.set(taskIdentifier, taskPromise);
    const clearTask = () => {
        if (taskMap.get(taskIdentifier) === taskPromise) {
            taskMap.delete(taskIdentifier);
        }
    };
    taskPromise.then(clearTask, clearTask);
    return { promise: taskPromise, started: true };
}
function getErrorMessage(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return String(error || '未知错误');
}
function normalizeFingerprintPath(filePath) {
    const normalizedPath = path_1.default.resolve(filePath);
    return process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath;
}
function isSourceFingerprint(value) {
    return !!value
        && typeof value.path === 'string'
        && Number.isFinite(value.size)
        && Number.isFinite(value.mtimeMs)
        && Number.isFinite(value.ctimeMs);
}
async function getSourceFingerprint(filePath) {
    const normalizedPath = normalizeFingerprintPath(filePath);
    let stat;
    try {
        stat = await fs_1.default.promises.stat(filePath);
    }
    catch (cause) {
        const error = new Error(`源音频文件不存在或不可读: ${filePath}`);
        error.code = 'SOURCE_MEDIA_UNAVAILABLE';
        error.cause = cause;
        throw error;
    }
    if (!stat.isFile()) {
        const error = new Error(`源音频路径不是文件: ${filePath}`);
        error.code = 'SOURCE_MEDIA_UNAVAILABLE';
        throw error;
    }
    return {
        path: normalizedPath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        ctimeMs: stat.ctimeMs,
    };
}
function sourceFingerprintsEqual(left, right) {
    return isSourceFingerprint(left)
        && isSourceFingerprint(right)
        && left.path === right.path
        && left.size === right.size
        && left.mtimeMs === right.mtimeMs
        && left.ctimeMs === right.ctimeMs;
}
async function assertSourceFingerprintCurrent(filePath, expectedFingerprint) {
    const currentFingerprint = await getSourceFingerprint(filePath);
    if (!sourceFingerprintsEqual(currentFingerprint, expectedFingerprint)) {
        const error = new Error(`源音频文件在媒体处理期间发生了变化: ${filePath}`);
        error.code = 'SOURCE_MEDIA_CHANGED';
        throw error;
    }
    return currentFingerprint;
}
function removeFileIfExists(filePath, description = '文件') {
    try {
        fs_1.default.unlinkSync(filePath);
    }
    catch (error) {
        if (!error || error.code !== 'ENOENT') {
            console.error(`清理${description}失败: `, error);
        }
    }
}
function getTranscodeCacheMetadataPath(transcodePath) {
    return path_1.default.join(path_1.default.dirname(transcodePath), transcodeCacheMetadataDirectoryName, `${path_1.default.basename(transcodePath)}.json`);
}
function invalidateTranscodeCache(transcodePath) {
    removeFileIfExists(transcodePath, '旧转码缓存');
    removeFileIfExists(getTranscodeCacheMetadataPath(transcodePath), '转码缓存指纹');
}
function readValidatedTranscodeCache(transcodePath, sourceFingerprint) {
    const metadataPath = getTranscodeCacheMetadataPath(transcodePath);
    if (!fs_1.default.existsSync(transcodePath)) {
        removeFileIfExists(metadataPath, '孤立转码缓存指纹');
        return null;
    }
    try {
        const metadata = JSON.parse(fs_1.default.readFileSync(metadataPath, 'utf8'));
        if (metadata.version === 1 && sourceFingerprintsEqual(metadata.sourceFingerprint, sourceFingerprint)) {
            return transcodePath;
        }
    }
    catch (error) {
        if (!error || error.code !== 'ENOENT') {
            console.warn('转码缓存指纹无效，将重新转码: ', error);
        }
    }
    invalidateTranscodeCache(transcodePath);
    return null;
}
function writeTranscodeCacheMetadata(transcodePath, sourceFingerprint) {
    const metadataPath = getTranscodeCacheMetadataPath(transcodePath);
    const metadataTempPath = `${metadataPath}.${process.pid}.${Date.now()}.tmp`;
    (0, utils_1.ensureDir)(path_1.default.dirname(metadataPath));
    try {
        fs_1.default.writeFileSync(metadataTempPath, JSON.stringify({
            version: 1,
            sourceFingerprint,
        }));
        removeFileIfExists(metadataPath, '旧转码缓存指纹');
        fs_1.default.renameSync(metadataTempPath, metadataPath);
    }
    finally {
        removeFileIfExists(metadataTempPath, '转码缓存指纹临时文件');
    }
}
function cleanupOrphanedTranscodeMetadata() {
    const metadataDirectory = path_1.default.join(config_1.config.transcodeFolderDir, transcodeCacheMetadataDirectoryName);
    if (!fs_1.default.existsSync(metadataDirectory)) {
        return;
    }
    for (const metadataFile of fs_1.default.readdirSync(metadataDirectory)) {
        if (!metadataFile.endsWith('.json')) {
            continue;
        }
        const transcodeFile = metadataFile.slice(0, -'.json'.length);
        if (!fs_1.default.existsSync(path_1.default.join(config_1.config.transcodeFolderDir, transcodeFile))) {
            removeFileIfExists(path_1.default.join(metadataDirectory, metadataFile), '孤立转码缓存指纹');
        }
    }
}
function scheduleTranscodeCacheCleanup() {
    const timer = setTimeout(() => {
        try {
            audioProcessor.deleteOldFiles(config_1.config.transcodeFolderDir, config_1.config.transcodeKeepCount);
            cleanupOrphanedTranscodeMetadata();
        }
        catch (error) {
            console.error('清理转码缓存失败: ', error);
        }
    }, 1000 * 10);
    if (typeof timer.unref === 'function') {
        timer.unref();
    }
}
function createUnavailableSourceError(message) {
    const error = new Error(message);
    error.code = 'SOURCE_MEDIA_UNAVAILABLE';
    return error;
}
async function resolveTranscodeSource(workId, hashIndex) {
    const work = await db.knex('t_work')
        .select('root_folder', 'dir', 'memo')
        .where('id', '=', workId)
        .first();
    if (!work) {
        throw createUnavailableSourceError(`找不到作品: ${workId}`);
    }
    const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
    if (!rootFolder) {
        throw createUnavailableSourceError(`找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.`);
    }
    const tracks = await (0, utils_1.getTrackList)(workId, path_1.default.join(rootFolder.path, work.dir), (0, utils_1.ensureIsJsonObject)(work.memo));
    const track = tracks[hashIndex];
    if (!track) {
        throw createUnavailableSourceError(`找不到音轨: ${hashIndex}`);
    }
    const fileFullPath = path_1.default.join(rootFolder.path, work.dir, track.subtitle || '', track.title);
    const extName = path_1.default.extname(fileFullPath).toLocaleLowerCase();
    if (!utils_1.supportedMediaExtList.includes(extName)) {
        throw new Error(`Unsupported media type`);
    }
    return {
        fileFullPath,
        sourceFingerprint: await getSourceFingerprint(fileFullPath),
    };
}
async function doTranscodeOrReadFromCache(workId, hashIndex, targetBitRate, readOnly = false, onProgress = () => { }, preparedSource = null) {
    const transcodePath = audioProcessor.genTranscodeOutputPath(workId, hashIndex, targetBitRate, config_1.config.transcodeFolderDir);
    let source;
    try {
        source = preparedSource || await resolveTranscodeSource(workId, hashIndex);
        await assertSourceFingerprintCurrent(source.fileFullPath, source.sourceFingerprint);
    }
    catch (error) {
        invalidateTranscodeCache(transcodePath);
        throw error;
    }
    if (readValidatedTranscodeCache(transcodePath, source.sourceFingerprint)) {
        return transcodePath;
    }
    if (readOnly) {
        return null;
    }
    const transcodeTempPath = audioProcessor.genTranscodeTempOutputPath(config_1.config.transcodeTempFolderDir);
    (0, utils_1.ensureDir)(path_1.default.dirname(transcodePath));
    (0, utils_1.ensureDir)(path_1.default.dirname(transcodeTempPath));
    try {
        await audioProcessor.convertAudioToM4a(source.fileFullPath, transcodeTempPath, targetBitRate, onProgress);
        if (!fs_1.default.existsSync(transcodeTempPath)) {
            throw new Error('转码完成，但未生成临时输出文件.');
        }
        await assertSourceFingerprintCurrent(source.fileFullPath, source.sourceFingerprint);
        if (readValidatedTranscodeCache(transcodePath, source.sourceFingerprint)) {
            return transcodePath;
        }
        fs_1.default.renameSync(transcodeTempPath, transcodePath);
        try {
            writeTranscodeCacheMetadata(transcodePath, source.sourceFingerprint);
            await assertSourceFingerprintCurrent(source.fileFullPath, source.sourceFingerprint);
        }
        catch (error) {
            invalidateTranscodeCache(transcodePath);
            throw error;
        }
        if (!fs_1.default.existsSync(transcodePath)) {
            throw new Error('转码完成，但最终输出文件不存在.');
        }
        scheduleTranscodeCacheCleanup();
        return transcodePath;
    }
    finally {
        removeFileIfExists(transcodeTempPath, '转码临时文件');
    }
}
async function startTranscodeTask(workId, hashIndex, targetBitRate) {
    const transcodeTaskIdentifier = audioProcessor.genTranscodeTaskIdentifier(workId, hashIndex, targetBitRate);
    const cachedTranscodePath = audioProcessor.genTranscodeOutputPath(workId, hashIndex, targetBitRate, config_1.config.transcodeFolderDir);
    let source;
    try {
        source = await resolveTranscodeSource(workId, hashIndex);
    }
    catch (error) {
        invalidateTranscodeCache(cachedTranscodePath);
        transcodeTaskStatus.set(transcodeTaskIdentifier, {
            state: 'failed',
            progress: null,
            error: getErrorMessage(error),
            failedAt: Date.now(),
        });
        throw error;
    }
    if (readValidatedTranscodeCache(cachedTranscodePath, source.sourceFingerprint)) {
        transcodeTaskStatus.delete(transcodeTaskIdentifier);
        return {
            promise: Promise.resolve(cachedTranscodePath),
            started: false,
            accepted: true,
            cached: true,
        };
    }
    const existingTask = transcodeTasks.get(transcodeTaskIdentifier);
    if (existingTask) {
        const existingFingerprint = transcodeTaskSourceFingerprints.get(transcodeTaskIdentifier);
        if (sourceFingerprintsEqual(existingFingerprint, source.sourceFingerprint)) {
            return { promise: existingTask, started: false, accepted: true };
        }
        const retryPromise = existingTask.catch(() => undefined).then(async () => {
            const retryTask = await startTranscodeTask(workId, hashIndex, targetBitRate);
            return retryTask.promise;
        });
        return { promise: retryPromise, started: false, accepted: true };
    }
    if (TaskQueue_1.transcodeTaskQueue.isFull()) {
        const queueStatus = TaskQueue_1.transcodeTaskQueue.getStatus();
        const error = new TaskQueue_1.TaskQueueFullError(queueStatus.name, queueStatus.capacity);
        transcodeTaskStatus.set(transcodeTaskIdentifier, {
            state: 'failed',
            progress: null,
            error: getErrorMessage(error),
            failedAt: Date.now(),
            sourceFingerprint: source.sourceFingerprint,
        });
        return { promise: Promise.reject(error), started: false, accepted: false, error };
    }
    const taskPromise = (async () => {
        transcodeTaskStatus.set(transcodeTaskIdentifier, {
            state: 'waiting',
            progress: null,
            error: null,
            sourceFingerprint: source.sourceFingerprint,
        });
        try {
            const transcodePath = await TaskQueue_1.transcodeTaskQueue.add(() => doTranscodeOrReadFromCache(workId, hashIndex, targetBitRate, false, (progress) => {
                transcodeTaskStatus.set(transcodeTaskIdentifier, {
                    state: 'progress',
                    progress,
                    error: null,
                    sourceFingerprint: source.sourceFingerprint,
                });
            }, source));
            transcodeTaskStatus.delete(transcodeTaskIdentifier);
            return transcodePath;
        }
        catch (error) {
            transcodeTaskStatus.set(transcodeTaskIdentifier, {
                state: 'failed',
                progress: null,
                error: getErrorMessage(error),
                failedAt: Date.now(),
                sourceFingerprint: source.sourceFingerprint,
            });
            throw error;
        }
    })();
    transcodeTasks.set(transcodeTaskIdentifier, taskPromise);
    transcodeTaskSourceFingerprints.set(transcodeTaskIdentifier, source.sourceFingerprint);
    const clearTask = () => {
        if (transcodeTasks.get(transcodeTaskIdentifier) === taskPromise) {
            transcodeTasks.delete(transcodeTaskIdentifier);
            transcodeTaskSourceFingerprints.delete(transcodeTaskIdentifier);
        }
    };
    taskPromise.then(clearTask, clearTask);
    return { promise: taskPromise, started: true, accepted: true };
}
async function getTranscodeStatusResponse(workId, hashIndex, targetBitRate, now = Date.now()) {
    const transcodePath = audioProcessor.genTranscodeOutputPath(workId, hashIndex, targetBitRate, config_1.config.transcodeFolderDir);
    let source;
    try {
        source = await resolveTranscodeSource(workId, hashIndex);
    }
    catch (error) {
        invalidateTranscodeCache(transcodePath);
        return { status: 'failed', ready: false, progress: null, error: getErrorMessage(error) };
    }
    if (readValidatedTranscodeCache(transcodePath, source.sourceFingerprint)) {
        return { status: 'ready', ready: true, progress: null, error: null };
    }
    const transcodeTaskIdentifier = audioProcessor.genTranscodeTaskIdentifier(workId, hashIndex, targetBitRate);
    let taskStatus = transcodeTaskStatus.get(transcodeTaskIdentifier);
    if (taskStatus && (!taskStatus.sourceFingerprint || !sourceFingerprintsEqual(taskStatus.sourceFingerprint, source.sourceFingerprint))) {
        transcodeTaskStatus.delete(transcodeTaskIdentifier);
        taskStatus = null;
    }
    if (taskStatus && taskStatus.state === 'failed') {
        if (now - taskStatus.failedAt < transcodeFailedStatusTtlMs) {
            return { status: 'failed', ready: false, progress: null, error: taskStatus.error };
        }
        transcodeTaskStatus.delete(transcodeTaskIdentifier);
    }
    if (taskStatus && taskStatus.state === 'progress') {
        return { status: 'progress', ready: false, progress: taskStatus.progress, error: null };
    }
    return { status: 'waiting', ready: false, progress: null, error: null };
}
function readTranscodeBitRate(req, res) {
    try {
        return parseTranscodeBitRate(req.query.bitRate);
    }
    catch (error) {
        res.status(400).send({
            error: getErrorMessage(error),
            code: error.code,
            supportedBitRates: Array.from(supportedTranscodeBitRates),
        });
        return null;
    }
}
function sendTaskQueueFull(res, error) {
    if (!error || error.code !== 'TASK_QUEUE_FULL') {
        return false;
    }
    res.status(503).send({
        error: '媒体处理队列已满，请稍后重试.',
        code: error.code,
    });
    return true;
}
router.get('/transcode/:id/:index', (0, express_validator_1.param)('id').isInt(), (0, express_validator_1.param)('index').isInt(), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const workId = parseInt(req.params.id);
    const hashIndex = parseInt(req.params.index);
    const targetBitRate = readTranscodeBitRate(req, res);
    if (targetBitRate === null)
        return;
    try {
        const { promise } = await startTranscodeTask(workId, hashIndex, targetBitRate);
        const transcodePath = await promise;
        res.sendFile(transcodePath);
    }
    catch (err) {
        if (sendTaskQueueFull(res, err))
            return;
        next(err);
    }
});
router.get('/pre-transcode/:id/:index', (0, express_validator_1.param)('id').isInt(), (0, express_validator_1.param)('index').isInt(), async (req, res) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const workId = parseInt(req.params.id);
    const hashIndex = parseInt(req.params.index);
    const targetBitRate = readTranscodeBitRate(req, res);
    if (targetBitRate === null)
        return;
    res.send(await getTranscodeStatusResponse(workId, hashIndex, targetBitRate));
});
router.post('/pre-transcode/:id/:index', (0, express_validator_1.param)('id').isInt(), (0, express_validator_1.param)('index').isInt(), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const workId = parseInt(req.params.id);
    const hashIndex = parseInt(req.params.index);
    const targetBitRate = readTranscodeBitRate(req, res);
    if (targetBitRate === null)
        return;
    try {
        const currentStatus = await getTranscodeStatusResponse(workId, hashIndex, targetBitRate);
        if (currentStatus.ready) {
            res.send(Object.assign({
                message: 'pre-transcode already ready',
                alreadyTranscoding: false,
            }, currentStatus));
            return;
        }
        const task = await startTranscodeTask(workId, hashIndex, targetBitRate);
        if (!task.accepted) {
            void task.promise.catch(() => { });
            sendTaskQueueFull(res, task.error);
            return;
        }
        res.send(Object.assign({
            message: task.started ? 'pre-transcode started' : 'pre-transcode already running',
            alreadyTranscoding: !task.started,
        }, await getTranscodeStatusResponse(workId, hashIndex, targetBitRate)));
        void task.promise.catch((error) => {
            console.error('pre-transcode failed: ', error);
        });
    }
    catch (error) {
        if (sendTaskQueueFull(res, error))
            return;
        next(error);
    }
});
function getAudioInfoTaskIdentifier(fileName, sourceFingerprint) {
    return `${normalizeFingerprintPath(fileName)}\0${sourceFingerprint.size}\0${sourceFingerprint.mtimeMs}\0${sourceFingerprint.ctimeMs}`;
}
function getCachedAudioInfo(fileName, sourceFingerprint) {
    const cachedEntry = lufsPersistentCache.get(fileName);
    if (cachedEntry && sourceFingerprintsEqual(cachedEntry.sourceFingerprint, sourceFingerprint)) {
        return cachedEntry.audioInfo;
    }
    if (cachedEntry) {
        lufsPersistentCache.delete(fileName);
    }
    return null;
}
function cacheAudioInfo(fileName, sourceFingerprint, audioInfo) {
    lufsPersistentCache.set(fileName, {
        sourceFingerprint,
        audioInfo,
    });
}
function schedulePeakCalculation(fileName, sourceFingerprint, audioInfo) {
    const taskIdentifier = getAudioInfoTaskIdentifier(fileName, sourceFingerprint);
    const peakTask = getOrStartSharedTask(peakCalculateTaskStatus, taskIdentifier, () => TaskQueue_1.heavyTaskQueue.add(async () => {
        await assertSourceFingerprintCurrent(fileName, sourceFingerprint);
        const peakLevels = await audioProcessor.getAudioPeaks(fileName);
        await assertSourceFingerprintCurrent(fileName, sourceFingerprint);
        const completedAudioInfo = Object.assign({}, audioInfo, { peakLevels });
        cacheAudioInfo(fileName, sourceFingerprint, completedAudioInfo);
        console.log("peakLevels compute finished for: ", fileName);
        return completedAudioInfo;
    }));
    if (peakTask.started) {
        void peakTask.promise.catch((error) => {
            console.error('peakLevels compute failed: ', error);
        });
    }
    return peakTask.promise;
}
async function getOrCalculateAudioInfo(fileName) {
    let sourceFingerprint;
    try {
        sourceFingerprint = await getSourceFingerprint(fileName);
    }
    catch (error) {
        lufsPersistentCache.delete(fileName);
        throw error;
    }
    const cachedAudioInfo = getCachedAudioInfo(fileName, sourceFingerprint);
    if (cachedAudioInfo) {
        if (Array.isArray(cachedAudioInfo.peakLevels) && cachedAudioInfo.peakLevels.length === 0) {
            schedulePeakCalculation(fileName, sourceFingerprint, cachedAudioInfo);
        }
        return cachedAudioInfo;
    }
    const taskIdentifier = getAudioInfoTaskIdentifier(fileName, sourceFingerprint);
    const loudnormTask = getOrStartSharedTask(lufsCalculateTaskStatus, taskIdentifier, () => TaskQueue_1.lightTaskQueue.add(async () => {
        await assertSourceFingerprintCurrent(fileName, sourceFingerprint);
        console.log("start computing loudnorm for: ", fileName);
        const loudnorm = await audioProcessor.calculateLUFSSplit(fileName);
        await assertSourceFingerprintCurrent(fileName, sourceFingerprint);
        const audioInfo = {
            loudnorm,
            peakLevels: [],
        };
        console.log("finished computing loudnorm for: ", fileName, loudnorm);
        cacheAudioInfo(fileName, sourceFingerprint, audioInfo);
        schedulePeakCalculation(fileName, sourceFingerprint, audioInfo);
        return audioInfo;
    }));
    return loudnormTask.promise;
}
router.get('/calculate/loudnorm/:id/:hash', (0, express_validator_1.param)('id').isInt(), (0, express_validator_1.param)('hash').isInt(), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = req.params.id;
    const hash = req.params.hash;
    try {
        const work = await db.knex('t_work')
            .select('root_folder', 'dir', 'memo')
            .where('id', '=', work_id)
            .first();
        const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (!rootFolder) {
            res.status(500).send({ error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.` });
            return;
        }
        let fileName = "";
        const tracks = await (0, utils_1.getTrackList)(work_id, path_1.default.join(rootFolder.path, work.dir), (0, utils_1.ensureIsJsonObject)(work.memo));
        const track = tracks[hash];
        fileName = path_1.default.join(rootFolder.path, work.dir, track.subtitle || '', track.title);
        const audioInfo = await getOrCalculateAudioInfo(fileName);
        res.send(audioInfo);
    }
    catch (e) {
        if (sendTaskQueueFull(res, e))
            return;
        next(e);
    }
});
exports.__testing = {
    doTranscodeOrReadFromCache,
    getSourceFingerprint,
    getOrCalculateAudioInfo,
    getOrStartSharedTask,
    getTranscodeCacheMetadataPath,
    getTranscodeStatusResponse,
    lufsCalculateTaskStatus,
    parseTranscodeBitRate,
    peakCalculateTaskStatus,
    readValidatedTranscodeCache,
    resolveTranscodeSource,
    startTranscodeTask,
    transcodeTasks,
    transcodeTaskSourceFingerprints,
    transcodeTaskStatus,
    writeTranscodeCacheMetadata,
};
exports.default = router;
