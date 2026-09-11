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
const path_1 = __importDefault(require("path"));
const socket_io_1 = __importDefault(require("socket.io"));
const child_process_1 = __importDefault(require("child_process"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const { scanCoordinator } = require('./filesystem/scanCoordinator');
let scanner = null;
let scanRequest = null;
const socketServers = new Set();
function broadcast(event, payload) {
    for (const io of socketServers) io.emit(event, payload);
}
function startScan(filename) {
    if (scanRequest) return;
    scanRequest = new AbortController();
    scanCoordinator.run(() => new Promise((resolve, reject) => {
        const child = child_process_1.default.fork(path_1.default.join(__dirname, 'filesystem', filename),
            filename === 'updater.js' ? ['--refreshAll'] : [], { silent: false });
        scanner = child;
        child.on('message', message => { if (message.event) broadcast(message.event, message.payload); });
        child.once('error', error => {
            if (child.pid && child.exitCode === null) child.kill();
            else { if (scanner === child) scanner = null; reject(error); }
        });
        child.once('exit', (code, signal) => {
            if (scanner === child) scanner = null;
            if (code || signal) reject(new Error(`Scanner exited: ${code ?? signal}`));
            else resolve();
        });
    }), scanRequest.signal).catch(error => {
        console.error('[Scanner]', error.message);
        broadcast('SCAN_ERROR');
    }).finally(() => { scanRequest = null; });
}
function socketMessage(socket, key) {
    const locale = typeof socket.handshake.query.locale === 'string' ? socket.handshake.query.locale : 'zh-CN';
    return i18n.getFixedT(i18n.hasResourceBundle(locale, 'translation') ? locale : 'zh-CN')(key);
}
function initSocket(server) {
    const io = (0, socket_io_1.default)(server);
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
            if (scanner?.connected) {
                scanner.send({
                    emit: 'SCAN_INIT_STATE'
                }, error => { if (error) scanner?.kill(); });
            }
        });
        socket.on('PERFORM_SCAN', () => {
            startScan('scanner.js');
        });
        socket.on('PERFORM_UPDATE', () => {
            startScan('updater.js');
        });
        socket.on('PERFORM_LYRIC_SCAN', () => {
            startScan('workFileScanner.js');
        });
        socket.on('PERFORM_RETRY_FAILED', () => {
            startScan('retryFailed.js');
        });
        socket.on('KILL_SCAN_PROCESS', () => {
            if (scanner?.connected) scanner.send({ exit: 1 }, error => { if (error) scanner?.kill(); });
            else scanRequest?.abort();
        });
        socket.on('error', (err) => {
            console.error(err);
        });
    });
}
