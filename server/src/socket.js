"use strict";
const { i18n } = require('./i18n');
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
const config_1 = require("./config");
const accessControl_1 = require("./auth/accessControl");
const token_1 = require("./auth/token");
const utils_1 = require("./auth/utils");
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const scanJobs = require('./filesystem/scanJobRunner');
const { jobStatus } = require('./database/scanJobs');
const { knex } = require('./database/db');
const socketServers = new Set();
function broadcast(event, payload) {
    for (const io of socketServers) io.emit(event, payload);
}
scanJobs.events.on('message', message => broadcast(message.event, message.payload));
function startScan(kind) { scanJobs.startJob(kind).catch(error => { console.error('[Scanner]', error.message); broadcast('SCAN_ERROR'); }); }
function socketMessage(socket, key) {
    const locale = typeof socket.handshake.query.locale === 'string' ? socket.handshake.query.locale : 'zh-CN';
    return i18n.getFixedT(i18n.hasResourceBundle(locale, 'translation') ? locale : 'zh-CN')(key);
}
function initSocket(server) {
    const io = new socket_io_1.Server(server);
    socketServers.add(io);
    server.once('close', () => socketServers.delete(io));
    if (config_1.config.auth) {
        io.use((socket, next) => {
            const token = (0, token_1.getToken)(socket.request);
            if (!token) {
                next(new Error(socketMessage(socket, 'socket.loginRequired')));
                return;
            }
            jsonwebtoken_1.default.verify(token, config_1.config.jwtsecret, {
                audience: utils_1.audience,
                issuer: utils_1.issuer,
                algorithms: ['HS256'],
            }, (err, payload) => {
                if (err || !payload) {
                    next(new Error(socketMessage(socket, 'socket.loginExpired')));
                    return;
                }
                socket.request.user = {
                    name: payload.name,
                    group: payload.group,
                };
                next();
            });
        });
    }
    io.use((socket, next) => {
        if ((0, accessControl_1.isAdministratorRequest)(socket.request, config_1.config)) {
            next();
            return;
        }
        next(new Error(socketMessage(socket, 'socket.adminRequired')));
    });
    io.on('connection', function (socket) {
        socket.emit('success', {
            message: socketMessage(socket, 'socket.connected'),
            user: socket.request.user,
            auth: config_1.config.auth,
            canManage: true,
        });
        socket.on('ON_SCANNER_PAGE', () => {
            scanJobs.sendState();
            jobStatus(knex).then(job => socket.emit('SCAN_JOB', job)).catch(error => console.error(error));
        });
        socket.on('PERFORM_SCAN', () => {
            startScan('scan');
        });
        socket.on('PERFORM_UPDATE', () => {
            startScan('metadata');
        });
        socket.on('PERFORM_LYRIC_SCAN', () => {
            startScan('files');
        });
        socket.on('PERFORM_RETRY_FAILED', () => {
            startScan('retry');
        });
        socket.on('KILL_SCAN_PROCESS', () => {
            jobStatus(knex).then(job => job && scanJobs.cancelJob(job.id)).catch(error => console.error(error));
        });
        socket.on('error', (err) => {
            console.error(err);
        });
    });
}
