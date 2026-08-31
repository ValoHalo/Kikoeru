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
exports.performScan = performScan;
exports.performUpdate = performUpdate;
exports.performWorkFileScan = performWorkFileScan;
exports.performRetryFailed = performRetryFailed;
exports.processFolder = processFolder;
exports.classifyFolderResult = classifyFolderResult;
exports.classifyCoverDownloadResults = classifyCoverDownloadResults;
exports.updateMetadata = updateMetadata;
exports.refreshWorks = refreshWorks;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const limit_promise_1 = __importDefault(require("limit-promise"));
const axios_1 = require("../scraper/axios");
const dlsite_new_1 = require("../scraper/dlsite-new");
const asmrOne_1 = require("../scraper/asmrOne");
const db = __importStar(require("../database/db"));
const utils_1 = require("./utils");
const cleanupSafety_1 = require("./cleanupSafety");
const utils_2 = require("../scraper/utils");
const config_1 = require("../config");
const upgrade_1 = require("../upgrade");
const idConverter = __importStar(require("./idConverter"));
const isCustomCode = idConverter.isCustomCode;
const tasks = [];
const failedTasks = [];
const mainLogs = [];
const results = [];
const LOG = {
    finish(message) {
        console.log(` * ${message}`);
        process.send?.({
            event: 'SCAN_FINISHED',
            payload: { message }
        });
    },
    main: {
        __internal__(level, message) {
            console[level]("main log", message);
            mainLogs.push({ level, message });
            process.send?.({ event: 'SCAN_MAIN_LOGS', payload: { mainLogs } });
        },
        log(msg) {
            this.__internal__("info", msg);
        },
        debug(msg) {
            this.__internal__("debug", msg);
        },
        info(msg) {
            this.__internal__("info", msg);
        },
        error(msg) {
            this.__internal__("error", msg);
        },
        warn(msg) {
            this.__internal__("warn", msg);
        }
    },
    result: {
        add(rjcode, result, count) {
            results.push({
                rjcode,
                result,
                count
            });
            process.send?.({
                event: 'SCAN_RESULTS',
                payload: { results }
            });
        }
    },
    task: {
        add(taskId) {
            console.log(`LOG.task.add '${taskId}'`);
            console.assert(typeof (taskId) === "string" && (taskId.length === 8 || taskId.length === 10));
            tasks.push({
                rjcode: taskId,
                result: null,
                logs: []
            });
        },
        remove(taskId, result) {
            console.log(`LOG.task.remove '${taskId}'`);
            const index = tasks.findIndex(task => task.rjcode === taskId);
            if (index == -1) {
                return;
            }
            const removedTask = tasks[index];
            removedTask.result = result;
            tasks.splice(index, 1);
            process.send?.({ event: 'SCAN_TASKS', payload: { tasks } });
            if (removedTask.result === 'failed') {
                failedTasks.push(removedTask);
                process.send?.({ event: 'SCAN_FAILED_TASKS', payload: { failedTasks } });
            }
        },
        __internal_task__(taskId, level, msg) {
            console.assert(typeof (taskId) === "string" && (taskId.length === 8 || taskId.length === 10));
            console[level](`task[${taskId}] log`, msg);
            const task = tasks.find(task => task.rjcode === taskId);
            if (task) {
                task.logs.push({ level, message: msg, });
                process.send?.({ event: 'SCAN_TASKS', payload: { tasks } });
            }
        },
        log(taskId, msg) {
            this.__internal_task__(taskId, "info", msg);
        },
        debug(taskId, msg) {
            this.__internal_task__(taskId, "debug", msg);
        },
        info(taskId, msg) {
            this.__internal_task__(taskId, "info", msg);
        },
        error(taskId, msg) {
            this.__internal_task__(taskId, "error", msg);
        },
        warn(taskId, msg) {
            this.__internal_task__(taskId, "warn", msg);
        }
    },
};

function currentTaskMessage(rjcode) {
    const task = tasks.find(item => item.rjcode === rjcode);
    if (!task || !task.logs.length)
        return '处理失败';
    const meaningfulLogs = task.logs.filter(log => !/添加失败!|处理失败!/.test(log.message));
    const errorLog = [...meaningfulLogs].reverse().find(log => log.level === 'error' || log.level === 'warn');
    return (errorLog || meaningfulLogs[meaningfulLogs.length - 1] || task.logs[task.logs.length - 1]).message;
}

