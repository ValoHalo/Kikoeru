"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    detectSubtitleLanguage,
    isPreferredSubtitleLanguage,
    stripSubtitleLanguageSuffix,
} = require("../../src/filesystem/subtitleLanguage");

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
