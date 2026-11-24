"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistentCache = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class PersistentCache {
    constructor(cacheFile, maxSize = 100, checker = () => true) {
        this.maxSize = maxSize;
        this.cacheFile = cacheFile;
        this.checker = checker;
        this.persistScheduled = false;
        this.persistTimer = null;
        this.lastPersistTime = 0;
        this.debounceInterval = 5000;
        this.cache = new Map();
        this.ensureCacheDirectory();
        this.load();
    }
    ensureCacheDirectory() {
        const dir = path_1.default.dirname(this.cacheFile);
        try {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        catch (err) {
            if (err.code !== 'EEXIST')
                throw err;
        }
    }
    load() {
        let data;
        try {
            data = fs_1.default.readFileSync(this.cacheFile, 'utf8');
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                this.cache = new Map();
                console.log('No existing cache file found, starting with empty cache');
                return;
            }
            throw err;
        }
        try {
            const cachedEntries = JSON.parse(data);
            if (!cachedEntries || typeof cachedEntries !== 'object' || Array.isArray(cachedEntries)) {
                throw new Error('Cache file must contain a JSON object');
            }
            const entries = Array.from(Object.entries(cachedEntries))
                .slice(0, this.maxSize)
                .filter(([_filePath, data]) => {
                return this.checker(data);
            });
            this.cache = new Map(entries);
            console.log(`Loaded ${this.cache.size} items from cache`);
        }
        catch (err) {
            this.cache = new Map();
            console.warn(`Failed to load cache from ${this.cacheFile}, starting with empty cache:`, err);
        }
    }
    set(key, obj) {
        if (typeof key !== 'string') {
            throw new Error('Key must be a string');
        }
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, obj);
        this.schedulePersist();
    }
    get(key) {
        return this.cache.get(key);
    }
    has(key) {
        return this.cache.has(key);
    }
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.schedulePersist();
        }
        return deleted;
    }
    clear() {
        this.cache.clear();
        return this.persist();
    }
    schedulePersist() {
        const now = Date.now();
        const timeSinceLastPersist = now - this.lastPersistTime;
        if (timeSinceLastPersist >= this.debounceInterval) {
            return this.persist();
        }
        if (this.persistScheduled)
            return;
        this.persistScheduled = true;
        const delay = this.debounceInterval - timeSinceLastPersist;
        this.persistTimer = setTimeout(() => {
            this.persistTimer = null;
            this.persistScheduled = false;
            this.persist();
        }, delay);
        this.persistTimer.unref();
    }
    cancelScheduledPersist() {
        if (this.persistTimer !== null) {
            clearTimeout(this.persistTimer);
            this.persistTimer = null;
        }
        this.persistScheduled = false;
    }
    persist() {
        this.cancelScheduledPersist();
        try {
            const cacheObject = {};
            for (const [key, obj] of this.cache) {
                cacheObject[key] = obj;
            }
            const data = JSON.stringify(cacheObject, null, 2);
            const tempFile = `${this.cacheFile}.tmp`;
            fs_1.default.writeFileSync(tempFile, data);
            fs_1.default.renameSync(tempFile, this.cacheFile);
            this.lastPersistTime = Date.now();
        }
        catch (err) {
            console.error('Failed to persist cache:', err);
        }
    }
    size() {
        return this.cache.size;
    }
}
exports.PersistentCache = PersistentCache;
