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
const express_validator_1 = require("express-validator");
const config_1 = require("../config");
const db = __importStar(require("../database/db"));
const normalize_1 = __importDefault(require("./utils/normalize"));
const validate_1 = require("./utils/validate");
const accessControl_1 = require("../auth/accessControl");
const PAGE_SIZE = config_1.config.pageSize || 12;
const { prepareWorks } = require('./utils/workVisibility');
router.get('/', (0, express_validator_1.query)('page', (_value, { path }) => t('validation.invalidValue', { field: path })).optional({ nullable: true }).isInt(), (0, express_validator_1.query)('sort', (_value, { path }) => t('validation.invalidValue', { field: path })).optional({ nullable: true }).isIn(['desc', 'asc']), async (req, res) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const currentPage = parseInt(req.query.page) || 1;
    const sort = req.query.sort || 'desc';
    const offset = (currentPage - 1) * PAGE_SIZE;
    const username = (0, accessControl_1.getRequestUsername)(req, config_1.config);
    try {
        const { works, totalCount } = await db.getPlayHistroy({
            username: username,
            limit: PAGE_SIZE,
            offset: offset,
            sortOption: sort,
            nsfw: req.query.nsfw === '1' ? 1 : 0,
        });
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
        res.status(500).send({ error: t('play_histroy.queryFailed') });
        console.error(err);
    }
});
router.put('/', accessControl_1.requireAuthenticatedWrite, (0, express_validator_1.body)('work_id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), (0, express_validator_1.body)('state', (_value, { path }) => t('validation.invalidValue', { field: path })).isObject(), (req, res) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const username = (0, accessControl_1.getRequestUsername)(req, config_1.config);
    db.updatePlayHistroy(username, Number(req.body.work_id), JSON.stringify(req.body.state))
        .then(() => {
        res.send({ message: t('play_histroy.saved') });
    }).catch((err) => {
        res.status(500).send({ error: t('play_histroy.saveFailed') });
        console.error(err);
    });
});
router.delete('/', accessControl_1.requireAuthenticatedWrite, (0, express_validator_1.body)('work_id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), async (req, res, next) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const username = (0, accessControl_1.getRequestUsername)(req, config_1.config);
    try {
        await db.deletePlayHistroy(username, req.body.work_id);
        res.send({ message: t('play_histroy.deleted') });
    }
    catch (err) {
        console.error(err);
        next(err);
    }
});
exports.default = router;
