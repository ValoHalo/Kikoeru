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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const express_validator_1 = require("express-validator");
const db = __importStar(require("../database/db"));
const config_1 = require("../config");
const normalize_1 = __importDefault(require("./utils/normalize"));
const validate_1 = require("./utils/validate");
const utils_1 = require("../filesystem/utils");
const idConverter_1 = require("../filesystem/idConverter");
const accessControl_1 = require("../auth/accessControl");
const PAGE_SIZE = config_1.config.pageSize || 12;
router.get(['/works', '/search', '/:field(circle|tag|va)s/:id/works'],
    (0, express_validator_1.query)('collectionId').optional().isInt({ min: 1 }),
    (req, res, next) => {
        if ((0, validate_1.isValidRequest)(req, res)) next();
    });
router.get('/cover/:id', (0, express_validator_1.param)('id').isInt(), (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = parseInt(req.params.id || "0");
    const type = req.query.type || 'main';
    const coverPath = (0, utils_1.getCoverPath)(work_id, type);
    res.sendFile(coverPath, (err) => {
        if (err) {
            res.sendFile(path_1.default.join(__dirname, '../static/no-image.jpg'), (err2) => {
                if (err2) {
                    next(err2);
                }
            });
        }
    });
});
router.get('/work/:id', (0, express_validator_1.param)('id').isInt(), (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const username = (0, accessControl_1.getRequestUsername)(req, config_1.config);
    db.getWorkMetadata(Number(req.params.id), username)
        .then(work => {
        (0, normalize_1.default)(work);
        res.send(work[0]);
    })
        .catch(err => next(err));
});
router.get('/workInfo/:code', (0, express_validator_1.param)('code').isString(), (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const code = req.params.code;
    const id = (0, idConverter_1.codeToIdNumber)(code);
    const username = (0, accessControl_1.getRequestUsername)(req, config_1.config);
    db.getWorkMetadata(id, username)
        .then(work => {
        (0, normalize_1.default)(work);
        res.send(work[0]);
    })
        .catch(err => next(err));
});
router.get('/tracks/:id', (0, express_validator_1.param)('id').isInt(), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = req.params.id;
    try {
        const work = await db.knex('t_work')
            .select('title', 'root_folder', 'dir', 'memo')
            .where('id', '=', work_id)
            .first();
        const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (rootFolder) {
            try {
                const tracks = await (0, utils_1.getTrackList)(work_id, path_1.default.join(rootFolder.path, work.dir), (0, utils_1.ensureIsJsonObject)(work.memo));
                const tree = (0, utils_1.toTree)(tracks, work.title, work.dir, rootFolder);
                (0, utils_1.naturalSortTree)(tree);
                const queryBoolean = (value, fallback) => value === undefined
                    ? fallback
                    : value === '1' || value === 'true';
                const pathArr = (0, utils_1.getSmartAudioFolderPath)(tree, {
                    enabled: queryBoolean(req.query.smartPath, config_1.config.smartPathEnabled),
                    preferEffect: queryBoolean(req.query.preferEffect, config_1.config.smartPathPreferEffect),
                    audioTypes: typeof req.query.audioTypes === 'string' ? req.query.audioTypes : config_1.config.smartPathAudioTypes,
                });
                (0, utils_1.assignImportantPathFlag)(tree, pathArr);
                res.send(tree);
            }
            catch (err) {
                console.error(err);
                res.status(500).send({ error: '获取文件列表失败，请检查文件是否存在或重新扫描清理' });
            }
        }
        else {
            res.status(500).send({ error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.` });
        }
    }
    catch (err) {
        next(err);
    }
});
router.get('/works', (0, express_validator_1.query)('page').optional({ nullable: true }).isInt(), (0, express_validator_1.query)('order').optional({ nullable: true }).isIn(["release", "rating", "dl_count", "price", "rate_average_2dp", "review_count", "id", "created_at", "random", "betterRandom"]), (0, express_validator_1.query)('sort').optional({ nullable: true }).isIn(['desc', 'asc']), (0, express_validator_1.query)('nsfw').optional({ nullable: true }).isInt().isIn([0, 1, 2]), (0, express_validator_1.query)('seed').optional({ nullable: true }).isInt(), async (req, res) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const currentPage = parseInt(req.query.page) || 1;
    const order = req.query.order || 'release';
    const sort = req.query.sort || 'desc';
    const nsfw = parseInt(req.query.nsfw || '0');
    const lyric = req.query.lyric || '';
    const offset = (currentPage - 1) * PAGE_SIZE;
    const username = (0, accessControl_1.getRequestUsername)(req, config_1.config);
    const shuffleSeed = req.query.seed ? req.query.seed : 7;
    try {
        const query = db.lyricFilter(lyric, db.nsfwFilter(nsfw, db.getWorksBy(username, undefined, undefined, true)));
        const result = await db.getWorksPage(db.collectionFilter(req.query.collectionId, username, query), { order, sort, seed: shuffleSeed, offset, limit: PAGE_SIZE });
        const works = (0, normalize_1.default)(result.works);
        const totalCount = result.totalCount;
        res.send({
            works,
            pagination: {
                currentPage,
                pageSize: PAGE_SIZE,
                totalCount,
            }
        });
    }
    catch (err) {
        res.status(500).send({ error: '服务器错误' });
        console.error(err);
    }
});
router.get('/:field(circle|tag|va)s/:id', (0, express_validator_1.param)('field').isIn(['circle', 'tag', 'va']), (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    return db.getMetadata({ field: req.params.field, id: req.params.id })
        .then(item => {
        if (item) {
            res.send(item);
        }
        else {
            const errorMessage = {
                'circle': `社团${req.params.id}不存在`,
                'tag': `标签${req.params.id}不存在`,
                'va': `声优${req.params.id}不存在`
            };
            res.status(404).send({ error: errorMessage[req.params.field] });
        }
    })
        .catch(err => next(err));
});
router.get('/search', async (req, res) => {
    const keyword = req.query.keyword ? req.query.keyword.trim() : '';
    const isAdvance = 1 === parseInt(req.query.isAdvance || "0");
    const currentPage = parseInt(req.query.page) || 1;
    const order = req.query.order || 'release';
    const sort = req.query.sort || 'desc';
    const nsfw = parseInt(req.query.nsfw || '0');
    const lyric = req.query.lyric || '';
    const offset = (currentPage - 1) * PAGE_SIZE;
    const username = (0, accessControl_1.getRequestUsername)(req, config_1.config);
    const shuffleSeed = req.query.seed ? req.query.seed : 7;
    try {
        let query = null;
        if (isAdvance) {
            const conditions = JSON.parse(keyword);
            query = db.lyricFilter(lyric, db.nsfwFilter(nsfw, db.advanceSearch(conditions, username, true)));
        }
        else {
            query = db.lyricFilter(lyric, db.nsfwFilter(nsfw, db.getWorksByKeyWord(username, keyword, true)));
        }
        const result = await db.getWorksPage(db.collectionFilter(req.query.collectionId, username, query), { order, sort, seed: shuffleSeed, offset, limit: PAGE_SIZE });
        const works = (0, normalize_1.default)(result.works);
        const totalCount = result.totalCount;
        res.send({
            works,
            pagination: {
                currentPage,
                pageSize: PAGE_SIZE,
                totalCount: totalCount
            }
        });
    }
    catch (err) {
        res.status(500).send({ error: '查询过程中出错' });
        console.error(err);
    }
});
router.get('/:field(circle|tag|va)s/:id/works', (0, express_validator_1.param)('field').isIn(['circle', 'tag', 'va']), async (req, res) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const currentPage = parseInt(req.query.page) || 1;
    const order = req.query.order || 'release';
    const sort = req.query.sort || 'desc';
    const nsfw = parseInt(req.query.nsfw || '0');
    const lyric = req.query.lyric || '';
    const offset = (currentPage - 1) * PAGE_SIZE;
    const username = (0, accessControl_1.getRequestUsername)(req, config_1.config);
    const shuffleSeed = req.query.seed ? req.query.seed : 7;
    try {
        const query = db.lyricFilter(lyric, db.nsfwFilter(nsfw, db.getWorksBy(username, req.params.field, req.params.id, true)));
        const result = await db.getWorksPage(db.collectionFilter(req.query.collectionId, username, query), { order, sort, seed: shuffleSeed, offset, limit: PAGE_SIZE });
        const works = (0, normalize_1.default)(result.works);
        const totalCount = result.totalCount;
        res.send({
            works,
            pagination: {
                currentPage,
                pageSize: PAGE_SIZE,
                totalCount: totalCount
            }
        });
    }
    catch (err) {
        res.status(500).send({ error: '查询过程中出错' });
        console.error(err);
    }
});
router.get('/:field(circle|tag|va)s/', (0, express_validator_1.param)('field').isIn(['circle', 'tag', 'va']), (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const field = req.params.field;
    db.getLabels(field)
        .orderBy(`name`, 'asc')
        .then(list => res.send(list))
        .catch(err => next(err));
});
router.post('/uncensor/tags', accessControl_1.requireAdministrator, async function (req, res) {
    console.log("uncensor tags name");
    await db.uncensorDlsiteTags();
    res.send({ result: "finished" });
});
router.post('/work/scan/:id', accessControl_1.requireAdministrator, (0, express_validator_1.param)('id').isInt(), async function (req, res) {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = parseInt(req.params.id);
    try {
        const work = await db.knex('t_work')
            .select('root_folder', 'dir', 'lyric_status', 'memo')
            .where('id', '=', work_id)
            .first();
        const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (!rootFolder) {
            res.status(500).send({ error: "扫描作品文件失败，没有找到rootFolder: " + work.root_folder });
            return;
        }
        const memo = await (0, utils_1.scrapeWorkMemo)(path_1.default.join(rootFolder.path, work.dir), (0, utils_1.ensureIsJsonObject)(work.memo));
        await db.setWorkMemo(work_id, memo);
        await db.updateWorkLocalLyricStatus(memo.isContainLyric, work.lyric_status, work_id);
        res.send({ memo });
    }
    catch (err) {
        console.error(err);
        res.status(500).send({ error: "刷新作品本地文件失败：" + err.message });
    }
});
router.post('/work/fix/gbk/:id', accessControl_1.requireAdministrator, (0, express_validator_1.param)('id').isInt(), async (req, res) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = req.params.id;
    try {
        const work = await db.knex('t_work')
            .select('title', 'root_folder', 'dir', 'lyric_status', 'memo')
            .where('id', '=', work_id)
            .first();
        const rootFolder = config_1.config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (rootFolder) {
            try {
                const workdir = path_1.default.join(rootFolder.path, work.dir);
                await (0, utils_1.fixGBKShiftJISEncodingBug)(workdir);
                const memo = await (0, utils_1.scrapeWorkMemo)(path_1.default.join(rootFolder.path, work.dir), (0, utils_1.ensureIsJsonObject)(work.memo));
                await db.setWorkMemo(work_id, memo);
                await db.updateWorkLocalLyricStatus(memo.isContainLyric, work.lyric_status, work_id);
                res.send({ memo });
            }
            catch (err) {
                res.status(500).send({ error: '修复乱码文件夹出现错误' + err.message });
            }
        }
        else {
            res.status(500).send({ error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.` });
        }
    }
    catch (err) {
        console.error(err);
        res.status(500).send({ error: "修复乱码问题失败：" + err.message });
    }
});
router.delete('/work/:id', accessControl_1.requireAdministrator, (0, express_validator_1.param)('id').isInt(), async (req, res, _next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = parseInt(req.params.id);
    const deleteFiles = req.query.deleteFiles === 'true';
    try {
        const work = await db.knex('t_work')
            .select('root_folder', 'dir', 'title')
            .where('id', '=', work_id)
            .first();
        if (!work) {
            res.status(404).send({ error: `作品 id=${work_id} 不存在` });
            return;
        }
        const rootFolder = config_1.config.rootFolders.find(rf => rf.name === work.root_folder);
        if (deleteFiles && rootFolder) {
            const workFolderPath = path_1.default.join(rootFolder.path, work.dir);
            if (fs_1.default.existsSync(workFolderPath)) {
                fs_1.default.rmSync(workFolderPath, { recursive: true, force: true });
                console.log(`已删除本地文件: ${workFolderPath}`);
            }
        }
        try {
            (0, utils_1.deleteCoverImageFromDisk)((0, idConverter_1.idNumberToCode)(work_id));
        }
        catch (e) {
            console.warn(`删除封面失败: ${e.message}`);
        }
        await db.knex.transaction(async (trx) => { await db.removeWork(work_id, async () => trx); });
        res.send({ success: true, message: `作品 "${work.title}" 已删除` });
    }
    catch (err) {
        console.error(err);
        res.status(500).send({ error: '删除作品失败：' + err.message });
    }
});
router.get('/work/:id/fileinfo', accessControl_1.requireAdministrator, (0, express_validator_1.param)('id').isInt(), async (req, res, _next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = parseInt(req.params.id);
    try {
        const work = await db.knex('t_work')
            .select('root_folder', 'dir')
            .where('id', '=', work_id)
            .first();
        if (!work) {
            res.status(404).send({ error: `作品 id=${work_id} 不存在` });
            return;
        }
        const rootFolder = config_1.config.rootFolders.find(rf => rf.name === work.root_folder);
        const fullPath = rootFolder ? path_1.default.join(rootFolder.path, work.dir) : null;
        res.send({
            rootFolder: rootFolder ? { name: rootFolder.name, path: rootFolder.path } : null,
            dir: work.dir,
            fullPath,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).send({ error: '获取文件信息失败：' + err.message });
    }
});
exports.default = router;
