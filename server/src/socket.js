"use strict";
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
const runtimeState = require("./runtimeState");
function initSocket(server) {
    const io = (0, socket_io_1.default)(server);
    if (config_1.config.auth) {
        io.use((socket, next) => {
            const token = (0, token_1.getToken)(socket.request);
            if (!token) {
                next(new Error('管理后台需要登录.'));
                return;
            }
            jsonwebtoken_1.default.verify(token, config_1.config.jwtsecret, {
                audience: utils_1.audience,
                issuer: utils_1.issuer,
                algorithms: ['HS256'],
            }, (err, payload) => {
                if (err || !payload) {
                    next(new Error('管理后台登录已失效.'));
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
        next(new Error('管理后台需要管理员权限.'));
    });
    let scanner = null;
    io.on('connection', function (socket) {
        socket.emit('success', {
            message: '成功登录管理后台.',
            user: socket.request.user,
            auth: config_1.config.auth,
            canManage: true,
        });
        socket.on('ON_SCANNER_PAGE', () => {
            if (scanner) {
                scanner.send({
                    emit: 'SCAN_INIT_STATE'
                });
            }
        });
        socket.on('PERFORM_SCAN', () => {
            if (!scanner) {
                scanner = child_process_1.default.fork(path_1.default.join(__dirname, './filesystem/scanner.js'), { silent: false });
                runtimeState.scannerActive = true;
                scanner.on('exit', (code) => {
                    scanner = null;
                    runtimeState.scannerActive = false;
                    if (code) {
                        io.emit('SCAN_ERROR');
                    }
                });
                scanner.on('message', (m) => {
                    if (m.event) {
                        io.emit(m.event, m.payload);
                    }
                });
            }
        });
        socket.on('PERFORM_UPDATE', () => {
            if (!scanner) {
                scanner = child_process_1.default.fork(path_1.default.join(__dirname, './filesystem/updater.js'), ['--refreshAll'], { silent: false });
                runtimeState.scannerActive = true;
                scanner.on('exit', (code) => {
                    scanner = null;
                    runtimeState.scannerActive = false;
                    if (code) {
                        io.emit('SCAN_ERROR');
                    }
                });
                scanner.on('message', (m) => {
                    if (m.event) {
                        io.emit(m.event, m.payload);
                    }
                });
            }
        });
        socket.on('PERFORM_LYRIC_SCAN', () => {
            if (!scanner) {
                scanner = child_process_1.default.fork(path_1.default.join(__dirname, './filesystem/workFileScanner.js'), { silent: false });
                runtimeState.scannerActive = true;
                scanner.on('exit', (code) => {
                    scanner = null;
                    runtimeState.scannerActive = false;
                    if (code) {
                        io.emit('SCAN_ERROR');
                    }
                });
                scanner.on('message', (m) => {
                    if (m.event) {
                        io.emit(m.event, m.payload);
                    }
                });
            }
        });
        socket.on('PERFORM_RETRY_FAILED', () => {
            if (!scanner) {
                scanner = child_process_1.default.fork(path_1.default.join(__dirname, './filesystem/retryFailed.js'), { silent: false });
                runtimeState.scannerActive = true;
                scanner.on('exit', (code) => {
                    scanner = null;
                    runtimeState.scannerActive = false;
                    if (code) {
                        io.emit('SCAN_ERROR');
                    }
                });
                scanner.on('message', (m) => {
                    if (m.event) {
                        io.emit(m.event, m.payload);
                    }
                });
            }
        });
        socket.on('KILL_SCAN_PROCESS', () => {
            scanner.send({
                exit: 1
            });
        });
        socket.on('error', (err) => {
            console.error(err);
        });
    });
}
