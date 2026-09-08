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
const express_validator_1 = require("express-validator");
const config_1 = require("../config");
const db = __importStar(require("../database/db"));
const normalize_1 = __importDefault(require("./utils/normalize"));
const validate_1 = require("./utils/validate");
const accessControl_1 = require("../auth/accessControl");
const PAGE_SIZE = config_1.config.pageSize || 12;
const { prepareWorks } = require('./utils/workVisibility');
router.get('/', (0, express_validator_1.query)('page').optional({ nullable: true }).isInt(), (0, express_validator_1.query)('sort').optional({ nullable: true }).isIn(['desc', 'asc']), (0, express_validator_1.query)('seed').optional({ nullable: true }).isInt(), (0, express_validator_1.query)('filter').optional({ nullable: true }).isIn(['marked', 'listening', 'listened', 'replay', 'postponed']), async (req, res) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const currentPage = parseInt(req.query.page) || 1;
    const order = req.query.order || 'release';
    const sort = req.query.sort || 'desc';
    const offset = (currentPage - 1) * PAGE_SIZE;
    const username = (0, accessControl_1.getRequestUsername)(req, config_1.config);
    const filter = req.query.filter;
    try {
        const { works, totalCount } = await db.getWorksWithReviews({ username: username, limit: PAGE_SIZE, offset: offset, orderBy: order, sortOption: sort, filter, nsfw: req.query.nsfw === '1' ? 1 : 0 });
        (0, normalize_1.default)(works, { dateOnly: true });
        await prepareWorks(works, req.query.nsfw === '1');
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
        res.status(500).send({ error: '查询过程中出错' });
        console.error(err);
    }
});
router.put('/', accessControl_1.requireAuthenticatedWrite, (0, express_validator_1.body)('work_id').isInt(), (0, express_validator_1.body)('rating').optional({ nullable: true }).isInt(), (0, express_validator_1.body)('progress').optional({ nullable: true }).isIn(['marked', 'listening', 'listened', 'replay', 'postponed']), (0, express_validator_1.body)('starOnly').optional({ nullable: true }).isBoolean(), (0, express_validator_1.body)('progressOnly').optional({ nullable: true }).isBoolean(), (req, res) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const username = (0, accessControl_1.getRequestUsername)(req, config_1.config);
    let starOnly = true;
    let progressOnly = false;
    if (req.query.starOnly === 'false') {
        starOnly = false;
    }
    if (req.query.progressOnly === 'true') {
        progressOnly = true;
    }
    db.updateUserReview(username, req.body.work_id, req.body.rating, req.body.review_text, req.body.progress, starOnly, progressOnly)
        .then(() => {
        if (progressOnly) {
            res.send({ message: '更新进度成功' });
        }
        else {
            res.send({ message: '评价成功' });
        }
    }).catch((err) => {
        res.status(500).send({ error: '评价失败，服务器错误' });
        console.error(err);
    });
});
router.delete('/', accessControl_1.requireAuthenticatedWrite, (0, express_validator_1.query)('work_id').isInt(), (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const username = (0, accessControl_1.getRequestUsername)(req, config_1.config);
    db.deleteUserReview(username, Number(req.query.work_id))
        .then(() => {
        res.send({ message: '删除标记成功' });
    }).catch((err) => next(err));
});
exports.default = router;
