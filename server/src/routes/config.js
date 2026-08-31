"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const lodash_1 = __importDefault(require("lodash"));
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = express_1.default.Router();
const config_1 = require("../config");
const dlsite_tag_map_1 = require("../scraper/dlsite-tag-map");
const db_1 = require("../database/db");
const accessControl_1 = require("../auth/accessControl");
const httpClient = require("../network/httpClient");
const utils_1 = require("../filesystem/utils");

const SETUP_VERSION = 1;
const NETWORK_TEST_TARGETS = [
    {
        key: 'dlsite',
        label: 'DLsite 元数据',
        url: 'https://www.dlsite.com/maniax/api/=/product.json?workno=RJ01000001&locale=ja_JP',
    },
    {
        key: 'dlsiteImage',
        label: 'DLsite 图片 CDN',
        url: 'https://img.dlsite.jp/',
    },
    {
        key: 'metaServer',
        label: 'Kikoeru 元数据服务',
        url: null,
    },
    {
        key: 'github',
        label: 'GitHub Releases',
        url: 'https://api.github.com/repos/ValoHalo/Kikoeru/releases/latest',
    },
];

function isSetupComplete() {
    return Number(config_1.config.setupVersion) >= SETUP_VERSION
        || (Array.isArray(config_1.config.rootFolders) && config_1.config.rootFolders.length > 0);
}

function normalizeNetworkConfig(input = {}) {
    const mode = httpClient.resolveProxyMode(input);
    const port = Number(input.httpProxyPort || 0);
    if (mode === httpClient.PROXY_MODES.MANUAL && (!Number.isInteger(port) || port < 1 || port > 65535)) {
        throw new Error('手动代理端口必须是 1 到 65535 之间的整数');
    }
    return {
        httpProxyMode: mode,
        httpProxyHost: String(input.httpProxyHost || '').trim(),
        httpProxyPort: Number.isInteger(port) && port >= 0 && port <= 65535 ? port : 0,
    };
}

async function inspectRootFolder(rootFolder, maxDepth) {
    const folderPath = path_1.default.resolve(String(rootFolder.path || '').trim());
    if (!path_1.default.isAbsolute(String(rootFolder.path || '').trim())) {
        throw new Error('媒体目录必须使用绝对路径');
    }
    const stat = await fs_1.default.promises.stat(folderPath);
    if (!stat.isDirectory()) {
        throw new Error('媒体目录路径不是文件夹');
    }
    await fs_1.default.promises.access(folderPath, fs_1.default.constants.R_OK);

    let workCount = 0;
    let unreadableCount = 0;
    async function walk(currentPath, depth) {
        let entries;
        try {
            entries = await fs_1.default.promises.readdir(currentPath, { withFileTypes: true });
        }
        catch (error) {
            if (depth === 0)
                throw error;
            unreadableCount += 1;
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if ((0, utils_1.isWorkFolderName)(entry.name)) {
                workCount += 1;
            }
            else if (depth + 1 < maxDepth) {
                await walk(path_1.default.join(currentPath, entry.name), depth + 1);
            }
        }
    }
    await walk(folderPath, 0);
    return {
        name: String(rootFolder.name || '').trim(),
        path: folderPath,
        workCount,
        unreadableCount,
    };
}

