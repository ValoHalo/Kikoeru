"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const recursiveReaddir = require("recursive-readdir");
const minimatch = require("minimatch");
const util = require("node:util");
const childProcess = require("node:child_process");

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "kikoeru-traversal-"));
process.env.KIKOERU_DATA_DIR = runtime;
process.env.FREEZE_CONFIG_FILE = "1";
const { config } = require("../../src/config");
const probeCalls = [];
let probeOutput = "12.5";
const originalPromisify = util.promisify;
const promisifyMock = test.mock.method(util, "promisify", fn => fn === childProcess.execFile
    ? async (command, args) => {
        assert.equal(command, "ffprobe");
        probeCalls.push(args.at(-1));
        return { stdout: probeOutput };
    }
    : originalPromisify(fn));
const { getTrackList, scrapeWorkMemo } = require("../../src/filesystem/utils");
promisifyMock.mock.restore();
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

test("invalid saved durations are probed again while valid zero and positive durations are retained", async () => {
    config.excludeFolderGlobs = [];
    const folder = path.join(runtime, "durations");
    fs.mkdirSync(folder);
    const values = [null, undefined, "12", NaN, Infinity, -1, 0, 120];
    const memo = { duration: {}, mtime: {} };
    for (const [index, value] of values.entries()) {
        const name = `${index}.wav`;
        fs.writeFileSync(path.join(folder, name), "fixture");
        memo.duration[name] = value;
        memo.mtime[name] = Math.round(fs.statSync(path.join(folder, name)).mtimeMs);
    }
    probeCalls.length = 0;
    const before = await getTrackList(1, folder, memo);
    assert.deepEqual(before.filter(track => track.duration !== undefined).map(track => track.duration), [0, 120]);
    const result = await scrapeWorkMemo(folder, memo);
    assert.equal(probeCalls.length, 6);
    assert.deepEqual(values.map((_, index) => result.duration[`${index}.wav`]), [12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 0, 120]);
    const tracks = await getTrackList(1, folder, result);
    assert.ok(tracks.every(track => Number.isFinite(track.duration)));

    probeCalls.length = 0;
    await scrapeWorkMemo(folder, result);
    assert.equal(probeCalls.length, 0);
});

test("unreadable probe output stays missing and can be probed on the next scan", async () => {
    const folder = path.join(runtime, "unreadable-duration");
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, "track.wav"), "fixture");
    try {
        for (const output of ["N/A", "Infinity", "-1"]) {
            probeOutput = output;
            const result = await scrapeWorkMemo(folder, {});
            assert.deepEqual(result.duration, {});
            probeOutput = "12.5";
            const recovered = await scrapeWorkMemo(folder, result);
            assert.equal(recovered.duration["track.wav"], 12.5);
        }
    }
    finally {
        probeOutput = "12.5";
    }
});
