"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { getSmartAudioFolderPath } = require("../../src/filesystem/utils");

const audio = title => ({ type: "audio", title });
const folder = (title, children) => ({ type: "folder", title, children });

test("smart path follows the configured audio type priority", () => {
    const tree = [
        folder("MP3", [audio("01.mp3")]),
        folder("Lossless", [audio("01.flac"), audio("02.flac")]),
    ];

    assert.deepEqual(getSmartAudioFolderPath(tree, {
        enabled: true,
        preferEffect: false,
        audioTypes: "mp3,flac,wav,opus,m4a,aac",
    }), ["MP3"]);
    assert.deepEqual(getSmartAudioFolderPath(tree, {
        enabled: true,
        preferEffect: false,
        audioTypes: "flac,mp3,wav,opus,m4a,aac",
    }), ["Lossless"]);
});

test("audio type priority takes precedence over sound effects", () => {
    const tree = [
        folder("SEなし", [audio("01.mp3"), audio("02.mp3")]),
        folder("01_効果音", [audio("door.wav")]),
    ];

    assert.deepEqual(getSmartAudioFolderPath(tree, {
        enabled: true,
        preferEffect: true,
        audioTypes: "mp3,flac,wav,opus,m4a,aac",
    }), ["SEなし"]);
    assert.deepEqual(getSmartAudioFolderPath(tree, {
        enabled: true,
        preferEffect: false,
        audioTypes: "mp3,flac,wav,opus,m4a,aac",
    }), ["SEなし"]);
});

test("unmarked audio is preferred over explicitly effect-free audio of the same format", () => {
    const tree = [
        folder("SEなし", [audio("01.mp3"), audio("02.mp3")]),
        folder("Main", [audio("01.mp3")]),
    ];
    assert.deepEqual(getSmartAudioFolderPath(tree), ["Main"]);
    assert.deepEqual(getSmartAudioFolderPath(tree, { preferEffect: false }), ["SEなし"]);
});

test("file markers and closer folder markers override inherited sound effects", () => {
    const tree = [
        folder("SEあり", [audio("01_SEなし.mp3"), audio("02_SEなし.mp3")]),
        folder("SEなし", [folder("MP3", [audio("01.mp3")]), folder("SEあり", [folder("MP3", [audio("01.mp3")])])]),
    ];
    assert.deepEqual(getSmartAudioFolderPath(tree), ["SEなし", "SEあり", "MP3"]);
    const filenames = [
        folder("SEなし", [audio("01_SEあり.mp3")]),
        folder("Other", [audio("01_SEなし.mp3"), audio("02_SEなし.mp3")]),
    ];
    assert.deepEqual(getSmartAudioFolderPath(filenames), ["SEなし"]);
});

test("effects in a lower priority format cannot qualify a mixed folder", () => {
    const tree = [
        folder("Mixed", [audio("01_SEなし.mp3"), audio("02_SEなし.mp3"), audio("01_SEあり.wav")]),
        folder("Main", [audio("01.mp3")]),
    ];
    assert.deepEqual(getSmartAudioFolderPath(tree), ["Main"]);
});

test("selection falls back when all audio is effect-free or uses an unlisted format", () => {
    assert.deepEqual(getSmartAudioFolderPath([
        folder("SEなし", [audio("01.mp3"), audio("02.mp3")]),
        folder("无音效", [audio("01.mp3")]),
    ]), ["SEなし"]);
    assert.deepEqual(getSmartAudioFolderPath([
        folder("SEなし", [audio("01.ogg"), audio("02.ogg")]),
        folder("Main", [audio("01.ogg")]),
    ]), ["Main"]);
    assert.deepEqual(getSmartAudioFolderPath([audio("01.mp3")]), []);
    assert.deepEqual(getSmartAudioFolderPath([]), []);
});

test("smart path chooses the most populated matching folder and can be disabled", () => {
    const tree = [
        folder("Part 1", [audio("01.mp3")]),
        folder("Part 2", [audio("01.mp3"), audio("02.mp3")]),
    ];

    assert.deepEqual(getSmartAudioFolderPath(tree, { enabled: true }), ["Part 2"]);
    assert.deepEqual(getSmartAudioFolderPath(tree, { enabled: false }), []);
});
