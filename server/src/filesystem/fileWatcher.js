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
exports.startWatcher = startWatcher;
const watcher_1 = __importDefault(require("@parcel/watcher"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const db = __importStar(require("../database/db"));
const idConverter = __importStar(require("./idConverter"));
const scannerModules_1 = require("./scannerModules");
const TaskQueue_1 = require("../utils/TaskQueue");
const utils_1 = require("./utils");
const DEBOUNCE_DELAY_MS = 10 * 1000;
const pendingFolderChanges = new Map();
const subscriptions = [];
function getDepth(rootPath, targetPath) {
    const relative = path_1.default.relative(rootPath, targetPath);
    if (relative === targetPath)
        return 0;
    return relative.split(path_1.default.sep).length;
}
function buildIgnorePatterns(maxDepth) {
    return [
        '**/node_modules/**',
        '**/.git/**',
        '**/System Volume Information/**',
        './' + '*/'.repeat(maxDepth) + '**'
    ];
}
function isDirectory(filePath) {
    try {
        return fs_1.default.statSync(filePath).isDirectory();
    }
    catch {
        return false;
    }
}
function isWithinDepthLimit(rootPath, absolutePath, maxDepth) {
    const depth = getDepth(rootPath, absolutePath);
    return depth <= maxDepth;
}
function isValidFolderEvent(event) {
    return event.type === 'create' || event.type === 'update';
}
async function handleFolderAdd(rootFolderName, code, codeFolderPath, eventType) {
    console.log(`[FileWatcher][eventType:${eventType}] 处理作品文件夹: ${codeFolderPath}, Code: ${code}`);
    const workId = idConverter.codeToIdNumber(code);
    const existingWork = await db.knex('t_work')
        .where('id', '=', workId)
        .first();
    if (existingWork) {
        await handleExistingWork(rootFolderName, code, codeFolderPath, existingWork);
    }
    else {
        await handleNewWork(rootFolderName, code, codeFolderPath);
    }
}
async function handleExistingWork(rootFolderName, code, codeFolderPath, existingWork) {
    const existingWorkFolder = (0, utils_1.getWorkActualPath)(existingWork.root_folder, existingWork.dir);
    const workFolderExists = fs_1.default.existsSync(existingWorkFolder);
    if (!workFolderExists) {
        console.log(`[FileWatcher] 数据库中作品 ${code} 的文件夹路径不存在${existingWorkFolder}，更新为新的路径: ${codeFolderPath}`);
        await db.knex('t_work')
            .where('id', '=', idConverter.codeToIdNumber(code))
            .update({
            root_folder: rootFolderName,
            dir: codeFolderPath
        });
    }
    else {
        console.error(`[FileWatcher][ERROR] 作品 ${code} 已存在且文件夹路径仍存在，检测到重复文件夹: ${codeFolderPath}，跳过，文件路径为: ${existingWorkFolder}`);
    }
}
async function handleNewWork(rootFolderName, code, codeFolderPath) {
    console.log(`[FileWatcher] 开始处理新作品: ${code}`);
    const folder = {
        absolutePath: (0, utils_1.getWorkActualPath)(rootFolderName, codeFolderPath),
        relativePath: codeFolderPath,
        rootFolderName: rootFolderName,
        code
    };
    await (0, scannerModules_1.processFolder)(folder);
}
function collectFolderChange(rootFolderName, relativePath, eventType) {
    const key = `${rootFolderName}:${relativePath}`;
    pendingFolderChanges.set(key, {
        rootFolderName,
        relativePath,
        eventType,
        timestamp: Date.now()
    });
}
function normalizeAndGetUniqueCodes() {
    const codeMap = new Map();
    for (const [, change] of pendingFolderChanges) {
        const result = (0, utils_1.tryMatchWorkCodeFromTopPath)(change.relativePath);
        if (!result) {
            console.log(`[FileWatcher] 忽略非作品文件夹: ${change.relativePath}`);
            continue;
        }
        const { code, codeFolderPath } = result;
        if (!codeMap.has(code)) {
            codeMap.set(code, {
                rootFolderName: change.rootFolderName,
                code,
                codeFolderPath,
                eventType: change.eventType
            });
        }
    }
    pendingFolderChanges.clear();
    return Array.from(codeMap.values());
}
async function flushPendingChanges() {
    if (pendingFolderChanges.size === 0) {
        return;
    }
    const uniqueCodes = normalizeAndGetUniqueCodes();
    console.log(`[FileWatcher] 防抖到期，批量处理 ${uniqueCodes.length} 个作品文件夹变更`);
    for (const { rootFolderName, code, codeFolderPath, eventType } of uniqueCodes) {
        TaskQueue_1.scanTaskQueue.add(() => handleFolderAdd(rootFolderName, code, codeFolderPath, eventType))
            .catch(err => console.error(`[FileWatcher] 处理文件夹失败 (${rootFolderName}:${codeFolderPath}):`, err));
    }
}
let debounceTimer = null;
function scheduleDebounceFlush() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        debounceTimer = null;
        flushPendingChanges().catch(err => console.error('[FileWatcher] 批量处理失败:', err));
    }, DEBOUNCE_DELAY_MS);
}
async function processWatcherEvents(rootFolder, events) {
    const maxDepth = config_1.config.scannerMaxRecursionDepth;
    for (const event of events) {
        if (!isValidFolderEvent(event))
            continue;
        const absolutePath = event.path;
        if (!isDirectory(absolutePath))
            continue;
        const relativePath = path_1.default.relative(rootFolder.path, absolutePath);
        if (!isWithinDepthLimit(rootFolder.path, absolutePath, maxDepth)) {
            console.log(`[FileWatcher] 超过递归深度限制 (${getDepth(rootFolder.path, absolutePath)} > ${maxDepth}), 忽略: ${relativePath}`);
            continue;
        }
        console.log(`[FileWatcher] 收到事件: ${event.type}, rootFolder[${rootFolder.name}].relativePath:  ${relativePath}`);
        collectFolderChange(rootFolder.name, relativePath, event.type);
    }
    scheduleDebounceFlush();
}
async function watchRootFolder(rootFolder) {
    const ignorePatterns = buildIgnorePatterns(config_1.config.scannerMaxRecursionDepth);
    console.log(`[FileWatcher] 监听文件夹: ${rootFolder.path} (${rootFolder.name})`);
    console.log(`[FileWatcher] depthIgnorePattern: ${ignorePatterns[ignorePatterns.length - 1]}`);
    try {
        const subscription = await watcher_1.default.subscribe(rootFolder.path, (err, events) => {
            if (err) {
                console.error(`[FileWatcher] 监听错误: ${err.message}`);
                return;
            }
            setTimeout(() => {
                processWatcherEvents(rootFolder, events)
                    .catch(err => console.error(`[FileWatcher] 处理监听事件失败 (${rootFolder.name}):`, err));
            }, 100);
        }, { ignore: ignorePatterns });
        subscriptions.push(subscription);
        console.log(`[FileWatcher] 已开始监听: ${rootFolder.name}`);
    }
    catch (err) {
        console.error(`[FileWatcher] 启动监听失败 (${rootFolder.name}): ${err.message}`);
    }
}
async function startWatcher() {
    if (subscriptions.length > 0) {
        console.log('[FileWatcher] 文件监听器已经启动，跳过重复初始化');
        return;
    }
    console.log('[FileWatcher] 开始初始化文件监听器...');
    console.log(`[FileWatcher] 防抖延迟: ${DEBOUNCE_DELAY_MS / 1000} 秒`);
    for (const rootFolder of config_1.config.rootFolders) {
        await watchRootFolder(rootFolder);
    }
}
