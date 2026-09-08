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
const express_validator_1 = require("express-validator");
const express_jwt_1 = __importDefault(require("express-jwt"));
const utils_1 = require("../auth/utils");
const db = __importStar(require("../database/db"));
const config_1 = require("../config");
const accessControl_1 = require("../auth/accessControl");
const token_1 = require("../auth/token");
const router = express_1.default.Router();
router.post('/me', [
    (0, express_validator_1.check)('name', (_value, { path }) => t('validation.invalidValue', { field: path }))
        .isLength({ min: 5 })
        .withMessage(() => t('auth.usernameLength')),
    (0, express_validator_1.check)('password', (_value, { path }) => t('validation.invalidValue', { field: path }))
        .isLength({ min: 5 })
        .withMessage(() => t('auth.passwordLength'))
], (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(422).send({ errors: errors.array() });
    }
    const name = req.body.name;
    const password = req.body.password;
    db.knex('t_user')
        .where('name', '=', name)
        .andWhere('password', '=', (0, utils_1.md5)(password))
        .first()
        .then((user) => {
        if (!user) {
            res.set("WWW-Authenticate", "Bearer realm=\"Authorization Required\"");
            res.status(401).send({ error: t('auth.invalidCredentials') });
        }
        else {
            const token = (0, utils_1.signToken)(user);
            (0, token_1.setAuthCookie)(res, token, config_1.config);
            res.send({ token });
        }
    })
        .catch((err) => {
        console.error(err);
        res.status(500).send({ error: t('auth.serverError') });
    });
});
router.post('/logout', (_req, res) => {
    (0, token_1.clearAuthCookie)(res, config_1.config);
    res.status(204).end();
});
if (config_1.config.auth) {
    router.get('/me', (0, express_jwt_1.default)({
        secret: config_1.config.jwtsecret,
        audience: utils_1.audience,
        issuer: utils_1.issuer,
        getToken: token_1.getToken,
        algorithms: ['HS256'],
        credentialsRequired: false,
    }));
}
router.get('/me', (req, res) => {
    const auth = config_1.config.auth;
    let user = null;
    if (config_1.config.auth && req.user) {
        user = { name: req.user.name, group: req.user.group };
        (0, token_1.setAuthCookie)(res, (0, token_1.getToken)(req), config_1.config);
    }
    else if (!config_1.config.auth) {
        user = { name: 'admin', group: 'administrator' };
    }
    res.send({
        user,
        auth,
        canManage: (0, accessControl_1.isAdministratorRequest)(req, config_1.config),
    });
});
exports.default = router;
