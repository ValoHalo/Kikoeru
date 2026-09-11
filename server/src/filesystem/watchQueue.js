"use strict";

const fs = require('fs').promises;
const path = require('path');

function folderKey(folder) {
    return JSON.stringify([folder.rootFolderName, folder.rootPath, folder.relativePath]);
}

class WatchQueue {
    constructor({ statePath, inspect, execute, now = Date.now, quietMs = 5000, stableMs = 5000,
        verifyMs = 60000, retryMs = 30000, logger = console }) {
        Object.assign(this, { statePath, inspect, execute, now, quietMs, stableMs, verifyMs, retryMs, logger });
        this.entries = new Map();
        this.writes = Promise.resolve();
    }
    async load() {
        try {
            const state = JSON.parse(await fs.readFile(this.statePath, 'utf8'));
            if (state.version !== 1 || !Array.isArray(state.entries)) throw new Error('Invalid watcher state');
            for (const entry of state.entries) {
                if (!entry.folder || typeof entry.folder.relativePath !== 'string') continue;
                entry.signature = null;
                entry.checkAt = this.now() + this.quietMs;
                this.entries.set(folderKey(entry.folder), entry);
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT') this.logger.error('[FileWatcher] 无法读取监听状态:', error.message);
        }
    }
    save() {
        const write = async () => {
            await fs.mkdir(path.dirname(this.statePath), { recursive: true });
            const temporary = `${this.statePath}.tmp`;
            await fs.writeFile(temporary, JSON.stringify({ version: 1, entries: [...this.entries.values()] }));
            await fs.rename(temporary, this.statePath);
        };
        const result = this.writes.then(write);
        this.writes = result.catch(() => {});
        return result;
    }
    notify(folder, priority = 0) {
        const key = folderKey(folder);
        const previous = this.entries.get(key);
        this.entries.set(key, { ...previous, folder, priority, verify: false, pending: true, signature: null,
            revision: (previous?.revision || 0) + 1, checkAt: this.now() + this.quietMs, attempts: 0 });
    }
    reconcile(folders) {
        for (const folder of folders) {
            const entry = this.entries.get(folderKey(folder));
            if (!entry || !entry.pending) this.notify(folder, 1);
        }
    }
    async tick() {
        if (this.running) return;
        const entry = [...this.entries.values()].filter(item => item.pending && item.checkAt <= this.now())
            .sort((a, b) => (a.priority || 0) - (b.priority || 0) || a.checkAt - b.checkAt)[0];
        if (!entry) return;
        this.running = true;
        const revision = entry.revision;
        const current = () => this.entries.get(folderKey(entry.folder))?.revision === revision;
        try {
            const snapshot = await this.inspect(entry.folder);
            if (!current()) return;
            if (snapshot.state === 'unavailable' || snapshot.busy) {
                entry.signature = null;
                entry.checkAt = this.now() + this.retryMs;
            }
            else if (snapshot.fingerprint === entry.completedSignature && !entry.verify && !entry.attempts) {
                entry.pending = false;
            }
            else if (snapshot.fingerprint !== entry.signature) {
                entry.signature = snapshot.fingerprint;
                entry.checkAt = this.now() + this.stableMs;
            }
            else {
                // Persist the pending item before crossing the process boundary.
                await this.save();
                const result = await this.execute(entry.folder, snapshot, () => current());
                if (!current()) return;
                if (result === 'changed') {
                    entry.signature = null;
                    entry.checkAt = this.now() + this.quietMs;
                }
                else if (result === 'failed') {
                    throw new Error('Work scan failed');
                }
                else if (result === 'duplicate') {
                    entry.signature = null;
                    entry.checkAt = this.now() + 5 * 60 * 1000;
                }
                else {
                    entry.completedSignature = snapshot.fingerprint;
                    entry.attempts = 0;
                    if (entry.verify) {
                        entry.pending = false;
                        entry.verify = false;
                    }
                    else {
                        entry.verify = true;
                        entry.signature = null;
                        entry.checkAt = this.now() + this.verifyMs;
                    }
                }
            }
        }
        catch (error) {
            if (current()) {
                entry.attempts = (entry.attempts || 0) + 1;
                entry.signature = null;
                entry.checkAt = this.now() + Math.min(30 * 60 * 1000, this.retryMs * 2 ** Math.min(entry.attempts - 1, 6));
            }
            this.logger.error(`[FileWatcher] 作品处理失败 (${entry.folder.code}):`, error.message);
        }
        finally {
            try { await this.save(); }
            finally { this.running = false; }
        }
    }
}
module.exports = { WatchQueue, folderKey };