async function testNetwork(networkConfig) {
    const metaBaseUrl = String(config_1.config.kikoeruMetaServerUrl || '').replace(/\/$/, '');
    const targets = NETWORK_TEST_TARGETS.map(target => ({
        ...target,
        url: target.key === 'metaServer'
            ? `${metaBaseUrl}/api/static/RJ01469493?locale=${config_1.config.tagLanguage}`
            : target.url,
    }));
    const results = await Promise.all(targets.map(async (target) => {
        const startedAt = Date.now();
        try {
            const response = await httpClient.get(target.url, {
                timeout: 10000,
                maxContentLength: 1024 * 1024,
                validateStatus: status => status < 500,
            }, networkConfig);
            return {
                key: target.key,
                label: target.label,
                ok: true,
                status: response.status,
                durationMs: Date.now() - startedAt,
            };
        }
        catch (error) {
            return {
                key: target.key,
                label: target.label,
                ok: false,
                status: error.response ? error.response.status : null,
                durationMs: Date.now() - startedAt,
                error: error.message || String(error),
            };
        }
    }));
    return {
        mode: networkConfig.httpProxyMode,
        environment: httpClient.getEnvironmentProxyStatus(),
        results,
    };
}
const filterConfig = (_config, option = 'read') => {
    const currentConfig = config_1.config;
    const configClone = lodash_1.default.cloneDeep(_config);
    delete configClone.md5secret;
    delete configClone.jwtsecret;
    if (option === 'write') {
        delete configClone.production;
        if (process.env.NODE_ENV === 'production' || currentConfig.production) {
            delete configClone.auth;
        }
    }
    return configClone;
};
async function renameTagsToLanguage(tagLanguage) {
    const tags = await (0, db_1.knex)('t_tag').select('id', 'name');
    let updated = 0;
    for (const tag of tags) {
        const newName = (0, dlsite_tag_map_1.resolveTagName)(tag.id, tagLanguage);
        if (newName && newName !== tag.name) {
            await (0, db_1.knex)('t_tag').where({ id: tag.id }).update({ name: newName });
            updated += 1;
        }
    }
    return updated;
}
router.use('/admin', accessControl_1.requireAdministrator);
router.get('/admin/setup-status', (_req, res) => {
    res.send({
        completed: isSetupComplete(),
        setupVersion: Number(config_1.config.setupVersion || 0),
    });
});
router.post('/admin/validate-root-folder', async (req, res) => {
    try {
        const rootFolder = req.body && req.body.rootFolder || {};
        if (!String(rootFolder.name || '').trim()) {
            res.status(400).send({ error: '请填写媒体目录名称' });
            return;
        }
        const result = await inspectRootFolder(rootFolder, Number(config_1.config.scannerMaxRecursionDepth) || 2);
        res.send({ rootFolder: result });
    }
    catch (error) {
        res.status(400).send({ error: `媒体目录检查失败：${error.message || error}` });
    }
});
router.post('/admin/network-test', async (req, res) => {
    try {
        const networkConfig = normalizeNetworkConfig(req.body && req.body.config || config_1.config);
        res.send(await testNetwork(networkConfig));
    }
    catch (error) {
        res.status(400).send({ error: error.message || String(error) });
    }
});
router.post('/admin/complete-setup', async (req, res) => {
    try {
        const input = req.body && req.body.config || {};
        const rootFolders = Array.isArray(input.rootFolders) ? input.rootFolders : [];
        if (rootFolders.length === 0) {
            res.status(400).send({ error: '请至少添加一个媒体目录' });
            return;
        }
        const names = new Set();
        const checkedFolders = [];
        for (const rootFolder of rootFolders) {
            const checked = await inspectRootFolder(rootFolder, Number(config_1.config.scannerMaxRecursionDepth) || 2);
            if (!checked.name || names.has(checked.name)) {
                res.status(400).send({ error: '媒体目录名称不能为空或重复' });
                return;
            }
            names.add(checked.name);
            checkedFolders.push({ name: checked.name, path: checked.path });
        }
        const networkConfig = normalizeNetworkConfig(input);
        const transcodeOption = ['off', 'aac 128', 'aac 320'].includes(input.transcodeOption)
            ? input.transcodeOption
            : 'off';
        (0, config_1.setNewConfigValue)({
            rootFolders: checkedFolders,
            ...networkConfig,
            transcodeOption,
            setupVersion: SETUP_VERSION,
        });
        res.send({ message: '初始化设置已保存', completed: true });
    }
    catch (error) {
        res.status(400).send({ error: `保存初始化设置失败：${error.message || error}` });
    }
});
router.put('/admin', async (req, res, next) => {
    if (!config_1.config.auth || req.user.name === 'admin') {
        try {
            const newConfigValues = filterConfig(req.body.config, 'write');
            if ('httpProxyMode' in newConfigValues || 'httpProxyPort' in newConfigValues) {
                Object.assign(newConfigValues, normalizeNetworkConfig(newConfigValues));
            }
            const oldTagLanguage = config_1.config.tagLanguage;
            const newTagLanguage = newConfigValues.tagLanguage;
            (0, config_1.setNewConfigValue)(newConfigValues);
            if (newTagLanguage && newTagLanguage !== oldTagLanguage) {
                const updated = await renameTagsToLanguage(newTagLanguage);
                res.send({ message: `保存成功，已根据 tagLanguage=${newTagLanguage} 更新 ${updated} 个标签名称.` });
            }
            else {
                res.send({ message: '保存成功.' });
            }
        }
        catch (err) {
            next(err);
        }
    }
    else {
        res.status(403).send({ error: '只有 admin 账号能修改配置文件.' });
    }
});
router.post('/admin/refresh-tags', async (req, res, next) => {
    if (!config_1.config.auth || req.user.name === 'admin') {
        try {
            const updated = await renameTagsToLanguage(config_1.config.tagLanguage);
            res.send({ message: `已根据 tagLanguage=${config_1.config.tagLanguage} 刷新 ${updated} 个标签名称.` });
        }
        catch (err) {
            next(err);
        }
    }
    else {
        res.status(403).send({ error: '只有 admin 账号能修改配置文件.' });
    }
});
router.get('/admin', (req, res, next) => {
    if (!config_1.config.auth || req.user.name === 'admin') {
        try {
            res.send({ config: filterConfig(config_1.config, 'read') });
        }
        catch (err) {
            next(err);
        }
    }
    else {
        res.status(403).send({ error: '只有 admin 账号能读取管理配置文件.' });
    }
});
router.get('/shared', (req, res, next) => {
    try {
        res.send({ sharedConfig: (0, config_1.getSharedConfig)() });
    }
    catch (err) {
        next(err);
    }
});
module.exports = router;