function inferFailureStage(message) {
    const text = String(message || '');
    if (/封面|图片/.test(text))
        return 'cover';
    if (/数据库|添加元数据/.test(text))
        return 'database';
    if (/文件|目录|歌词|字幕/.test(text))
        return 'filesystem';
    return 'metadata';
}

async function persistFolderResult(folder, result) {
    const identity = {
        code: folder.code,
        rootFolder: folder.rootFolderName,
        relativeDir: folder.relativePath,
    };
    if (result === 'failed') {
        const message = currentTaskMessage(folder.code);
        await db.recordScanFailure({ ...identity, stage: inferFailureStage(message), message });
    }
    else {
        await db.clearScanFailure(identity);
    }
}
process.on('message', (m) => {
    if (m.emit === 'SCAN_INIT_STATE') {
        process.send?.({
            event: 'SCAN_INIT_STATE',
            payload: {
                tasks,
                failedTasks,
                mainLogs,
                results
            }
        });
    }
    else if (m.exit) {
        LOG.main.error(' ! 终止扫描进程.');
        process.exit(1);
    }
});
function uniqueFolderListSeparate(arr) {
    const uniqueList = [];
    const duplicateSet = {};
    for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
            if (arr[i].code === arr[j].code) {
                duplicateSet[arr[i].code] = duplicateSet[arr[i].code] || [];
                duplicateSet[arr[i].code].push(arr[i]);
                ++i;
            }
        }
        uniqueList.push(arr[i]);
    }
    return {
        uniqueList,
        duplicateSet,
    };
}
;
async function retryScrapeWorkMetadata(id) {
    const rjcode = idConverter.idNumberToCode(id);
    try {
        console.log(`[${rjcode}] 从 DLsite 数据源抓取元数据...`);
        const data = await (0, dlsite_new_1.newScrapeWorkMetadataFromDLsite)(id);
        console.log(`[${rjcode}] 从 DLsite 数据源抓取元数据成功`);
        return data;
    }
    catch (error) {
        LOG.task.warn(rjcode, `DLSite 获取元数据失败: ${error.message}`);
    }
    try {
        console.log(`[${rjcode}] 从 ASMR ONE 数据源抓取元数据...`);
        const data = await (0, asmrOne_1.scrapeWorkMetadataFromAsmrOne)(id);
        console.log(`[${rjcode}] 从 ASMR ONE 数据源抓取元数据成功`);
        return data;
    }
    catch (error) {
        LOG.task.warn(rjcode, `ASMR ONE获取元数据失败: ${error.message}`);
    }
    LOG.task.warn(rjcode, `所有尝试获取元数据的方法均失败，无法添加该作品`);
    return null;
}
async function getMetadata(id, rootFolderName, dir, hasLyric) {
    const rjcode = idConverter.idNumberToCode(id);
    LOG.task.info(rjcode, '从 DLSite 抓取元数据...');
    const metadata = await retryScrapeWorkMetadata(id);
    if (metadata === null) {
        LOG.task.error(rjcode, `元数据获取失败`);
        return 'failed';
    }
    LOG.task.info(rjcode, '元数据抓取成功，准备添加到数据库...');
    metadata.rootFolderName = rootFolderName;
    metadata.dir = dir;
    metadata.lyric_status = hasLyric ? "local" : "";
    try {
        await db.insertWorkMetadata(metadata);
    }
    catch (error) {
        LOG.task.error(rjcode, `元数据添加失败: ${error.message}`);
        return 'failed';
    }
    LOG.task.info(rjcode, '元数据成功添加到数据库.');
    return 'added';
}
;
async function insertCustomMetadata(code, productAbsoluteFolder, rootFolderName, dir, hasLyric) {
    const initCustomCodeRegex = /CC\d{6,}/g;
    const initMeta = {
        "tags": [],
        "vas": [
            dlsite_new_1.defaultNVA,
        ],
        "title": path_1.default.basename(dir).replace(initCustomCodeRegex, ""),
        "circle": {
            "id": 0,
            "name": "自定义社团"
        },
        rootFolderName,
        dir,
        lyric_status: hasLyric ? "local" : "",
        "nsfw": true,
        "release": "2025-01-01",
        "id": idConverter.codeToIdNumber(code),
        "dl_count": 0,
        "rate_average_2dp": 0,
        "rate_count": 0,
        "rate_count_detail": [],
        "review_count": 0,
        "price": 100,
        "original_work_id": 0,
        "translation_lang": null,
        "rank": [],
        code: "",
    };
    await db.fillNewCustomMetaInfo(initMeta);
    console.log("insert custom metadata: ", initMeta);
    const rjcode = idConverter.idNumberToCode(initMeta.id);
    initMeta.code = rjcode;
    LOG.task.add(rjcode);
    LOG.task.info(rjcode, `新增自定义作品，配置code为：${rjcode}`);
    const dirname = path_1.default.dirname(productAbsoluteFolder);
    const basename = path_1.default.basename(productAbsoluteFolder);
    const newBasename = basename.replace(initCustomCodeRegex, rjcode);
    const newAbsolutePath = path_1.default.join(dirname, newBasename);
    const newDirInRootFolder = dir.replace(basename, newBasename);
    fs_1.default.renameSync(productAbsoluteFolder, newAbsolutePath);
    initMeta.dir = newDirInRootFolder;
    LOG.task.info(rjcode, `修改原文件夹名称，从'${basename}'变成'${newBasename}'`);
    try {
        await db.insertWorkMetadata(initMeta);
    }
    catch (error) {
        LOG.task.error(rjcode, `元数据添加失败: ${error.message}`);
        return null;
    }
    return initMeta;
}
async function getCoverImageForTranslated(code, types, skipFailed = false) {
    const rjcode = code;
    const result = await getCoverImage(rjcode, types);
    if (result === 'failed' && skipFailed) {
        LOG.main.warn(`${rjcode} 作品本身在DlSite上缺失部分图片，忽略这些问题`);
        return 'skipped';
    }
    return result;
}
async function getCoverImage(coverForCode, types) {
    LOG.task.info(coverForCode, '从 DLsite 下载封面...');
    const id = idConverter.codeToIdNumber(coverForCode);
    const coverUrls = await (0, dlsite_new_1.getCoverUrlsFromDLsite)(id);
    const results = await Promise.all(types.map(async (type) => {
        const url = coverUrls?.[type];
        if (!url) {
            LOG.task.warn(coverForCode, `封面 ${type} 无 URL，跳过`);
            return null;
        }
        LOG.task.info(coverForCode, `从 DLsite 下载封面 ${type}, url: ${url}`);
        try {
            const imageRes = await (0, axios_1.retryGet)(url, { retry: {}, responseType: 'arraybuffer' });
            LOG.task.info(coverForCode, `封面 ${coverForCode}_img_${type}.jpg network response got`);
            await (0, utils_1.saveCoverImageToDisk)(imageRes.data, coverForCode, type);
            LOG.task.info(coverForCode, `封面 ${coverForCode}_img_${type}.jpg 下载成功.`);
            return type;
        }
        catch (err) {
            const msg = type === "main" ? "主图失败" : "非主图或缩略图下载失败请忽略";
            LOG.task.warn(coverForCode, `在下载封面 ${coverForCode}_img_${type}.jpg 过程中出错: ${err.message}, url = ${url}, msg = ${msg}`);
            LOG.main.warn(`[${coverForCode}] 在下载封面 ${coverForCode}_img_${type}.jpg 过程中出错: ${err.message}, url = ${url}, msg = ${msg}`);
            return null;
        }
    }));
    return classifyCoverDownloadResults(results);
}
function classifyCoverDownloadResults(results) {
    return results.some(Boolean) ? 'added' : 'failed';
}
function classifyFolderResult(workExists, coverResult) {
    switch (coverResult) {
        case 'skipped':
            return workExists ? 'skipped' : 'added';
        case 'added':
            return workExists ? 'updated' : 'added';
        case 'failed':
        default:
            return 'failed';
    }
}
async function processFolder(folder) {
    const res = await db.knex('t_work')
        .select('id')
        .where('id', '=', idConverter.codeToIdNumber(folder.code))
        .count()
        .first();
    const rjcode = folder.code;
    const coverTypes = ['main', 'sam', '240x240'];
    const workExists = Number(res['count(*)']) > 0;
    let coverResult;
    if (isCustomCode(rjcode)) {
        if (workExists) {
            coverResult = "skipped";
        }
        else {
            const hasLyric = await (0, utils_1.isContainLyric)(folder.absolutePath);
            LOG.task.info(rjcode, `作品中是否有字幕：${hasLyric}`);
            LOG.task.info(rjcode, `扫描音频文件时长`);
            const memo = await (0, utils_1.scrapeWorkMemo)(folder.absolutePath, {});
            const insertedMetaOrNull = await insertCustomMetadata(folder.code, folder.absolutePath, folder.rootFolderName, folder.relativePath, hasLyric);
            if (!insertedMetaOrNull) {
                return 'failed';
            }
            folder.code = insertedMetaOrNull.code;
            await db.setWorkMemo(insertedMetaOrNull.id, memo);
            coverResult = "skipped";
        }
    }
    else if (workExists) {
        const lostCoverTypes = [];
        coverTypes.forEach(type => {
            const coverPath = path_1.default.join(config_1.config.coverFolderDir, `${rjcode}_img_${type}.jpg`);
            if (!fs_1.default.existsSync(coverPath)) {
                lostCoverTypes.push(type);
            }
        });
        if (lostCoverTypes.length) {
            LOG.task.add(rjcode);
            LOG.task.info(rjcode, '封面图片缺失，重新下载封面图片...');
            coverResult = await getCoverImageForTranslated(folder.code, lostCoverTypes, true);
        }
        else {
            coverResult = 'skipped';
        }
    }
    else {
        LOG.task.add(rjcode);
        LOG.task.info(rjcode, `发现新文件夹: "${folder.absolutePath}"`);
        const hasLyric = await (0, utils_1.isContainLyric)(folder.absolutePath);
        LOG.task.info(rjcode, `作品中是否有字幕：${hasLyric}`);
        LOG.task.info(rjcode, `扫描音频文件时长`);
        const memo = await (0, utils_1.scrapeWorkMemo)(folder.absolutePath, {});
        const work_id = idConverter.codeToIdNumber(folder.code);
        const result = await getMetadata(work_id, folder.rootFolderName, folder.relativePath, hasLyric);
        if (result === 'failed') {
            return 'failed';
        }
        await db.setWorkMemo(work_id, memo);
        coverResult = await getCoverImageForTranslated(folder.code, coverTypes, true);
    }
    return classifyFolderResult(workExists, coverResult);
}
const MAX = config_1.config.maxParallelism;
const limitP = new limit_promise_1.default(MAX);
async function processFolderLimited(folder) {
    return await limitP.call(processFolder, folder);
}
;
async function performCleanup() {
    const works = await db.knex('t_work').select('id', 'root_folder', 'dir');
    const cleanupReport = (0, cleanupSafety_1.assertCleanupSafe)(config_1.config.rootFolders, works, {
        allowEmptyRootCleanup: config_1.config.allowEmptyRootCleanup === true,
        allowLargeCleanup: config_1.config.allowLargeCleanup === true,
        maxMissingRatio: config_1.config.cleanupMaxMissingRatio,
    });
    const trxProvider = db.knex.transactionProvider();
    const trx = await trxProvider();
    try {
        for (const work of cleanupReport.missingWorks) {
            await db.removeWork(work.id, trxProvider);
            const rjcode = idConverter.idNumberToCode(work.id);
            try {
                (0, utils_1.deleteCoverImageFromDisk)(rjcode);
            }
            catch (err) {
                if (err && err.code !== 'ENOENT') {
                    LOG.main.error(`[${rjcode}] 在删除封面过程中出错: ${err.message}`);
                }
            }
        }
        await trx.commit();
    }
    catch (error) {
        await trx.rollback();
        throw error;
    }
}
;
async function fixVADatabase() {
    let success = true;
    if (upgrade_1.updateLock.isLockFilePresent && upgrade_1.updateLock.lockFileConfig.fixVA) {
        LOG.main.log('开始进行声优元数据修复，需要联网');
        try {
            const updateResult = await fixVoiceActorBug();
            if (updateResult.failed) {
                LOG.main.error(`声优元数据修复失败 ${updateResult.failed} 个，保留修复任务以便下次重试`);
                success = false;
            }
            else {
                upgrade_1.updateLock.removeLockFile();
                LOG.main.log('完成元数据修复');
            }
        }
        catch (err) {
            LOG.main.error(err.toString());
            success = false;
        }
    }
    return success;
}
async function tryCleanupStage() {
    if (config_1.config.skipCleanup) {
        LOG.main.info('跳过清理“不存在的音声数据”');
    }
    else {
        try {
            LOG.main.info('清理本地不再存在的音声的数据与封面图片...');
            await performCleanup();
            LOG.main.info('清理完成. 现在开始扫描...');
        }
        catch (err) {
            LOG.main.error(`在执行清理过程中出错: ${err.message}`);
            process.exit(1);
        }
    }
}
async function tryScanRootFolders() {
    let folderList = [];
    try {
        for (const rootFolder of config_1.config.rootFolders) {
            for await (const folder of (0, utils_1.getFolderList)(rootFolder, '', 0, LOG.main)) {
                folderList.push(folder);
            }
        }
        LOG.main.info(`共找到 ${folderList.length} 个音声文件夹.`);
    }
    catch (err) {
        LOG.main.error(`在扫描根文件夹的过程中出错: ${err.message}`);
        process.exit(1);
    }
    return folderList;
}
async function tryProcessFolderListParallel(folderList) {
    const counts = {
        added: 0,
        failed: 0,
        skipped: 0,
        updated: 0
    };
    const customCodeFolder = folderList.filter((x) => isCustomCode(x.code));
    const dlsitCodeFolder = folderList.filter((x) => !isCustomCode(x.code));
    try {
        const { uniqueList: uniqueFolderList, duplicateSet } = uniqueFolderListSeparate(dlsitCodeFolder);
        const duplicateNum = dlsitCodeFolder.length - uniqueFolderList.length;
        if (duplicateNum) {
            LOG.main.info(`发现 ${duplicateNum} 个重复的音声文件夹.`);
            for (const key in duplicateSet) {
                const addedFolder = uniqueFolderList.find(folder => folder.code === key);
                duplicateSet[key].push(addedFolder);
                LOG.main.info(`[${key}] 存在多个文件夹:`);
                duplicateSet[key].forEach((folder) => {
                    const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === folder.rootFolderName);
                    const absolutePath = path_1.default.join(rootFolder.path, folder.relativePath);
                    LOG.main.info(`--> ${absolutePath}`);
                });
            }
        }
        counts.skipped += duplicateNum;
        const readyToBeProcessedFolderList = uniqueFolderList.concat(customCodeFolder);
        await Promise.all(readyToBeProcessedFolderList.map(async (folder) => {
            let result;
            try {
                result = await processFolderLimited(folder);
            }
            catch (error) {
                if (!tasks.some(task => task.rjcode === folder.code))
                    LOG.task.add(folder.code);
                LOG.task.error(folder.code, `处理目录时出错: ${error.message || error}`);
                result = 'failed';
            }
            counts[result] += 1;
            switch (result) {
                case 'added':
                    LOG.task.info(folder.code, `添加成功! Added: ${counts.added}`);
                    break;
                case 'updated':
                    LOG.task.info(folder.code, `更新成功! Updated: ${counts.updated}`);
                    break;
                case 'failed':
                    LOG.task.error(folder.code, `添加失败! Failed: ${counts.failed}`);
                    break;
                default: break;
            }
            await persistFolderResult(folder, result);
            LOG.task.remove(folder.code, result);
            if (result !== 'skipped')
                LOG.result.add(folder.code, result, counts[result]);
        }));
    }
    catch (err) {
        LOG.main.error(`在并行处理音声文件夹过程中出错: ${err.message}`);
        console.error(err.stack);
        process.exit(1);
    }
    return counts;
}
async function performScan() {
    if (!fs_1.default.existsSync(config_1.config.coverFolderDir)) {
        try {
            fs_1.default.mkdirSync(config_1.config.coverFolderDir, { recursive: true });
        }
        catch (err) {
            LOG.main.error(`在创建存放音声封面图片的文件夹时出错: ${err.message}`);
            process.exit(1);
        }
    }
    const fixVADatabaseSuccess = await fixVADatabase();
    await tryCleanupStage();
    const folderList = await tryScanRootFolders();
    const folderResult = await tryProcessFolderListParallel(folderList);
    const message = folderResult.updated ? `扫描完成: 更新 ${folderResult.updated} 个，新增 ${folderResult.added} 个，跳过 ${folderResult.skipped} 个，失败 ${folderResult.failed} 个.` : `扫描完成: 新增 ${folderResult.added} 个，跳过 ${folderResult.skipped} 个，失败 ${folderResult.failed} 个.`;
    LOG.finish(message);
    db.knex.destroy();
    if (!fixVADatabaseSuccess || folderResult.failed) {
        process.exit(1);
    }
    process.exit(0);
}
;
async function performRetryFailed() {
    if (!fs_1.default.existsSync(config_1.config.coverFolderDir)) {
        fs_1.default.mkdirSync(config_1.config.coverFolderDir, { recursive: true });
    }
    const failures = await db.getScanFailures();
    const folderList = [];
    const counts = { added: 0, failed: 0, skipped: 0, updated: 0 };
    for (const failure of failures) {
        const rootFolder = config_1.config.rootFolders.find(item => item.name === failure.root_folder);
        if (!rootFolder) {
            LOG.main.warn(`[${failure.code}] 找不到媒体根目录 ${failure.root_folder}，保留失败记录`);
            counts.failed += 1;
            continue;
        }
        const workId = idConverter.codeToIdNumber(failure.code);
        const work = await db.knex('t_work')
            .select('id', 'root_folder', 'dir', 'lyric_status', 'memo')
            .where('id', workId)
            .first();
        if (work && failure.stage === 'metadata') {
            const result = await updateMetadataLimited(workId, { refreshAll: true });
            counts[result] += 1;
            const identity = { code: failure.code, rootFolder: failure.root_folder, relativeDir: failure.relative_dir };
            if (result === 'failed') {
                await db.recordScanFailure({ ...identity, stage: 'metadata', message: currentTaskMessage(failure.code) });
            }
            else {
                await db.clearScanFailure(identity);
            }
            LOG.task.remove(failure.code, result);
            if (result !== 'skipped')
                LOG.result.add(failure.code, result, counts[result]);
            continue;
        }
        if (work && failure.stage === 'filesystem') {
            const result = await scanWorkFileLimited(work, counts.updated + counts.failed, failures.length);
            counts[result] += 1;
            if (result !== 'skipped')
                LOG.result.add(failure.code, result, counts[result]);
            continue;
        }
        folderList.push({
            code: failure.code,
            rootFolderName: failure.root_folder,
            relativePath: failure.relative_dir,
            absolutePath: path_1.default.join(rootFolder.path, failure.relative_dir),
        });
    }
    LOG.main.info(`准备重试 ${folderList.length} 个失败项.`);
    const folderCounts = await tryProcessFolderListParallel(folderList);
    Object.keys(counts).forEach(key => { counts[key] += folderCounts[key]; });
    LOG.finish(`重试完成: 更新 ${counts.updated} 个，新增 ${counts.added} 个，跳过 ${counts.skipped} 个，失败 ${counts.failed} 个.`);
    db.knex.destroy();
    process.exit(counts.failed ? 1 : 0);
}
async function updateMetadata(id, options = {}) {
    let scrapeProcessor = () => {
        try {
            return (0, dlsite_new_1.newDLSiteDynamicExtended)(id);
        }
        catch (error) {
            LOG.task.warn(rjcode, `获取动态元数据失败: ${error.message}`);
        }
    };
    if (options.includeVA || options.includeTags || options.includeNSFW || options.refreshAll) {
        scrapeProcessor = () => retryScrapeWorkMetadata(id);
    }
    const rjcode = idConverter.idNumberToCode(id);
    LOG.task.add(rjcode);
    try {
        const work = await db.knex('t_work').select(["id", "is_custom_meta"]).where('id', '=', id).first();
        if (work && work.is_custom_meta >= 1) {
            LOG.task.log(rjcode, `存在自定义元数据，为避免覆盖掉自定义内容，跳过当前作品的更新流程`);
            return 'skipped';
        }
        const metadata = await scrapeProcessor();
        if (!metadata) {
            LOG.task.warn(rjcode, `获取元数据失败，无法更新`);
            return 'failed';
        }
        LOG.task.log(rjcode, `元数据抓取成功，准备更新元数据...`);
        metadata.id = id;
        await db.updateWorkMetadata(metadata, options);
        LOG.task.log(rjcode, `元数据更新成功`);
        return 'updated';
    }
    catch (err) {
        LOG.task.error(rjcode, `在抓取元数据过程中出错: ${err}`);
        console.error(err.stack);
        return 'failed';
    }
}
;
async function updateMetadataLimited(id, options = {}) {
    return limitP.call(updateMetadata, id, options);
}
async function updateVoiceActorLimited(id) {
    return limitP.call(updateMetadata, id, { includeVA: true });
}
async function performUpdate(options) {
    const baseQuery = db.knex('t_work').select('id', 'root_folder', 'dir');
    const processor = (id) => updateMetadataLimited(id, options);
    const counts = await refreshWorks(baseQuery, 'id', processor);
    const message = `扫描完成: 更新 ${counts.updated} 个，跳过 ${counts.skipped} 个，失败 ${counts.failed} 个.`;
    LOG.finish(message);
    db.knex.destroy();
    if (counts.failed)
        process.exit(1);
}
;
async function fixVoiceActorBug() {
    const baseQuery = db.knex('r_va_work').select('va_id', 'work_id');
    const filter = (query) => query.where('va_id', (0, utils_2.nameToUUID)('かの仔')).orWhere('va_id', (0, utils_2.nameToUUID)('こっこ'));
    const processor = (id) => updateVoiceActorLimited(id);
    return await refreshWorks(filter(baseQuery), 'work_id', processor);
}
;
async function refreshWorks(query, idColumnName, processor) {
    const works = await query;
    LOG.main.info(`共 ${works.length} 个作品. 开始刷新`);
    const counts = {
        updated: 0,
        skipped: 0,
        failed: 0,
    };
    await Promise.all(works.map(async (work) => {
        const workid = work[idColumnName];
        const rjcode = idConverter.idNumberToCode(workid);
        const result = await processor(workid);
        counts[result]++;
        const storedWork = work.root_folder !== undefined
            ? work
            : await db.knex('t_work').select('root_folder', 'dir').where('id', workid).first();
        if (storedWork) {
            const identity = { code: rjcode, rootFolder: storedWork.root_folder, relativeDir: storedWork.dir };
            if (result === 'failed') {
                const message = currentTaskMessage(rjcode);
                await db.recordScanFailure({ ...identity, stage: 'metadata', message });
            }
            else {
                await db.clearScanFailure(identity);
            }
        }
        LOG.task.remove(rjcode, result);
        if (result !== 'skipped')
            LOG.result.add(rjcode, result, counts[result]);
    }));
    LOG.main.log(`完成元数据更新 ${counts.updated} 个，跳过 ${counts.skipped} 个，失败 ${counts.failed} 个.`);
    return counts;
}
;
async function scanWorkFile(work, index, total) {
    const rjcode = idConverter.idNumberToCode(work.id);
    LOG.main.info(`扫描进度：${index + 1}/${total}`);
    try {
        const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (!rootFolder)
            return "skipped";
        const absoluteWorkDir = path_1.default.join(rootFolder.path, work.dir);
        const hasLocalLyric = await (0, utils_1.isContainLyric)(absoluteWorkDir);
        if (await db.updateWorkLocalLyricStatus(hasLocalLyric, work.lyric_status, work.id)) {
            LOG.main.info(`[${rjcode}] 歌词状态发生改变`);
        }
        const memo = await (0, utils_1.scrapeWorkMemo)(absoluteWorkDir, (work.memo
            ? (0, utils_1.ensureIsJsonObject)(work.memo)
            : {}));
        await db.setWorkMemo(work.id, memo);
        await db.clearScanFailure({ code: rjcode, rootFolder: work.root_folder, relativeDir: work.dir });
        return "updated";
    }
    catch (error) {
        LOG.main.error(`[${rjcode}] 扫描歌词过程中发生错误：${error}`);
        console.error(error.stack);
        await db.recordScanFailure({
            code: rjcode,
            rootFolder: work.root_folder,
            relativeDir: work.dir,
            stage: 'filesystem',
            message: error.message || String(error),
        });
        return "failed";
    }
}
async function scanWorkFileLimited(work, index, total) {
    return limitP.call(scanWorkFile, work, index, total);
}
async function performWorkFileScan() {
    LOG.main.info(`扫描本地文件开始`);
    const works = await db.knex('t_work').select('id', "root_folder", "dir", "lyric_status", "memo");
    LOG.main.info(`总计 ${works.length} 个作品`);
    const results = await Promise.all(works.map((work, index) => scanWorkFileLimited(work, index, works.length)));
    const counts = results.reduce((acc, x) => (acc[x]++, acc), {
        updated: 0,
        skipped: 0,
        failed: 0,
    });
    const message = `扫描完成: 更新 ${counts.updated} 个，失败 ${counts.failed} 个，跳过 ${counts.skipped} 个.`;
    LOG.finish(message);
    db.knex.destroy();
    if (counts.failed)
        process.exit(1);
    process.exit(0);
}
