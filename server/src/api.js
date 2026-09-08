"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const routes_1 = __importDefault(require("./routes"));
const express_jwt_1 = __importDefault(require("express-jwt"));
const config_1 = require("./config");
const utils_1 = require("./auth/utils");
const token_1 = require("./auth/token");
function configApiToApp(app) {
    app.use('/api', require('./i18n').localizeRequest);
    if (config_1.config.auth) {
        app.use('/api', (0, express_jwt_1.default)({
            secret: config_1.config.jwtsecret,
            audience: utils_1.audience,
            issuer: utils_1.issuer,
            getToken: token_1.getToken,
            algorithms: ['HS256'],
            credentialsRequired: false,
        }).unless({ path: ['/api/auth/me', '/api/auth/logout', '/api/health'] }));
    }
    app.use('/api', routes_1.default);
}
;
exports.default = configApiToApp;
