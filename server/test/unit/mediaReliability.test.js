"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const runtimeBase = path.resolve(__dirname, "../../.runtime");
fs.mkdirSync(runtimeBase, { recursive: true });
const runtimeRoot = fs.mkdtempSync(path.join(runtimeBase, "media-reliability-"));
process.env.NODE_ENV = "test";
process.env.FREEZE_CONFIG_FILE = "1";
process.env.KIKOERU_DATA_DIR = runtimeRoot;

const audioProcessor = require("../../src/filesystem/audioProcessor");
const { config } = require("../../src/config");
const db = require("../../src/database/db");
const filesystemUtils = require("../../src/filesystem/utils");
const mediaTesting = require("../../src/routes/media").__testing;
const { transcodeTaskQueue } = require("../../src/utils/TaskQueue");

const originals = {
    calculateLUFSSplit: audioProcessor.calculateLUFSSplit,
    convertAudioToM4a: audioProcessor.convertAudioToM4a,
    deleteOldFiles: audioProcessor.deleteOldFiles,
    getAudioPeaks: audioProcessor.getAudioPeaks,
    getTrackList: filesystemUtils.getTrackList,
    knex: db.knex,
    rootFolders: config.rootFolders,
    transcodeFolderDir: config.transcodeFolderDir,
    transcodeTempFolderDir: config.transcodeTempFolderDir,
};

