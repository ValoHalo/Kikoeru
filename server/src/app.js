#!/usr/bin/env node
"use strict";
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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const body_parser_1 = __importDefault(require("body-parser"));
const connect_history_api_fallback_1 = __importDefault(require("connect-history-api-fallback"));
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const http = __importStar(require("http"));
const config_1 = require("./config");
const listenAddress_1 = require("./utils/listenAddress");
const socket_1 = require("./socket");
const init_1 = require("./database/init");
const api_1 = __importDefault(require("./api"));
const fileWatcher_1 = require("./filesystem/fileWatcher");
const serve_index_1 = __importDefault(require("serve-index"));
function makeApp() {
    const app = (0, express_1.default)();
    if (process.env.NODE_ENV === 'test' || process.env.CRASH_ON_UNHANDLED) {
        process.on('unhandledRejection', (reason, promise) => {
            console.error(new Date().toJSON(), 'Kikoeru log: Unhandled rejection at ', promise, `reason: ${reason}`);
            console.error('Crashing the process because of NODE_ENV or CRASH_ON_UNHANDLED settings');
            process.exit(1);
        });
    }
    if (config_1.config.behindProxy) {
        app.set('trust proxy', 'loopback');
    }
    if (config_1.config.enableGzip) {
        app.use((0, compression_1.default)());
    }
    app.use(body_parser_1.default.urlencoded({ extended: true }));
    app.use(body_parser_1.default.json({ limit: "5mb" }));
    if (process.env.NODE_ENV === 'development' && process.env.KIKOERU_ENABLE_DEV_MEDIA_BROWSE === '1') {
        app.use('/media/stream/VoiceWork', express_1.default.static(config_1.config.voiceWorkDefaultPath), (0, serve_index_1.default)(config_1.config.voiceWorkDefaultPath, { 'icons': true }));
        app.use('/media/download/VoiceWork', express_1.default.static(config_1.config.voiceWorkDefaultPath), (0, serve_index_1.default)(config_1.config.voiceWorkDefaultPath, { 'icons': true }));
    }
    app.use((0, connect_history_api_fallback_1.default)({
        rewrites: [
            {
                from: /^\/api\/.*$/,
                to: (context) => context.parsedUrl.path
            }
        ]
    }));
    app.use(express_1.default.static(path_1.default.join(__dirname, './public')));
    (0, api_1.default)(app);
    app.use((err, req, res, _next) => {
        if (err.name === 'UnauthorizedError') {
            res.set("WWW-Authenticate", "Bearer realm=\"Authorization Required\"");
            res.status(401).send({ error: err.message });
        }
        else if (err.code === 'SQLITE_ERROR') {
            if (err.message.indexOf('no such table') !== -1) {
                res.status(500).send({ error: '数据库结构尚未建立，请先执行扫描.' });
            }
            else {
                res.status(500).send({ error: '数据库错误.' });
            }
        }
        else {
            console.error(new Date().toJSON(), 'Kikoeru log:', err);
            if (process.env.NODE_ENV === 'production' || config_1.config.production) {
                res.status(500).send({ error: '服务器错误' });
            }
            else {
                res.status(500).send({ error: err.message || err });
            }
        }
    });
    return app;
}
function runServer(app) {
    const server = http.createServer(app);
    let httpsServer = null;
    let httpsSuccess = false;
    if (config_1.config.httpsEnabled) {
        try {
            httpsServer = https_1.default.createServer({
                key: fs_1.default.readFileSync(config_1.config.httpsPrivateKey),
                cert: fs_1.default.readFileSync(config_1.config.httpsCert),
            }, app);
            httpsSuccess = true;
        }
        catch (err) {
            console.error('HTTPS服务器启动失败，请检查证书位置以及是否文件可读');
            console.error(err);
        }
    }
    (0, socket_1.initSocket)(server);
    if (config_1.config.httpsEnabled && httpsSuccess && httpsServer) {
        (0, socket_1.initSocket)(httpsServer);
    }
    const listenPort = parseInt(process.env.PORT) || config_1.config.listenPort || 6789;
    const localOnly = config_1.config.blockRemoteConnection;
    const listenWithRetry = (port = listenPort) => {
        const onError = (err) => {
            if (err.code === 'EADDRINUSE' && port < 65535) {
                console.log(`端口 ${port} 被占用，尝试端口 ${port + 1}...`);
                listenWithRetry(port + 1);
            }
            else {
                throw err;
            }
        };
        server.once('error', onError);
        server.once('listening', () => server.removeListener('error', onError));
        server.listen(port, (0, listenAddress_1.getHttpListenAddress)(localOnly, config_1.config.enableIPV6));
    };
    listenWithRetry();
    if (config_1.config.httpsEnabled && httpsSuccess) {
        if (localOnly) {
            httpsServer.listen(config_1.config.httpsPort, listenAddress_1.LOCAL_LISTEN_ADDRESS);
        }
        else {
            httpsServer.listen(config_1.config.httpsPort);
        }
    }
    server.on('listening', () => {
        console.log('Express server started on port %s at %s', server.address().port, server.address().address);
        console.log('Kikoeru: http://127.0.0.1:%s/', server.address().port);
        if (config_1.config.enableFileWatcher) {
            (0, fileWatcher_1.startWatcher)();
        }
        else {
            console.log('[FileWatcher] 文件监听功能已禁用，如需启用请在设置中开启 enableFileWatcher');
        }
    });
    if (config_1.config.httpsEnabled && httpsSuccess) {
        httpsServer.on('listening', () => {
            const addr = httpsServer.address();
            console.log('Express server started on port %s at %s', addr.port, addr.address);
        });
    }
    ;
}
async function main() {
    const app = makeApp();
    await (0, init_1.initDatabase)();
    runServer(app);
}
main().catch((err) => {
    console.error(err);
    console.error(err.stack);
    process.exitCode = 1;
});
