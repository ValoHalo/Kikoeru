"use strict";
const { t } = require('../i18n');
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const validate_1 = require("./utils/validate");
const db_1 = require("../database/db");
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const utils_1 = require("../filesystem/utils");
const accessControl_1 = require("../auth/accessControl");
const router = express_1.default.Router();
router.use(accessControl_1.requireAdministrator);
const upload = (0, multer_1.default)({ dest: os_1.default.tmpdir() });
router.post('/work/:id', (0, express_validator_1.param)('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), async function (req, res) {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = parseInt(req.params.id);
    console.log("edit meta body: ", req.body);
    try {
        await (0, db_1.customWorkMetadata)(work_id, req.body);
        res.send({ success: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).send({ error: t('edit.metadataFailed', { message: err.message }) });
    }
});
router.post('/img/:id', (0, express_validator_1.param)('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), upload.single('file'), async (req, res) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = req.params.id;
    const imgFile = req.file;
    const coverType = req.body.type;
    if (imgFile.mimetype != "image/jpeg") {
        res.status(500).send({ success: false, message: t('edit.jpegRequired') });
        return;
    }
    const type = coverType || 'main';
    const origin_cover_path = (0, utils_1.getCoverPath)(work_id, type, false);
    const using_cover_path = (0, utils_1.getCoverPath)(work_id, type, true);
    if (!fs_1.default.existsSync(origin_cover_path) && fs_1.default.existsSync(using_cover_path)) {
        fs_1.default.copyFileSync(using_cover_path, origin_cover_path);
    }
    fs_1.default.copyFileSync(imgFile.path, using_cover_path);
    console.log("work edit img: ", work_id, coverType, imgFile);
    res.send({ success: true });
});
router.post('/recover/img/:id', (0, express_validator_1.param)('id', (_value, { path }) => t('validation.invalidValue', { field: path })).isInt(), upload.single('file'), async (req, res) => {
    if (!(0, validate_1.isValidRequest)(req, res))
        return;
    const work_id = req.params.id;
    const coverType = req.body.type;
    const type = coverType || 'main';
    const origin_cover_path = (0, utils_1.getCoverPath)(work_id, type, false);
    const using_cover_path = (0, utils_1.getCoverPath)(work_id, type, true);
    if (fs_1.default.existsSync(origin_cover_path)) {
        fs_1.default.copyFileSync(origin_cover_path, using_cover_path);
        fs_1.default.unlinkSync(origin_cover_path);
        res.send({ success: true });
    }
    else {
        res.send({ success: false, message: t('edit.coverMissing') });
    }
});
exports.default = router;
