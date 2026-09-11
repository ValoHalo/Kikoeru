"use strict";

const { fork } = require('child_process');
const path = require('path');
const { scanCoordinator } = require('./scanCoordinator');

class WatcherSupervisor {
    constructor({ spawn = () => fork(path.join(__dirname, 'watcherWorker.js')), coordinator = scanCoordinator,
        retryMs = 1000, heartbeatTimeoutMs = 60000, logger = console } = {}) {
        Object.assign(this, { spawn, coordinator, retryMs, heartbeatTimeoutMs, logger });
        this.stopped = true;
        this.failures = 0;
    }
    start() {
        if (!this.stopped) return;
        this.stopped = false;
        this.launch();
    }
    launch() {
        if (this.stopped) return;
        let child;
        try { child = this.spawn(); }
        catch (error) { this.logger.error('[FileWatcher] 启动失败:', error); this.retry(); return; }
        this.child = child;
        const started = Date.now();
        let lastHeartbeat = started;
        let requesting = false;
        const controller = new AbortController();
        const watchdog = setInterval(() => {
            if (Date.now() - lastHeartbeat > this.heartbeatTimeoutMs) {
                this.logger.error('[FileWatcher] 监听进程无响应');
                child.kill();
            }
        }, Math.min(5000, this.heartbeatTimeoutMs));
        watchdog.unref();
        child.on('message', message => {
            if (message?.type === 'heartbeat') lastHeartbeat = Date.now();
            if (message?.type !== 'scan-request' || requesting || this.stopped) return;
            requesting = true;
            this.coordinator.run(() => new Promise((resolve, reject) => {
                if (!child.connected) { reject(new Error('Watcher disconnected')); return; }
                const done = value => {
                    if (value?.type === 'scan-done' && value.id === message.id) finish();
                };
                const exited = () => finish(new Error('Watcher exited during scan'));
                const timer = setTimeout(() => child.kill(), 10 * 60 * 1000);
                const finish = error => {
                    clearTimeout(timer);
                    child.removeListener('message', done);
                    child.removeListener('exit', exited);
                    error ? reject(error) : resolve();
                };
                child.on('message', done);
                child.once('exit', exited);
                child.send({ type: 'scan-granted', id: message.id }, error => {
                    if (error) child.kill();
                });
            }), controller.signal).catch(error => {
                if (!this.stopped) this.logger.error('[FileWatcher] 扫描中断:', error.message);
                if (child.connected) child.send({ type: 'scan-denied', id: message.id }, sendError => { if (sendError) child.kill(); });
            }).finally(() => { requesting = false; });
        });
        child.on('error', error => this.logger.error('[FileWatcher] 进程错误:', error));
        let exited = false;
        const onExit = (code, signal) => {
            if (exited) return;
            exited = true;
            clearInterval(watchdog);
            controller.abort();
            if (this.child === child) this.child = null;
            if (this.stopped) return;
            if (Date.now() - started > 60000) this.failures = 0;
            this.logger.error(`[FileWatcher] 监听进程退出，code=${code}, signal=${signal || ''}`);
            this.retry();
        };
        child.once('exit', onExit);
        child.once('close', onExit);
    }
    retry() {
        if (this.stopped) return;
        this.timer = setTimeout(() => this.launch(), Math.min(60000, this.retryMs * 2 ** Math.min(this.failures++, 6)));
        this.timer.unref();
    }
    stop() {
        this.stopped = true;
        clearTimeout(this.timer);
        const child = this.child;
        if (!child) return Promise.resolve();
        return new Promise(resolve => {
            child.once('exit', resolve);
            child.once('close', resolve);
            child.kill();
        });
    }
}
const supervisor = new WatcherSupervisor();
async function startWatcher() { supervisor.start(); }
function stopWatcher() { return supervisor.stop(); }
process.once('exit', stopWatcher);
module.exports = { startWatcher, stopWatcher, WatcherSupervisor };
