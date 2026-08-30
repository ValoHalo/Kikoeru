"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const auth_1 = __importDefault(require("./auth"));
const credentials_1 = __importDefault(require("./credentials"));
const version_1 = __importDefault(require("./version"));
const config_1 = __importDefault(require("./config"));
const media_1 = __importDefault(require("./media"));
const review_1 = __importDefault(require("./review"));
const play_histroy_1 = __importDefault(require("./play_histroy"));
const playlist_1 = __importDefault(require("./playlist"));
const edit_1 = __importDefault(require("./edit"));
const metadata_1 = __importDefault(require("./metadata"));
router.get('/health', (req, res) => {
    res.send('OK');
});
router.get('/me', (req, res) => {
    res.redirect('/api/auth/me');
});
router.use('/auth', auth_1.default);
router.use('/credentials', credentials_1.default);
router.use('/version', version_1.default);
router.use('/config', config_1.default);
router.use('/media', media_1.default);
router.use('/review', review_1.default);
router.use('/histroy', play_histroy_1.default);
router.use('/playlists', playlist_1.default);
router.use('/edit', edit_1.default);
router.use('/', metadata_1.default);
exports.default = router;
