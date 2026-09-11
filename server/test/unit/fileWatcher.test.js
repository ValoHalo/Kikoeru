"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { TaskQueue } = require("../../src/utils/TaskQueue");

function makeWatcher() {
    const timers = new Map();
    const errors = [];
    const processed = [];
    const root = { name: "Library", path: path.resolve("watcher-fixture") };
    const state = { failNormalize: false, failScan: false };
    let callback;
    let nextTimer = 0;
    const dependencies = {
        "@parcel/watcher": { subscribe: async (_root, handler) => {
            callback = handler;
            return { unsubscribe: async () => {} };
        } },
        path,
        fs: { statSync: () => ({ isDirectory: () => true }) },
        "../config": { config: { rootFolders: [root], scannerMaxRecursionDepth: 5 } },
        "../database/db": { knex: () => ({ where: () => ({ first: async () => undefined }) }) },
        "./idConverter": { codeToIdNumber: code => Number(code.slice(2)) },
        "./scannerModules": { processFolder: async folder => {
            if (state.failScan) throw new Error("scan failed");
            processed.push(folder.code);
        } },
        "../utils/TaskQueue": { scanTaskQueue: new TaskQueue() },
        "./utils": {
            getWorkActualPath: (_name, relative) => path.join(root.path, relative),
            tryMatchWorkCodeFromTopPath: relative => {
                if (state.failNormalize) throw new Error("normalize failed");
                return { code: relative, codeFolderPath: relative };
            },
        },
    };
    const exports = {};
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../src/filesystem/fileWatcher.js"), "utf8"), {
        exports,
        require: name => {
            assert.ok(Object.hasOwn(dependencies, name), name);
            return dependencies[name];
        },
        console: { log() {}, error: (...args) => errors.push(args) },
        setTimeout: (fn, delay) => {
            const id = ++nextTimer;
            timers.set(id, { fn, delay });
            return id;
        },
        clearTimeout: id => timers.delete(id),
    });
    return {
        errors, processed, state, timers,
        start: exports.startWatcher,
        emit: events => callback(null, events),
        event: code => ({ type: "create", path: path.join(root.path, code) }),
        async tick(delay) {
            for (const [id, timer] of [...timers]) {
                if (timer.delay !== delay) continue;
                timers.delete(id);
                timer.fn();
            }
            await new Promise(resolve => setImmediate(resolve));
        },
    };
}

test("watcher reports event errors and processes later events", async () => {
    const watcher = makeWatcher();
    await watcher.start();
    watcher.emit(null);
    await watcher.tick(100);
    assert.equal(watcher.errors.length, 1);
    assert.ok(watcher.errors[0][1].stack);

    watcher.emit([watcher.event("RJ123456")]);
    await watcher.tick(100);
    await watcher.tick(10000);
    assert.deepEqual(watcher.processed, ["RJ123456"]);
});

test("watcher catches a failed debounce flush and can flush again", async () => {
    const watcher = makeWatcher();
    await watcher.start();
    watcher.state.failNormalize = true;
    watcher.emit([watcher.event("RJ123456")]);
    await watcher.tick(100);
    await watcher.tick(10000);
    assert.equal(watcher.errors.length, 1);
    assert.match(watcher.errors[0][1].stack, /normalize failed/);

    watcher.state.failNormalize = false;
    watcher.emit([watcher.event("RJ123456")]);
    await watcher.tick(100);
    await watcher.tick(10000);
    assert.deepEqual(watcher.processed, ["RJ123456"]);
    assert.equal(watcher.timers.size, 0);
});

test("watcher keeps scan rejection details and accepts subsequent work", async () => {
    const watcher = makeWatcher();
    await watcher.start();
    watcher.state.failScan = true;
    watcher.emit([watcher.event("RJ123456")]);
    await watcher.tick(100);
    await watcher.tick(10000);
    assert.equal(watcher.errors.length, 1);
    assert.match(watcher.errors[0][0], /Library:RJ123456/);
    assert.match(watcher.errors[0][1].stack, /scan failed/);

    watcher.state.failScan = false;
    watcher.emit([watcher.event("RJ654321"), watcher.event("RJ654321")]);
    await watcher.tick(100);
    await watcher.tick(10000);
    assert.deepEqual(watcher.processed, ["RJ654321"]);
});
