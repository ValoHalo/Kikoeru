"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { PersistentCache } = require("../../src/utils/PersistentCache");

const runtimeBase = path.resolve(__dirname, "../../.runtime");
fs.mkdirSync(runtimeBase, { recursive: true });
const runtimeRoot = fs.mkdtempSync(path.join(runtimeBase, "persistent-cache-"));

test.after(() => {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
});

function cachePath(name) {
    return path.join(runtimeRoot, name, "cache.json");
}

test("invalid cache JSON falls back to an empty usable cache", () => {
    const file = cachePath("invalid-json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{ invalid json", "utf8");
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);
    let cache;
    try {
        cache = new PersistentCache(file);
    }
    finally {
        console.warn = originalWarn;
    }

    assert.equal(cache.size(), 0);
    assert.equal(warnings.length, 1);
    cache.set("recovered.wav", { loudnorm: -18 });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), {
        "recovered.wav": { loudnorm: -18 },
    });
});

test("delayed persistence does not keep the process alive and is cancelled by an immediate persist", async () => {
    const file = cachePath("timer");
    const cache = new PersistentCache(file);
    cache.debounceInterval = 200;
    cache.set("first.wav", 1);
    cache.lastPersistTime = Date.now();

    let persistCalls = 0;
    const originalPersist = cache.persist.bind(cache);
    cache.persist = () => {
        persistCalls++;
        return originalPersist();
    };
    cache.set("second.wav", 2);

    assert.equal(cache.persistScheduled, true);
    assert.notEqual(cache.persistTimer, null);
    assert.equal(cache.persistTimer.hasRef(), false);

    cache.persist();
    assert.equal(cache.persistScheduled, false);
    assert.equal(cache.persistTimer, null);

    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(persistCalls, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), {
        "first.wav": 1,
        "second.wav": 2,
    });
});
