"use strict";

const runtimeState = require('../runtimeState');

class ScanCoordinator {
    constructor(state = runtimeState) {
        this.state = state;
        this.pending = [];
        this.running = false;
    }
    run(task, signal) {
        return new Promise((resolve, reject) => {
            const entry = { task, resolve, reject, signal };
            entry.abort = () => {
                const index = this.pending.indexOf(entry);
                if (index >= 0) {
                    this.pending.splice(index, 1);
                    reject(new Error('Scan request cancelled'));
                    this.state.scannerPending = this.pending.length;
                }
            };
            if (signal?.aborted || this.state.installing) {
                reject(new Error('Scan request unavailable'));
                return;
            }
            signal?.addEventListener('abort', entry.abort, { once: true });
            this.pending.push(entry);
            this.state.scannerPending = this.pending.length;
            this.next();
        });
    }
    next() {
        if (this.running || this.state.installing) return;
        const entry = this.pending.shift();
        this.state.scannerPending = this.pending.length;
        if (!entry) return;
        entry.signal?.removeEventListener('abort', entry.abort);
        this.running = true;
        this.state.scannerActive = true;
        Promise.resolve().then(entry.task).then(entry.resolve, entry.reject).finally(() => {
            this.running = false;
            this.state.scannerActive = false;
            this.next();
        });
    }
}
module.exports = { ScanCoordinator, scanCoordinator: new ScanCoordinator() };
