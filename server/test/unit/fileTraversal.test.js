"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const recursiveReaddir = require("recursive-readdir");
const minimatch = require("minimatch");

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "kikoeru-traversal-"));
process.env.KIKOERU_DATA_DIR = runtime;
process.env.FREEZE_CONFIG_FILE = "1";
const { config } = require("../../src/config");
const { getTrackList, scrapeWorkMemo } = require("../../src/filesystem/utils");
const media = path.join(runtime, "media");
const names = ["one.mp3", "nested/two.mp3", "nested/.hidden.mp3", ".hidden/three.mp3", "nested/track.vtt",
    ...Array.from({ length: 40 }, (_, i) => `many/track-${i}.mp3`)];

test.before(() => {
    for (const name of names) {
        const file = path.join(media, name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, "fixture");
    }
});
test.after(() => fs.rmSync(runtime, { recursive: true, force: true }));

test("directory entries preserve recursive-readdir glob and hidden-file results", async () => {
    for (const rules of [[], ["**/nested/**"], ["**/*.vtt"], ["!**/*.mp3"], ["**/nested"], ["**/.hidden/**"]]) {
        config.excludeFolderGlobs = rules;
        const expected = (await recursiveReaddir(media))
            .filter(file => !rules.some(rule => minimatch(file, rule)))
            .map(file => path.relative(media, file).replace(/\\/g, "/")).sort();
        const tracks = await getTrackList(1, media, {});
        assert.deepEqual(tracks.map(track => track.relativePath).sort(), expected);
    }
});

test("unchanged duration memos use bounded asynchronous stat without probing audio", async () => {
    config.excludeFolderGlobs = [];
    const memo = { duration: {}, mtime: {} };
    for (const name of names.filter(name => name.endsWith(".mp3"))) {
        const key = path.join(name);
        memo.duration[key] = 123;
        memo.mtime[key] = Math.round(fs.statSync(path.join(media, name)).mtimeMs);
    }
    const originalStat = fs.promises.stat;
    let active = 0;
    let maximum = 0;
    const stat = test.mock.method(fs.promises, "stat", async (...args) => {
        maximum = Math.max(maximum, ++active);
        try { return await originalStat(...args); }
        finally { active--; }
    });
    const syncStat = test.mock.method(fs, "statSync", () => { throw new Error("Synchronous stat in scan"); });
    try {
        const result = await scrapeWorkMemo(media, memo);
        assert.deepEqual(result.duration, memo.duration);
        assert.deepEqual(result.mtime, memo.mtime);
        assert.equal(result.isContainLyric, true);
        assert.ok(maximum > 0 && maximum <= config.maxParallelism);
    }
    finally {
        stat.mock.restore();
        syncStat.mock.restore();
    }
});
