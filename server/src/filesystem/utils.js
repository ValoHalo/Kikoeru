"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedMediaExtList = exports.saveCoverImageToDisk = exports.toTree = exports.getTrackList = void 0;
exports.isContainLyric = isContainLyric;
exports.naturalSortTree = naturalSortTree;
exports.getFolderList = getFolderList;
exports.deleteCoverImageFromDisk = deleteCoverImageFromDisk;
exports.scrapeWorkMemo = scrapeWorkMemo;
exports.fixGBKShiftJISEncodingBug = fixGBKShiftJISEncodingBug;
exports.audioLyricMatchLevel = audioLyricMatchLevel;
exports.ensureIsJsonObject = ensureIsJsonObject;
exports.formatSeconds = formatSeconds;
exports.getCoverPath = getCoverPath;
exports.getSmartAudioFolderPath = getSmartAudioFolderPath;
exports.assignImportantPathFlag = assignImportantPathFlag;
exports.genUniqueRandomName = genUniqueRandomName;
exports.ensureDir = ensureDir;
exports.parseSafeInt = parseSafeInt;
exports.asleep = asleep;
exports.formatBytes = formatBytes;
exports.isWorkFolderName = isWorkFolderName;
exports.matchWorkCode = matchWorkCode;
exports.tryMatchWorkCodeFromTopPath = tryMatchWorkCodeFromTopPath;
exports.getWorkActualPath = getWorkActualPath;
const fs_1 = __importDefault(require("fs"));
const fsPromises = fs_1.default.promises;
const path_1 = __importDefault(require("path"));
const recursive_readdir_1 = __importDefault(require("recursive-readdir"));
const iconv_lite_1 = __importDefault(require("iconv-lite"));
const natural_orderby_1 = require("natural-orderby");
const url_1 = require("../routes/utils/url");
const config_1 = require("../config");
const minimatch_1 = __importDefault(require("minimatch"));
const natural_compare_lite_1 = __importDefault(require("natural-compare-lite"));
const crypto_1 = __importDefault(require("crypto"));
const supportedMediaExtList = ['.mp3', '.ogg', '.opus', '.wav', '.aac', '.flac', '.webm', '.mp4', '.m4a', '.mka', '.aiff', '.avi'];
exports.supportedMediaExtList = supportedMediaExtList;
const supportedSubtitleExtList = ['.lrc', '.srt', '.ass', ".vtt"];
const supportedImageExtList = ['.jpg', '.jpeg', '.png', '.webp'];
const limit_promise_1 = __importDefault(require("limit-promise"));
const limitP = new limit_promise_1.default(config_1.config.maxParallelism);
const util_1 = __importDefault(require("util"));
const idConverter_1 = require("./idConverter");
const child_process_1 = __importDefault(require("child_process"));
const execFile = util_1.default.promisify(child_process_1.default.execFile);
async function recursiveReaddirWithFilter(dir) {
    const files = await (0, recursive_readdir_1.default)(dir);
    if (!config_1.config.excludeFolderGlobs) {
        return files;
    }
    const filteredFiles = files.filter((file) => !config_1.config.excludeFolderGlobs.some((rule) => (0, minimatch_1.default)(file, rule)));
    return filteredFiles;
}
async function getAudioFileDuration(filePath) {
    try {
        const { stdout } = await execFile('ffprobe', [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            filePath,
        ]);
        const durationSecs = parseFloat(stdout);
        return durationSecs;
    }
    catch (err) {
        console.error(`get duration failed, file = ${filePath}`, err);
    }
    return NaN;
}
const getAudioFileDurationLimited = (filePath) => limitP.call(getAudioFileDuration, filePath);
async function isContainLyric(dir) {
    console.log("isContainLyric check dir: ", dir);
    const files = await recursiveReaddirWithFilter(dir);
    const lyricFiles = files.filter((file) => {
        const ext = path_1.default.extname(file).toLocaleLowerCase();
        return supportedSubtitleExtList.includes(ext);
    });
    console.log("isContainLyric check all files lenth = ", lyricFiles.length);
    return lyricFiles.length > 0;
}
async function scrapeWorkMemo(dir, oldMemo) {
    const files = await recursiveReaddirWithFilter(dir);
    const oldMemoMtime = oldMemo.mtime || {};
    const oldMemoDuration = oldMemo.duration || {};
    const memo = { duration: {}, isContainLyric: false, mtime: {} };
    await Promise.all(files
        .filter((file) => {
        const ext = path_1.default.extname(file).toLowerCase();
        if (supportedSubtitleExtList.includes(ext)) {
            memo.isContainLyric = true;
        }
        return supportedMediaExtList.includes(ext);
    })
        .map((file) => ({
        fullPath: file,
        shortPath: file.replace(path_1.default.join(dir, '/'), '')
    }))
        .map(async (fileDict) => {
        const fstat = fs_1.default.statSync(fileDict.fullPath);
        const newMTime = Math.round(fstat.mtime.getTime());
        const oldMTime = oldMemoMtime[fileDict.shortPath];
        const oldDuration = oldMemoDuration[fileDict.shortPath];
        if (oldMTime === undefined
            || oldDuration === undefined
            || oldMTime !== newMTime) {
            console.log(`update data on file: ${fileDict.fullPath}, fstate.mtime: ${fstat.mtime.getTime()}, `);
            memo.mtime[fileDict.shortPath] = newMTime;
            const duration = await getAudioFileDurationLimited(fileDict.fullPath);
            if (!isNaN(duration) && typeof (duration) === 'number') {
                memo.duration[fileDict.shortPath] = duration;
            }
        }
        else {
            memo.mtime[fileDict.shortPath] = oldMTime;
            memo.duration[fileDict.shortPath] = oldDuration;
        }
    }));
    return memo;
}
const getTrackList = async function (id, dir, readMemo) {
    try {
        const files = await recursiveReaddirWithFilter(dir);
        const filteredFiles = files.filter((file) => {
            const ext = path_1.default.extname(file).toLowerCase();
            return (supportedMediaExtList.includes(ext)
                || supportedSubtitleExtList.includes(ext)
                || supportedImageExtList.includes(ext)
                || ext === '.txt'
                || ext === '.pdf');
        });
        const mappedFiles = filteredFiles.map((file) => {
            const shortFilePath = file.replace(path_1.default.join(dir, '/'), '');
            const dirName = path_1.default.dirname(shortFilePath);
            return {
                title: path_1.default.basename(file),
                subtitle: dirName === '.' ? null : dirName,
                ext: path_1.default.extname(file).toLowerCase(),
                fullPath: file,
                shortFilePath,
            };
        });
        const sortedFiles = (0, natural_orderby_1.orderBy)(mappedFiles, [v => v.subtitle, v => v.title, v => v.ext]);
        const sortedHashedFiles = sortedFiles.map((file, index) => ({
            workId: Number(id),
            title: file.title,
            subtitle: file.subtitle,
            relativePath: file.shortFilePath.replace(/\\/g, '/'),
            hash: `${id}/${index}`,
            ext: file.ext,
            fullPath: file.fullPath,
            shortFilePath: file.shortFilePath,
            duration: undefined,
        }));
        const durationMemo = readMemo.duration ?? {};
        const filesAddAudioDuration = await Promise.all(sortedHashedFiles.map(async (file) => {
            if (supportedMediaExtList.includes(file.ext) && (undefined !== durationMemo[file.shortFilePath])) {
                file.duration = durationMemo[file.shortFilePath];
            }
            delete file.fullPath;
            delete file.shortFilePath;
            return file;
        }));
        return filesAddAudioDuration;
    }
    catch (err) {
        console.log('getTracList error = ', err);
        throw new Error(`Failed to get tracklist from disk: ${err}`);
    }
};
exports.getTrackList = getTrackList;
function splitPathFolders(path) {
    return path ? path.split(/\/|\\/) : [];
}
const toTree = (tracks, workTitle, workDir, rootFolder) => {
    const tree = [];
    tracks.forEach((track) => {
        let fatherFolder = tree;
        const folderList = splitPathFolders(track.subtitle);
        folderList.forEach((folderName) => {
            const index = fatherFolder.findIndex(item => item.type === 'folder' && item.title === folderName);
            if (index === -1) {
                fatherFolder.push({
                    type: 'folder',
                    title: folderName,
                    children: []
                });
            }
            fatherFolder = fatherFolder.find(item => item.type === 'folder' && item.title === folderName).children;
        });
    });
    tracks.forEach((track) => {
        let fatherFolder = tree;
        const folderList = splitPathFolders(track.subtitle);
        folderList.forEach((folderName) => {
            fatherFolder = fatherFolder.find(item => item.type === 'folder' && item.title === folderName).children;
        });
        let offloadStreamUrl = (0, url_1.joinFragments)(config_1.config.offloadStreamPath, rootFolder.name, workDir, track.subtitle || '', track.title);
        let offloadDownloadUrl = (0, url_1.joinFragments)(config_1.config.offloadDownloadPath, rootFolder.name, workDir, track.subtitle || '', track.title);
        if (process.platform === 'win32') {
            offloadStreamUrl = offloadStreamUrl.replace(/\\/g, '/');
            offloadDownloadUrl = offloadDownloadUrl.replace(/\\/g, '/');
        }
        const useOffloadedMedia = config_1.config.offloadMedia && !config_1.config.auth;
        const textBaseUrl = '/api/media/stream/';
        const mediaStreamBaseUrl = '/api/media/stream/';
        const mediaDownloadBaseUrl = '/api/media/download/';
        const textStreamBaseUrl = textBaseUrl + track.hash;
        const textDownloadBaseUrl = useOffloadedMedia ? offloadDownloadUrl : mediaDownloadBaseUrl + track.hash;
        const mediaStreamUrl = useOffloadedMedia ? offloadStreamUrl : mediaStreamBaseUrl + track.hash;
        const mediaDownloadUrl = useOffloadedMedia ? offloadDownloadUrl : mediaDownloadBaseUrl + track.hash;
        if (track.ext === '.txt' || track.ext === '.lrc' || track.ext === '.srt' || track.ext === '.ass' || track.ext === '.vtt') {
            fatherFolder.push({
                type: 'text',
                workId: track.workId,
                relativePath: track.relativePath,
                hash: track.hash,
                title: track.title,
                subtitle: track.subtitle,
                workTitle,
                mediaStreamUrl: textStreamBaseUrl,
                mediaDownloadUrl: textDownloadBaseUrl
            });
        }
        else if (track.ext === '.jpg' || track.ext === '.jpeg' || track.ext === '.png' || track.ext === '.webp') {
            fatherFolder.push({
                type: 'image',
                workId: track.workId,
                relativePath: track.relativePath,
                hash: track.hash,
                title: track.title,
                subtitle: track.subtitle,
                workTitle,
                mediaStreamUrl,
                mediaDownloadUrl
            });
        }
        else if (track.ext === '.pdf') {
            fatherFolder.push({
                type: 'other',
                workId: track.workId,
                relativePath: track.relativePath,
                hash: track.hash,
                title: track.title,
                subtitle: track.subtitle,
                workTitle,
                mediaStreamUrl,
                mediaDownloadUrl
            });
        }
        else {
            fatherFolder.push({
                type: 'audio',
                workId: track.workId,
                relativePath: track.relativePath,
                hash: track.hash,
                title: track.title,
                subtitle: track.subtitle,
                duration: track.duration,
                workTitle,
                mediaStreamUrl,
                mediaDownloadUrl
            });
        }
    });
    return tree;
};
exports.toTree = toTree;
function fullWidthToHalfWidth(str) {
    return str.replace(/[\uFF10-\uFF19]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}
function naturalSortTree(tree) {
    const folders = tree.filter((item) => item.type === 'folder');
    const files = tree.filter((item) => item.type !== 'folder');
    function naturalSortItem(itemA, itemB) {
        return (0, natural_compare_lite_1.default)(fullWidthToHalfWidth(itemA.title), fullWidthToHalfWidth(itemB.title));
    }
    folders.sort(naturalSortItem);
    files.sort(naturalSortItem);
    folders.forEach((item) => naturalSortTree(item.children));
    tree.splice(0, tree.length, ...folders, ...files);
}
const SMART_PATH_AUDIO_TYPES = ['mp3', 'flac', 'wav', 'opus', 'm4a', 'aac'];
const EFFECT_FOLDER_PATTERN = /(?:^|[\s_\-[(])(?:se|sfx)(?=$|[\s_\-\])])|効果音|效果音|音效/i;
function normalizeSmartPathAudioTypes(value) {
    const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
    const normalized = values
        .map(type => String(type).trim().toLowerCase())
        .filter(type => SMART_PATH_AUDIO_TYPES.includes(type))
        .filter((type, index, types) => types.indexOf(type) === index);
    return normalized.concat(SMART_PATH_AUDIO_TYPES.filter(type => !normalized.includes(type)));
}
function getSmartAudioFolderPath(tree, options = {}) {
    if (options.enabled === false)
        return [];
    const candidates = [];
    const collectCandidates = (items, folderPath = []) => {
        const audioFiles = items.filter(item => item.type === 'audio');
        if (audioFiles.length > 0) {
            const typeCounts = Object.create(null);
            for (const file of audioFiles) {
                const extension = path_1.default.extname(file.title || '').slice(1).toLowerCase();
                typeCounts[extension] = (typeCounts[extension] || 0) + 1;
            }
            candidates.push({
                path: folderPath,
                isEffectFolder: folderPath.some(folderName => EFFECT_FOLDER_PATTERN.test(folderName.trim())),
                typeCounts,
                totalCount: audioFiles.length,
            });
        }
        for (const folder of items.filter(item => item.type === 'folder' && Array.isArray(item.children))) {
            collectCandidates(folder.children, folderPath.concat(folder.title));
        }
    };
    collectCandidates(tree);
    if (candidates.length === 0)
        return [];
    let rankedCandidates = candidates;
    if (options.preferEffect !== false) {
        const effectCandidates = candidates.filter(candidate => candidate.isEffectFolder);
        if (effectCandidates.length > 0)
            rankedCandidates = effectCandidates;
    }
    const audioTypes = normalizeSmartPathAudioTypes(options.audioTypes);
    const preferredType = audioTypes.find(type => rankedCandidates.some(candidate => candidate.typeCounts[type]));
    rankedCandidates.sort((candidateA, candidateB) => {
        if (preferredType) {
            const typeCountDifference = (candidateB.typeCounts[preferredType] || 0) - (candidateA.typeCounts[preferredType] || 0);
            if (typeCountDifference !== 0)
                return typeCountDifference;
        }
        return candidateB.totalCount - candidateA.totalCount;
    });
    return rankedCandidates[0].path;
}
function assignImportantPathFlag(tree, importantPathArr) {
    if (importantPathArr.length <= 0)
        return;
    for (const subTree of tree.filter((item) => item.type == 'folder')) {
        if (subTree.title == importantPathArr[0]) {
            subTree.important = true;
            assignImportantPathFlag(subTree.children, importantPathArr.slice(1));
        }
    }
}
const fixRegex = /^([a-zA-Z]{2})(\d*)$/;
function tryNormalizeCode(rawCode) {
    const result = fixRegex.exec(rawCode);
    if (!result)
        throw new Error(`${rawCode} is not a valide code for dlsite`);
    let type = result[1];
    let digits = result[2];
    if (digits.length < 6) {
        while (digits.length < 6) {
            digits = "0".concat(digits);
        }
    }
    else if (6 < digits.length && digits.length < 8) {
        while (digits.length < 8) {
            digits = "0".concat(digits);
        }
    }
    const returnCode = `${type}${digits}`;
    console.log("normalize ", rawCode, " to ", returnCode);
    return returnCode;
}
const codeRegex = /((RJ|BJ|VJ|CC)\d+)/i;
function isWorkFolderName(folderName) {
    return codeRegex.test(folderName);
}
function matchWorkCode(folderName) {
    const match = folderName.match(codeRegex);
    return match ? match[1].toUpperCase() : null;
}
function tryMatchWorkCodeFromTopPath(relativePath) {
    const parts = relativePath.split(path_1.default.sep);
    for (const part of parts) {
        if (isWorkFolderName(part)) {
            const code = matchWorkCode(part);
            const codeIndex = parts.indexOf(part);
            const codeFolderPath = parts.slice(0, codeIndex + 1).join(path_1.default.sep);
            return { code, codeFolderPath };
        }
    }
    return null;
}
function getWorkActualPath(rootFolderName, relativePath) {
    const rootFolder = config_1.config.rootFolders.find(rf => rf.name === rootFolderName);
    if (!rootFolder) {
        throw new Error(`找不到对应的 rootFolder: ${rootFolderName}`);
    }
    return path_1.default.join(rootFolder.path, relativePath);
}
async function* getFolderList(rootFolder, current = '', depth = 0, logger = console) {
    const folders = await fs_1.default.promises.readdir(path_1.default.join(rootFolder.path, current));
    for (const folder of folders) {
        const absolutePath = path_1.default.resolve(rootFolder.path, current, folder);
        const relativePath = path_1.default.join(current, folder);
        try {
            if ((await fs_1.default.promises.stat(absolutePath)).isDirectory()) {
                if (isWorkFolderName(folder)) {
                    yield {
                        absolutePath,
                        relativePath,
                        rootFolderName: rootFolder.name,
                        code: tryNormalizeCode(matchWorkCode(folder).toUpperCase())
                    };
                }
                else if (depth + 1 < config_1.config.scannerMaxRecursionDepth) {
                    yield* getFolderList(rootFolder, relativePath, depth + 1);
                }
            }
        }
        catch (err) {
            if (err.code === 'EPERM') {
                if (err.path && !err.path.endsWith('System Volume Information')) {
                    logger.error(` ! 无法访问 ${err.path}`);
                }
            }
            else {
                throw err;
            }
        }
    }
}
function deleteCoverImageFromDisk(rjcode) {
    const types = ['main', 'sam', '240x240', '360x360'];
    types.forEach(type => {
        fs_1.default.rmSync(path_1.default.join(config_1.config.coverFolderDir, `${rjcode}_img_${type}.jpg`), { force: true });
    });
}
const saveCoverImageToDisk = (buffer, rjcode, type) => new Promise((resolve, reject) => {
    try {
        if (!fs_1.default.existsSync(config_1.config.coverFolderDir)) {
            fs_1.default.mkdirSync(config_1.config.coverFolderDir, { recursive: true });
        }
        const filePath = path_1.default.join(config_1.config.coverFolderDir, `${rjcode}_img_${type}.jpg`);
        fs_1.default.writeFile(filePath, buffer, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    }
    catch (err) {
        reject(err);
    }
});
exports.saveCoverImageToDisk = saveCoverImageToDisk;
async function fixGBKShiftJISEncodingBug(workDir) {
    const subItems = await fsPromises.readdir(workDir);
    for (let item of subItems) {
        const absItem = path_1.default.join(workDir, item);
        const stat = fs_1.default.lstatSync(absItem);
        if (stat.isDirectory()) {
            await fixGBKShiftJISEncodingBug(absItem);
        }
        const buf = iconv_lite_1.default.encode(item, 'gbk');
        const newName = iconv_lite_1.default.decode(buf, 'shift-jis');
        await fsPromises.rename(absItem, path_1.default.join(workDir, newName));
    }
}
function editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    var costs = [];
    for (var i = 0; i <= s1.length; i++) {
        var lastValue = i;
        for (var j = 0; j <= s2.length; j++) {
            if (i == 0)
                costs[j] = j;
            else {
                if (j > 0) {
                    var newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0)
            costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}
function similarity(s1, s2) {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    const longerLength = longer.length;
    if (longerLength == 0) {
        return [1.0, 0];
    }
    const ed = editDistance(longer, shorter);
    return [(longerLength - ed) / parseFloat(String(longerLength)), ed];
}
function bidirectionSimilarity(s1, s2) {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    const longerLength = longer.length;
    const shorterLength = shorter.length;
    if (longerLength == 0) {
        return 1.0;
    }
    const buf = Array(longerLength).fill(0);
    for (let i = 0; i < shorterLength; ++i) {
        if (longer[i] == shorter[i])
            buf[i]++;
        if (longer[longerLength - i - 1] == shorter[shorterLength - i - 1])
            buf[longerLength - i]++;
    }
    const samePortion = buf.reduce((acc, x) => acc + (x == 0 ? 0 : 1), 0);
    const value = samePortion / shorterLength;
    return value;
}
function audioLyricMatchLevel(audioName, lyricName) {
    if (audioName === lyricName)
        return 0;
    else if (audioName.includes(lyricName))
        return 1;
    const opposition = /(あり|なし)/g, oppositionPlaceholder = "<o><p><o>";
    if (audioName.replace(opposition, oppositionPlaceholder) === lyricName.replace(opposition, oppositionPlaceholder)) {
        return 1;
    }
    const digitDetector = /\d/g;
    if (digitDetector.test(audioName) && digitDetector.test(lyricName) && audioName.replace(digitDetector, "") === lyricName.replace(digitDetector, "")) {
        return -1;
    }
    const [sim, ed] = similarity(audioName, lyricName);
    if (audioName.length == lyricName.length && ed <= 2) {
        return -1;
    }
    if (sim > 0.8)
        return 2;
    else if (bidirectionSimilarity(audioName, lyricName) > 0.9)
        return 3;
    return -1;
}
function ensureIsJsonObject(stringOrObject) {
    if (typeof (stringOrObject) === "string") {
        return JSON.parse(stringOrObject);
    }
    return stringOrObject;
}
function formatSeconds(seconds, showMillis = false) {
    const hours = Math.floor(seconds / 3600);
    const h = `${hours}`;
    const m = `${Math.floor(seconds / 60) % 60}`.padStart(2, "0");
    const s = `${Math.floor(seconds) % 60}`.padStart(2, "0");
    let ms = Math.floor(seconds * 1000) % 1000;
    let mss = showMillis ? "." + `${ms}`.padStart(3, "0") : "";
    return hours === 0
        ? m + ":" + s + mss
        : h + ":" + m + ":" + s + mss;
}
function getCoverPath(workId, type, currentUsing = true) {
    const rjcode = (0, idConverter_1.idNumberToCode)(workId);
    const usingTag = currentUsing ? "" : "_origin";
    return path_1.default.join(config_1.config.coverFolderDir, `${rjcode}_img_${type}${usingTag}.jpg`);
}
function ensureDir(dirPath) {
    if (!fs_1.default.existsSync(dirPath)) {
        try {
            fs_1.default.mkdirSync(dirPath, { recursive: true });
        }
        catch (err) {
            console.error("ensureDir failed: ", err);
            return false;
        }
    }
    return true;
}
function genUniqueRandomName() {
    return `${crypto_1.default.randomBytes(6).toString('hex')}_${Date.now()}`;
}
function parseSafeInt(strOrAnyThing, defaultValue = 0) {
    if (typeof (strOrAnyThing) !== 'string') {
        return defaultValue;
    }
    try {
        return parseInt(strOrAnyThing);
    }
    catch {
        return defaultValue;
    }
}
async function asleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
function formatBytes(bytes, decimals = 0) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}
