"use strict";
const { t } = require('../i18n');

Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdministratorRequest = isAdministratorRequest;
exports.isAuthenticatedWriteRequest = isAuthenticatedWriteRequest;
exports.getRequestUsername = getRequestUsername;
exports.requireAdministrator = requireAdministrator;
exports.requireAuthenticatedWrite = requireAuthenticatedWrite;

function isAdministratorRequest(req, config) {
    if (!config.auth) {
        return config.allowUnauthenticatedWriteOperations === true;
    }
    const user = req && req.user;
    return Boolean(user && (user.name === "admin" || user.group === "administrator"));
}

function requireAdministrator(req, res, next) {
    const { config } = require("../config");
    if (isAdministratorRequest(req, config)) {
        next();
        return;
    }
    res.status(403).send({
        error: config.auth
            ? t('accessControl.adminRequired')
            : t('accessControl.writeDisabled'),
    });
}

function requireAuthenticatedWrite(req, res, next) {
    const { config } = require("../config");
    if (isAuthenticatedWriteRequest(req, config)) {
        next();
        return;
    }
    res.status(403).send({ error: t('accessControl.loginRequired') });
}

function isAuthenticatedWriteRequest(req, config) {
    return Boolean((config.auth && req && req.user) || (!config.auth && config.allowUnauthenticatedWriteOperations === true));
}

function getRequestUsername(req, config) {
    if (!config.auth) {
        return 'admin';
    }
    const user = req && req.user;
    return user && typeof user.name === 'string' ? user.name : null;
}
