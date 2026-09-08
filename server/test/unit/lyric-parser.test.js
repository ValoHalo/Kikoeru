const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLrc, parseSrtOrVtt, parseAss } = require('../../src/filesystem/lyricParser');

test('LRC accepts whole seconds, fractional precision and repeated timestamps', () => {
    const lines = parseLrc('[ar:Artist]\n[00:01.123][00:03]Hello\n[01:02.5]World');
    assert.deepEqual(lines.map(line => [line.time, line.text]), [[1123, 'Hello'], [3000, 'Hello'], [62500, 'World']]);
});

test('VTT keeps multiline cue text and accepts named cues while ignoring notes', () => {
    const lines = parseSrtOrVtt('\uFEFFWEBVTT\n\nNOTE ignored\n00:00:00.000 --> 00:00:01.000\ncomment\n\nintro\n00:00:01.250 --> 00:00:02.500 align:start\nHello\nWorld');
    assert.equal(lines.length, 1);
    assert.equal(lines[0].time, 1250);
    assert.equal(lines[0].text, 'Hello\nWorld');
});

test('ASS and SSA event formats preserve commas and line breaks without styling or drawings', () => {
    for (const first of ['Layer', 'Marked']) {
        const lines = parseAss(`[Events]\nFormat: ${first}, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.25,0:00:02.50,Default,,0,0,0,,{\\i1}Hello, world\\NSecond line\nComment: 0,0:00:01.25,0:00:02.50,Default,,0,0,0,,hidden\nDialogue: 0,0:00:01.25,0:00:02.50,Default,,0,0,0,,{\\p1}m 0 0 l 10 10`);
        assert.equal(lines.length, 1);
        assert.equal(lines[0].time, 1250);
        assert.equal(lines[0].text, 'Hello, world\nSecond line');
    }
    assert.deepEqual(parseAss('[Events]\nDialogue: malformed'), []);
});