function deferred() {
    let resolve;
    const promise = new Promise(resolvePromise => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}

async function waitFor(predicate, message) {
    for (let index = 0; index < 100; index++) {
        if (predicate())
            return;
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.fail(message);
}

function configureSyntheticWork(testName) {
    const workRoot = path.join(runtimeRoot, testName, "library");
    const workDir = "RJ000001";
    const transcodeFolder = path.join(runtimeRoot, testName, "transcode");
    const transcodeTempFolder = path.join(transcodeFolder, "temp");
    fs.mkdirSync(path.join(workRoot, workDir), { recursive: true });
    const sourcePath = path.join(workRoot, workDir, "track.wav");
    fs.writeFileSync(sourcePath, "synthetic audio input");
    config.rootFolders = [{ name: "test", path: workRoot }];
    config.transcodeFolderDir = transcodeFolder;
    config.transcodeTempFolderDir = transcodeTempFolder;
    db.knex = () => ({
        select() { return this; },
        where() { return this; },
        first() {
            return Promise.resolve({ root_folder: "test", dir: workDir, memo: {} });
        },
    });
    filesystemUtils.getTrackList = async () => [{ title: "track.wav", subtitle: "" }];
    audioProcessor.deleteOldFiles = () => { };
    return { sourcePath, transcodeFolder, transcodeTempFolder };
}

test.afterEach(() => {
    audioProcessor.calculateLUFSSplit = originals.calculateLUFSSplit;
    audioProcessor.convertAudioToM4a = originals.convertAudioToM4a;
    audioProcessor.deleteOldFiles = originals.deleteOldFiles;
    audioProcessor.getAudioPeaks = originals.getAudioPeaks;
    filesystemUtils.getTrackList = originals.getTrackList;
    db.knex = originals.knex;
    config.rootFolders = originals.rootFolders;
    config.transcodeFolderDir = originals.transcodeFolderDir;
    config.transcodeTempFolderDir = originals.transcodeTempFolderDir;
    mediaTesting.transcodeTasks.clear();
    mediaTesting.transcodeTaskSourceFingerprints.clear();
    mediaTesting.transcodeTaskStatus.clear();
    mediaTesting.lufsCalculateTaskStatus.clear();
    mediaTesting.peakCalculateTaskStatus.clear();
});

test.after(async () => {
    await originals.knex.destroy();
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
});

test("transcode bitrate defaults to 128 and only accepts product options", () => {
    assert.equal(mediaTesting.parseTranscodeBitRate(undefined), 128);
    assert.equal(mediaTesting.parseTranscodeBitRate(""), 128);
    assert.equal(mediaTesting.parseTranscodeBitRate("128"), 128);
    assert.equal(mediaTesting.parseTranscodeBitRate(320), 320);
    for (const value of [0, 64, 192, 321, "128kbps", "not-a-number"]) {
        assert.throws(() => mediaTesting.parseTranscodeBitRate(value), error => {
            assert.equal(error.code, "UNSUPPORTED_TRANSCODE_BIT_RATE");
            return true;
        });
    }
});

test("matching transcode requests share one promise and publish waiting, progress, and ready", async () => {
    const { transcodeTempFolder } = configureSyntheticWork("shared");
    const conversionGate = deferred();
    const conversionStarted = deferred();
    const progressGate = deferred();
    let conversionCount = 0;
    let tempOutputPath;
    audioProcessor.convertAudioToM4a = async (_input, output, bitRate, onProgress) => {
        conversionCount++;
        tempOutputPath = output;
        assert.equal(bitRate, 128);
        fs.writeFileSync(output, "complete transcoded output");
        conversionStarted.resolve();
        await progressGate.promise;
        onProgress({ percent: 42 });
        await conversionGate.promise;
    };

    const [first, second] = await Promise.all([
        mediaTesting.startTranscodeTask(1001, 0, 128),
        mediaTesting.startTranscodeTask(1001, 0, 128),
    ]);
    assert.equal([first, second].filter(task => task.started).length, 1);
    assert.strictEqual(first.promise, second.promise);
    assert.equal((await mediaTesting.getTranscodeStatusResponse(1001, 0, 128)).status, "waiting");

    await conversionStarted.promise;
    progressGate.resolve();
    await waitFor(() => mediaTesting.transcodeTaskStatus.get("1001_0_128")?.state === "progress", "transcode progress was not published");
    const progressStatus = await mediaTesting.getTranscodeStatusResponse(1001, 0, 128);
    assert.equal(progressStatus.status, "progress");
    assert.equal(progressStatus.progress.percent, 42);
    conversionGate.resolve();

    const [firstPath, secondPath] = await Promise.all([first.promise, second.promise]);
    assert.equal(firstPath, secondPath);
    assert.equal(conversionCount, 1);
    assert.equal(fs.readFileSync(firstPath, "utf8"), "complete transcoded output");
    assert.equal(fs.existsSync(tempOutputPath), false);
    assert.equal(fs.readdirSync(transcodeTempFolder).length, 0);
    assert.equal(mediaTesting.transcodeTasks.size, 0);
    assert.equal((await mediaTesting.getTranscodeStatusResponse(1001, 0, 128)).status, "ready");
});

test("cached transcodes bypass a full queue", async () => {
    const { sourcePath, transcodeFolder } = configureSyntheticWork("cached-while-full");
    const cachedPath = audioProcessor.genTranscodeOutputPath(1004, 0, 128, transcodeFolder);
    fs.mkdirSync(path.dirname(cachedPath), { recursive: true });
    fs.writeFileSync(cachedPath, "cached transcoded output");
    mediaTesting.writeTranscodeCacheMetadata(cachedPath, await mediaTesting.getSourceFingerprint(sourcePath));

    const gate = deferred();
    const queuedTasks = [];
    for (let index = 0; index < transcodeTaskQueue.capacity; index++) {
        queuedTasks.push(transcodeTaskQueue.add(() => gate.promise));
    }
    try {
        assert.equal(transcodeTaskQueue.isFull(), true);
        const task = await mediaTesting.startTranscodeTask(1004, 0, 128);
        assert.equal(task.accepted, true);
        assert.equal(task.cached, true);
        assert.equal(await task.promise, cachedPath);
    }
    finally {
        gate.resolve();
        await Promise.all(queuedTasks);
    }
});

test("replacing a source file at the same path invalidates and rebuilds its transcode", async () => {
    const { sourcePath, transcodeFolder } = configureSyntheticWork("source-replaced");
    let conversionCount = 0;
    audioProcessor.convertAudioToM4a = async (input, output) => {
        conversionCount++;
        fs.writeFileSync(output, `converted:${fs.readFileSync(input, "utf8")}`);
    };

    const firstTask = await mediaTesting.startTranscodeTask(1005, 0, 128);
    const outputPath = await firstTask.promise;
    const metadataPath = mediaTesting.getTranscodeCacheMetadataPath(outputPath);
    assert.equal(fs.existsSync(metadataPath), true);
    assert.match(fs.readFileSync(outputPath, "utf8"), /synthetic audio input/);
    assert.equal((await mediaTesting.getTranscodeStatusResponse(1005, 0, 128)).status, "ready");

    fs.writeFileSync(sourcePath, "replacement audio input with a different size");
    assert.equal((await mediaTesting.getTranscodeStatusResponse(1005, 0, 128)).status, "waiting");
    assert.equal(fs.existsSync(outputPath), false);
    assert.equal(fs.existsSync(metadataPath), false);

    const replacementTask = await mediaTesting.startTranscodeTask(1005, 0, 128);
    assert.equal(replacementTask.cached, undefined);
    assert.equal(await replacementTask.promise, outputPath);
    assert.match(fs.readFileSync(outputPath, "utf8"), /replacement audio input/);
    assert.equal(conversionCount, 2);
});

test("a missing source removes its previous transcode instead of reporting ready", async () => {
    const { sourcePath, transcodeFolder } = configureSyntheticWork("source-missing");
    const outputPath = audioProcessor.genTranscodeOutputPath(1006, 0, 128, transcodeFolder);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, "cached transcoded output");
    mediaTesting.writeTranscodeCacheMetadata(outputPath, await mediaTesting.getSourceFingerprint(sourcePath));
    const metadataPath = mediaTesting.getTranscodeCacheMetadataPath(outputPath);
    fs.unlinkSync(sourcePath);

    const status = await mediaTesting.getTranscodeStatusResponse(1006, 0, 128);
    assert.equal(status.status, "failed");
    assert.match(status.error, /\u6e90\u97f3\u9891\u6587\u4ef6\u4e0d\u5b58\u5728/);
    assert.equal(fs.existsSync(outputPath), false);
    assert.equal(fs.existsSync(metadataPath), false);
    await assert.rejects(mediaTesting.startTranscodeTask(1006, 0, 128), /\u6e90\u97f3\u9891\u6587\u4ef6\u4e0d\u5b58\u5728/);
});

test("failed transcodes release in-flight state, remove partial files, and can be retried", async () => {
    configureSyntheticWork("retry");
    let tempOutputPath;
    audioProcessor.convertAudioToM4a = async (_input, output, _bitRate, onProgress) => {
        tempOutputPath = output;
        fs.writeFileSync(output, "partial output");
        onProgress({ percent: 5 });
        throw new Error("synthetic conversion failure");
    };

    const failedTask = await mediaTesting.startTranscodeTask(1002, 0, 320);
    await assert.rejects(failedTask.promise, /synthetic conversion failure/);
    assert.equal(mediaTesting.transcodeTasks.size, 0);
    assert.equal(fs.existsSync(tempOutputPath), false);
    const failedStatus = await mediaTesting.getTranscodeStatusResponse(1002, 0, 320);
    assert.equal(failedStatus.status, "failed");
    assert.match(failedStatus.error, /synthetic conversion failure/);

    audioProcessor.convertAudioToM4a = async (_input, output) => {
        fs.writeFileSync(output, "retry completed");
    };
    const retryTask = await mediaTesting.startTranscodeTask(1002, 0, 320);
    assert.equal(retryTask.started, true);
    const outputPath = await retryTask.promise;
    assert.equal(fs.readFileSync(outputPath, "utf8"), "retry completed");
    assert.equal(mediaTesting.transcodeTasks.size, 0);
    assert.equal((await mediaTesting.getTranscodeStatusResponse(1002, 0, 320)).status, "ready");
});

test("expired failed status returns to waiting instead of remaining stuck", async () => {
    const { sourcePath } = configureSyntheticWork("failed-status-expiry");
    const identifier = audioProcessor.genTranscodeTaskIdentifier(1003, 0, 128);
    mediaTesting.transcodeTaskStatus.set(identifier, {
        state: "failed",
        progress: null,
        error: "synthetic failure",
        failedAt: 1000,
        sourceFingerprint: await mediaTesting.getSourceFingerprint(sourcePath),
    });

    assert.equal((await mediaTesting.getTranscodeStatusResponse(1003, 0, 128, 60_999)).status, "failed");
    assert.equal((await mediaTesting.getTranscodeStatusResponse(1003, 0, 128, 61_000)).status, "waiting");
    assert.equal(mediaTesting.transcodeTaskStatus.has(identifier), false);
});

test("loudness and peak in-flight maps are released on failure and peak errors are observed", async () => {
    const fileName = path.join(runtimeRoot, "loudness", "track.wav");
    fs.mkdirSync(path.dirname(fileName), { recursive: true });
    fs.writeFileSync(fileName, "synthetic audio input");
    let loudnessCalls = 0;
    audioProcessor.calculateLUFSSplit = async () => {
        loudnessCalls++;
        if (loudnessCalls === 1) {
            throw new Error("synthetic loudness failure");
        }
        return -16.5;
    };
    audioProcessor.getAudioPeaks = async () => {
        throw new Error("synthetic peak failure");
    };

    await assert.rejects(mediaTesting.getOrCalculateAudioInfo(fileName), /synthetic loudness failure/);
    assert.equal(mediaTesting.lufsCalculateTaskStatus.size, 0);

    const loggedErrors = [];
    const originalConsoleError = console.error;
    console.error = (...args) => loggedErrors.push(args);
    try {
        const audioInfo = await mediaTesting.getOrCalculateAudioInfo(fileName);
        assert.deepEqual(audioInfo, { loudnorm: -16.5, peakLevels: [] });
        assert.equal(loudnessCalls, 2);
        assert.equal(mediaTesting.lufsCalculateTaskStatus.size, 0);
        await waitFor(() => mediaTesting.peakCalculateTaskStatus.size === 0, "peak task did not release its in-flight entry");
        assert(loggedErrors.some(args => String(args[0]).includes("peakLevels compute failed")));
    }
    finally {
        console.error = originalConsoleError;
    }
});

test("replacing a source file invalidates both loudness and peak caches", async () => {
    const fileName = path.join(runtimeRoot, "loudness-replaced", "track.wav");
    fs.mkdirSync(path.dirname(fileName), { recursive: true });
    fs.writeFileSync(fileName, "first synthetic audio input");
    let loudnessCalls = 0;
    let peakCalls = 0;
    audioProcessor.calculateLUFSSplit = async () => {
        loudnessCalls++;
        return loudnessCalls === 1 ? -14 : -20;
    };
    audioProcessor.getAudioPeaks = async () => {
        peakCalls++;
        return [{ ptsTime: 0, peakLevel: peakCalls === 1 ? -1 : -6 }];
    };

    const firstInfo = await mediaTesting.getOrCalculateAudioInfo(fileName);
    assert.deepEqual(firstInfo, { loudnorm: -14, peakLevels: [] });
    await waitFor(() => mediaTesting.peakCalculateTaskStatus.size === 0, "first peak calculation did not finish");
    const firstCachedInfo = await mediaTesting.getOrCalculateAudioInfo(fileName);
    assert.equal(firstCachedInfo.loudnorm, -14);
    assert.equal(firstCachedInfo.peakLevels[0].peakLevel, -1);

    fs.writeFileSync(fileName, "replacement synthetic audio input with another size");
    const replacementInfo = await mediaTesting.getOrCalculateAudioInfo(fileName);
    assert.deepEqual(replacementInfo, { loudnorm: -20, peakLevels: [] });
    await waitFor(() => mediaTesting.peakCalculateTaskStatus.size === 0, "replacement peak calculation did not finish");
    const replacementCachedInfo = await mediaTesting.getOrCalculateAudioInfo(fileName);
    assert.equal(replacementCachedInfo.loudnorm, -20);
    assert.equal(replacementCachedInfo.peakLevels[0].peakLevel, -6);
    assert.equal(loudnessCalls, 2);
    assert.equal(peakCalls, 2);
});
