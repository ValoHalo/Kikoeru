"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { sortFoldersByCreatedTime } = require("../../src/filesystem/utils");

test("initial scan folders are ordered from oldest creation time to newest", () => {
    const folders = [
        { absolutePath: "C:/VoiceWork/RJ3", createdAtMs: 3000 },
        { absolutePath: "C:/VoiceWork/RJ1", createdAtMs: 1000 },
        { absolutePath: "C:/VoiceWork/RJ2", createdAtMs: 2000 },
    ];
    assert.deepEqual(sortFoldersByCreatedTime(folders).map(folder => folder.createdAtMs), [1000, 2000, 3000]);
    assert.deepEqual(folders.map(folder => folder.createdAtMs), [3000, 1000, 2000]);
});

test("folders without a creation time sort last with a stable path tie-break", () => {
    const folders = [
        { absolutePath: "C:/VoiceWork/B" },
        { absolutePath: "C:/VoiceWork/A" },
        { absolutePath: "C:/VoiceWork/Old", createdAtMs: 1000 },
    ];
    assert.deepEqual(sortFoldersByCreatedTime(folders).map(folder => folder.absolutePath), [
        "C:/VoiceWork/Old",
        "C:/VoiceWork/A",
        "C:/VoiceWork/B",
    ]);
});
