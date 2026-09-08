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
const utils_1 = require("../auth/utils");
const config_1 = require("../config");
const db = __importStar(require("../database/db"));
const accessControl_1 = require("../auth/accessControl");
router.post('/user', accessControl_1.requireAdministrator, [
    (0, express_validator_1.check)('name', (_value, { path }) => t('validation.invalidValue', { field: path }))
        .isLength({ min: 5 })
        .withMessage(() => t('credentials.usernameLength')),
    (0, express_validator_1.check)('password', (_value, { path }) => t('validation.invalidValue', { field: path }))
        .isLength({ min: 5 })
        .withMessage(() => t('credentials.passwordLength')),
    (0, express_validator_1.check)('group', (_value, { path }) => t('validation.invalidValue', { field: path }))
        .custom(value => {
        if (value !== 'user' && value !== 'guest') {
            throw new Error(t('credentials.groupInvalid'));
        }
        return true;
    })
], (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(422).send({ errors: errors.array() });
    }
    const user = {
        name: req.body.name,
        password: req.body.password,
        group: req.body.group
    };
    if (!config_1.config.auth || req.user.name === 'admin') {
        db.createUser({
            name: user.name,
            password: (0, utils_1.md5)(user.password),
            group: user.group
        })
            .then(() => res.send({ message: t('credentials.userCreated', { name: user.name }) }))
            .catch((err) => {
            if (err.code === 'USER_EXISTS') {
                res.status(403).send({ error: err.message });
            }
            else {
                next(err);
            }
        });
    }
    else {
        res.status(403).send({ error: t('credentials.adminCreateRequired') });
    }
});
router.put('/user', accessControl_1.requireAuthenticatedWrite, [
    (0, express_validator_1.check)('name', (_value, { path }) => t('validation.invalidValue', { field: path }))
        .isLength({ min: 5 })
        .withMessage(() => t('credentials.usernameLength')),
    (0, express_validator_1.check)('newPassword', (_value, { path }) => t('validation.invalidValue', { field: path }))
        .isLength({ min: 5 })
        .withMessage(() => t('credentials.passwordLength'))
], (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    const user = {
        name: req.body.name
    };
    const newPassword = (0, utils_1.md5)(req.body.newPassword);
    if (!config_1.config.auth || req.user.name === 'admin' || req.user.name === user.name) {
        db.updateUserPassword(user, newPassword)
            .then(() => res.send({ message: t('credentials.passwordChanged') }))
            .catch((err) => {
            if (err.message.indexOf(t('credentials.usernameInvalid')) !== -1) {
                res.status(403).send({ error: t('credentials.usernameInvalid') });
            }
            else {
                next(err);
            }
        });
    }
    else {
        res.status(403).send({ error: t('credentials.ownPasswordOnly') });
    }
});
router.delete('/user', accessControl_1.requireAdministrator, (req, res, next) => {
    const users = req.body.users;
    if (!config_1.config.auth || req.user.name === 'admin') {
        if (!users.find((user) => user.name === 'admin')) {
            db.deleteUser(users)
                .then(() => {
                res.send({ message: t('credentials.deleted') });
            })
                .catch((err) => {
                next(err);
            });
        }
        else {
            res.status(403).send({ error: t('credentials.adminCannotDelete') });
        }
    }
    else {
        res.status(403).send({ error: t('credentials.adminDeleteRequired') });
    }
});
router.get('/users', accessControl_1.requireAdministrator, (req, res, next) => {
    if (!config_1.config.auth || req.user.name === 'admin') {
        db.knex('t_user')
            .select('name', 'group')
            .then((users) => {
            res.send({ users });
        })
            .catch((err) => {
            next(err);
        });
    }
    else {
        res.status(403).send({ error: t('credentials.adminReadRequired') });
    }
});
exports.default = router;
