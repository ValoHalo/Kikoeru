"use strict";
const { t } = require('../i18n');
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
const { decodeTrackPath } = require('../filesystem/trackReference');
const minimatch = require('minimatch');
const supportedLyricExtensions = [".lrc", ".srt", ".vtt"];
function trackReferenceValidator(name) {
    return (0, express_validator_1.param)(name, () => t('media.linkExpired')).custom(value => {
        decodeTrackPath(value);
        return true;
    });
}
async function resolveMediaSource(workId, reference) {
    const relativePath = decodeTrackPath(reference);
    const work = await db.knex('t_work').select('root_folder', 'dir', 'memo', 'nsfw').where('id', workId).first();
    if (!work) throw Object.assign(new Error(t('media.workMissing', { work_id: workId })), { status: 404 });
    const rootFolder = config_1.config.rootFolders.find(folder => folder.name === work.root_folder);
    if (!rootFolder) throw new Error(t('media.folderMissing', { root_folder: work.root_folder }));
    const workDirectory = (0, pathSafety_1.resolvePathInside)(rootFolder.path, work.dir);
    const fileName = (0, pathSafety_1.resolvePathInside)(workDirectory, relativePath);
    const ext = path_1.default.extname(fileName).toLowerCase();
    const supported = utils_1.supportedMediaExtList.includes(ext)
        || ['.lrc', '.srt', '.ass', '.vtt', '.jpg', '.jpeg', '.png', '.webp', '.txt', '.pdf'].includes(ext);
    if (!supported || (config_1.config.excludeFolderGlobs || []).some(rule => minimatch(fileName, rule))) {
        throw Object.assign(new Error(t('media.fileMissing')), { status: 404 });
    }
    const directory = path_1.default.relative(workDirectory, path_1.default.dirname(fileName));
    const track = { title: path_1.default.posix.basename(relativePath), subtitle: directory || null, relativePath, ext };
    return { work, rootFolder, workDirectory, fileName, track };
}
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
const { sendHiddenCover } = require("./utils/coverVisibility");
router.get('/stream/:id/:reference', (0, express_validator_1.param)('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), trackReferenceValidator('reference'), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    try {
        const { work, rootFolder, track, fileName } = await resolveMediaSource(req.params.id, req.params.reference);
        if (sendHiddenCover(req, res, next, work)) return;
        if (track.ext === '.txt' || track.ext === '.lrc') {
            const fileBuffer = await fs_1.default.promises.readFile(fileName);
            const charsetMatch = jschardet_1.default.detect(fileBuffer).encoding;
            if (charsetMatch) res.setHeader('Content-Type', `text/plain; charset=${charsetMatch}`);
        }
        if (track.ext === '.flac') res.setHeader('Content-Type', 'audio/flac');
        if (config_1.config.offloadMedia && track.ext !== '.txt' && track.ext !== '.lrc') {
            const offloadUrl = (0, url_1.joinFragments)(config_1.config.offloadStreamPath, rootFolder.name, work.dir, track.subtitle || '', track.title);
            res.redirect(process.platform === 'win32' ? offloadUrl.replace(/\\/g, '/') : offloadUrl);
        }
        else res.sendFile(fileName, error => { if (error) next(error); });
    }
    catch (error) { next(error); }
});
router.get('/download/:id/:reference', (0, express_validator_1.param)('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), trackReferenceValidator('reference'), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res)) return;
    try {
        const { work, rootFolder, track, fileName } = await resolveMediaSource(req.params.id, req.params.reference);
        if (sendHiddenCover(req, res, next, work)) return;
        if (config_1.config.offloadMedia) {
            const offloadUrl = (0, url_1.joinFragments)(config_1.config.offloadDownloadPath, rootFolder.name, work.dir, track.subtitle || '', track.title);
            res.redirect(process.platform === 'win32' ? offloadUrl.replace(/\\/g, '/') : offloadUrl);
        }
        else res.download(fileName, error => { if (error) next(error); });
    }
    catch (error) { next(error); }
});
router.get('/query-lrc/:id/:reference', (0, express_validator_1.param)('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), trackReferenceValidator('reference'), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = req.params.id;
    try {
        const { work, rootFolder, track } = await resolveMediaSource(work_id, req.params.reference);
        const tracks = await (0, utils_1.getTrackList)(work_id, path_1.default.join(rootFolder.path, work.dir), (0, utils_1.ensureIsJsonObject)(work.memo));
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
router.get('/fetch-lrc/:id/:reference', (0, express_validator_1.param)('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), trackReferenceValidator('reference'), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = req.params.id;
    const hash = req.params.reference;
    try {
        const { track, fileName } = await resolveMediaSource(work_id, req.params.reference);
        const fileBuffer = await fs_1.default.promises.readFile(fileName);
        const charsetMatch = jschardet_1.default.detect(fileBuffer).encoding;
        const fileContent = iconv_lite_1.default.decode(fileBuffer, charsetMatch);
        let lrc = [];
        let extension = path_1.default.extname(fileName).toLowerCase();
        switch (extension) {
            case ".lrc":
                lrc = (0, lyricParser_1.parseLrc)(fileContent);
                break;
            case ".srt":
            case ".vtt":
                lrc = (0, lyricParser_1.parseSrtOrVtt)(fileContent);
                break;
            case ".ass":
            case ".ssa":
                lrc = (0, lyricParser_1.parseAss)(fileContent);
                break;
            default:
                break;
        }
        res.send({
            result: true,
            message: t('media.lyricsFound'),
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
router.post('/save-lrc/:id', accessControl_1.requireAdministrator, (0, express_validator_1.param)('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), async (req, res, next) => {
    const work_id = req.params.id;
    const writePath = req.body.writePath;
    const lyricLines = req.body.lrc;
    if (typeof writePath !== 'string' || !writePath.toLowerCase().endsWith(".vtt")) {
        res.status(500).send({ error: t('media.invalidLyricsPath', { writePath: writePath }) });
        return;
    }
    if (!Array.isArray(lyricLines)) {
        res.status(400).send({ error: t('media.lyricsArrayRequired') });
        return;
    }
    try {
        const work = await db.knex('t_work')
            .select('root_folder', 'dir', 'memo')
            .where('id', '=', work_id)
            .first();
        if (!work) {
            res.status(404).send({ error: t('media.workMissing', { work_id: work_id }) });
            return;
        }
        const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (!rootFolder) {
            res.status(500).send({ error: t('media.folderMissing', { root_folder: work.root_folder }) });
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
router.get('/check-lrc/:id/:reference', (0, express_validator_1.param)('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), trackReferenceValidator('reference'), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = req.params.id;
    try {
        const { work, rootFolder, track } = await resolveMediaSource(work_id, req.params.reference);
        const tracks = await (0, utils_1.getTrackList)(work_id, path_1.default.join(rootFolder.path, work.dir), (0, utils_1.ensureIsJsonObject)(work.memo));
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
            res.send({ result: false, message: t('media.noLyrics'), hash: '' });
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
            message: t('media.lyricsFound'),
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
        const error = new Error(t('media.bitrateInvalid'));
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
    return String(error || t('media.unknownError'));
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
        const error = new Error(t('media.sourceUnreadable', { filePath: filePath }));
        error.code = 'SOURCE_MEDIA_UNAVAILABLE';
        error.cause = cause;
        throw error;
    }
    if (!stat.isFile()) {
        const error = new Error(t('media.sourceNotFile', { filePath: filePath }));
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
        const error = new Error(t('media.sourceChanged', { filePath: filePath }));
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
async function resolveTranscodeSource(workId, trackReference) {
    const { fileName, track } = await resolveMediaSource(workId, trackReference);
    if (!utils_1.supportedMediaExtList.includes(track.ext)) {
        throw new Error(t('media.unsupportedType'));
    }
    return {
        fileFullPath: fileName,
        sourceFingerprint: await getSourceFingerprint(fileName),
    };
}
async function doTranscodeOrReadFromCache(workId, trackReference, targetBitRate, readOnly = false, onProgress = () => { }, preparedSource = null) {
    const transcodePath = audioProcessor.genTranscodeOutputPath(workId, trackReference, targetBitRate, config_1.config.transcodeFolderDir);
    let source;
    try {
        source = preparedSource || await resolveTranscodeSource(workId, trackReference);
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
            throw new Error(t('media.transcodeOutputMissing'));
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
            throw new Error(t('media.finalOutputMissing'));
        }
        scheduleTranscodeCacheCleanup();
        return transcodePath;
    }
    finally {
        removeFileIfExists(transcodeTempPath, '转码临时文件');
    }
}
async function startTranscodeTask(workId, trackReference, targetBitRate) {
    const transcodeTaskIdentifier = audioProcessor.genTranscodeTaskIdentifier(workId, trackReference, targetBitRate);
    const cachedTranscodePath = audioProcessor.genTranscodeOutputPath(workId, trackReference, targetBitRate, config_1.config.transcodeFolderDir);
    let source;
    try {
        source = await resolveTranscodeSource(workId, trackReference);
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
            const retryTask = await startTranscodeTask(workId, trackReference, targetBitRate);
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
            const transcodePath = await TaskQueue_1.transcodeTaskQueue.add(() => doTranscodeOrReadFromCache(workId, trackReference, targetBitRate, false, (progress) => {
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
async function getTranscodeStatusResponse(workId, trackReference, targetBitRate, now = Date.now()) {
    const transcodePath = audioProcessor.genTranscodeOutputPath(workId, trackReference, targetBitRate, config_1.config.transcodeFolderDir);
    let source;
    try {
        source = await resolveTranscodeSource(workId, trackReference);
    }
    catch (error) {
        invalidateTranscodeCache(transcodePath);
        return { status: 'failed', ready: false, progress: null, error: getErrorMessage(error) };
    }
    if (readValidatedTranscodeCache(transcodePath, source.sourceFingerprint)) {
        return { status: 'ready', ready: true, progress: null, error: null };
    }
    const transcodeTaskIdentifier = audioProcessor.genTranscodeTaskIdentifier(workId, trackReference, targetBitRate);
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
        error: t('media.queueFull'),
        code: error.code,
    });
    return true;
}
router.get('/transcode/:id/:reference', (0, express_validator_1.param)('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), trackReferenceValidator('reference'), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const workId = parseInt(req.params.id);
    const trackReference = req.params.reference;
    const targetBitRate = readTranscodeBitRate(req, res);
    if (targetBitRate === null)
        return;
    try {
        const { promise } = await startTranscodeTask(workId, trackReference, targetBitRate);
        const transcodePath = await promise;
        res.sendFile(transcodePath);
    }
    catch (err) {
        if (sendTaskQueueFull(res, err))
            return;
        next(err);
    }
});
router.get('/pre-transcode/:id/:reference', (0, express_validator_1.param)('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), trackReferenceValidator('reference'), async (req, res) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const workId = parseInt(req.params.id);
    const trackReference = req.params.reference;
    const targetBitRate = readTranscodeBitRate(req, res);
    if (targetBitRate === null)
        return;
    res.send(await getTranscodeStatusResponse(workId, trackReference, targetBitRate));
});
router.post('/pre-transcode/:id/:reference', (0, express_validator_1.param)('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), trackReferenceValidator('reference'), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const workId = parseInt(req.params.id);
    const trackReference = req.params.reference;
    const targetBitRate = readTranscodeBitRate(req, res);
    if (targetBitRate === null)
        return;
    try {
        const currentStatus = await getTranscodeStatusResponse(workId, trackReference, targetBitRate);
        if (currentStatus.ready) {
            res.send(Object.assign({
                message: t('media.pretranscodeReady'),
                alreadyTranscoding: false,
            }, currentStatus));
            return;
        }
        const task = await startTranscodeTask(workId, trackReference, targetBitRate);
        if (!task.accepted) {
            void task.promise.catch(() => { });
            sendTaskQueueFull(res, task.error);
            return;
        }
        res.send(Object.assign({
            message: task.started ? t('media.pretranscodeStarted') : t('media.pretranscodeRunning'),
            alreadyTranscoding: !task.started,
        }, await getTranscodeStatusResponse(workId, trackReference, targetBitRate)));
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
router.get('/calculate/loudnorm/:id/:reference', (0, express_validator_1.param)('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), trackReferenceValidator('reference'), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = req.params.id;
    try {
        const { fileName } = await resolveMediaSource(work_id, req.params.reference);
        const audioInfo = await getOrCalculateAudioInfo(fileName);
        res.send(audioInfo);
    }
    catch (e) {
        if (sendTaskQueueFull(res, e))
            return;
        next(e);
    }
});
router.use((error, req, res, next) => {
    if (!res.headersSent && (error.status === 404 || error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
        res.status(404).send({ error: t('media.fileMissing') });
        return;
    }
    next(error);
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
