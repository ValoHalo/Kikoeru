"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { getAudioEffectState } = require("../../src/filesystem/audioEffects");

test("explicit negative markers identify versions without sound effects", () => {
    for (const name of [
        "SEなし", "SE無し", "SE無", "SE_なし", "【ＳＥ無し】", "効果音なし",
        "効果音無し版", "SE抜き", "无SE", "無SE", "无音效", "無音效", "不含音效",
        "音效无", "没有效果音", "no SE", "without-SE", "SE off", "SFX_none",
        "without sound effects", "sound effects removed", "01_SEなし", "SEあり・SEなし",
    ]) {
        assert.equal(getAudioEffectState(name), false, name);
    }
});

test("explicit positive markers override a parent without sound effects", () => {
    for (const name of [
        "SEあり", "SE有り", "SE有", "有SE", "【SEあり】", "ＳＥあり", "(SE)",
        "SE", "SFX", "SE_あり", "with SE", "効果音あり", "有音效", "sound effects",
    ]) {
        assert.equal(getAudioEffectState(name, false), true, name);
    }
});

test("unmarked names inherit their parent and default to sound effects", () => {
    for (const name of ["", "Main", "MP3", "01", "BGMなし", "base", "noise", "sense", "closer"]) {
        assert.equal(getAudioEffectState(name), true, name);
        assert.equal(getAudioEffectState(name, false), false, name);
    }
});
