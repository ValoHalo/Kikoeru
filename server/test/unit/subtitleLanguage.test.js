"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
    detectSubtitleFileLanguage,
    detectSubtitleLanguage,
    isPreferredSubtitleLanguage,
    stripSubtitleLanguageSuffix,
} = require("../../src/filesystem/subtitleLanguage");

test("subtitle files are decoded asynchronously and read errors reach the caller", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kikoeru-subtitle-language-"));
    const filename = path.join(directory, "track.vtt");
    try {
        await fs.writeFile(filename, "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nThank you for listening. Please make yourself comfortable.\n");
        assert.equal(await detectSubtitleFileLanguage(filename), "en");
        await assert.rejects(detectSubtitleFileLanguage(path.join(directory, "missing.vtt")), { code: "ENOENT" });
    }
    finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
});

test("subtitle language detection recognizes the supported writing systems", () => {
    assert.equal(detectSubtitleLanguage("你好，欢迎收听这部作品。今天也请多关照。"), "zh");
    assert.equal(detectSubtitleLanguage("今日は来てくれてありがとう。ゆっくりしていってね。"), "ja");
    assert.equal(detectSubtitleLanguage("Thank you for listening. Please make yourself comfortable."), "en");
    assert.equal(detectSubtitleLanguage("오늘도 찾아와 주셔서 감사합니다. 편안하게 들어 주세요."), "ko");
});

test("subtitle language detection uses a filename marker for text without enough evidence", () => {
    assert.equal(detectSubtitleLanguage("...", "track.zh-Hans.vtt"), "zh");
    assert.equal(detectSubtitleLanguage("...", "track.jpn.srt"), "ja");
    assert.equal(stripSubtitleLanguageSuffix("track.english"), "track");
});

test("automatic language accepts every candidate while an explicit preference filters it", () => {
    assert.equal(isPreferredSubtitleLanguage("ja", "auto"), true);
    assert.equal(isPreferredSubtitleLanguage("ja", "zh"), false);
    assert.equal(isPreferredSubtitleLanguage("zh", "zh"), true);
});
