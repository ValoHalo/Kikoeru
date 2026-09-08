"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLrc = parseLrc;
exports.parseSrtOrVtt = parseSrtOrVtt;
exports.parseAss = parseAss;

function parseAss(text) {
    let inEvents = false;
    let fields = [];
    const lines = [];
    const timestamp = value => {
        const match = /^(\d+):(\d{2}):(\d{2})[.](\d+)$/.exec(value.trim());
        return match ? (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000 + Number(('0.' + match[4])) * 1000 : NaN;
    };
    for (const raw of text.split(/\r\n|\n|\r/)) {
        const line = raw.trim();
        if (line.startsWith('[')) { inEvents = /^\[events\]$/i.test(line); continue; }
        if (!inEvents) continue;
        if (/^format:/i.test(line)) { fields = line.slice(line.indexOf(':') + 1).split(',').map(field => field.trim().toLowerCase()); continue; }
        if (!/^dialogue:/i.test(line) || fields.at(-1) !== 'text') continue;
        const values = line.slice(line.indexOf(':') + 1).split(',');
        if (values.length < fields.length) continue;
        const time = timestamp(values[fields.indexOf('start')] || '');
        const timeEnd = timestamp(values[fields.indexOf('end')] || '');
        const content = values.slice(fields.length - 1).join(',');
        // Drawing commands are not subtitle prose.
        if (/\{[^}]*\\p[1-9]/i.test(content)) continue;
        const cleaned = content.replace(/\{[^}]*\}/g, '').replace(/\\[Nn]/g, '\n').replace(/\\h/g, ' ').trim();
        if (Number.isFinite(time) && Number.isFinite(timeEnd) && cleaned) lines.push({ time, timeEnd, text: cleaned, extLrc: [] });
    }
    return lines.sort((a, b) => a.time - b.time);
}
function parseLrc(textContent, isRemoveBlankLine = true) {
    const lines = [];
    for (const raw of textContent.split(/\r\n|\n|\r/)) {
        const stamps = [...raw.matchAll(/\[(?:(\d+):)?(\d+):(\d+)(?:[.](\d+))?\]/g)];
        if (!stamps.length || raw.slice(0, stamps[0].index).trim()) continue;
        const text = raw.slice(stamps.at(-1).index + stamps.at(-1)[0].length).trim();
        if (!text && isRemoveBlankLine) continue;
        for (const stamp of stamps) {
            const time = (Number(stamp[1] || 0) * 3600 + Number(stamp[2]) * 60 + Number(stamp[3])) * 1000 + Number('0.' + (stamp[4] || '0')) * 1000;
            lines.push({ time, text, extLrc: [] });
        }
    }
    return lines.sort((a, b) => a.time - b.time);
}
function parseSrtOrVtt(text) {
    let lines = text.split("\n").map((l) => l.trim());
    let isVtt = lines[0] == 'WEBVTT';
    if (isVtt) {
        lines = lines.slice(1);
    }
    const timeParseRe = /((\d*):)?(\d*):(\d*)(\.|,)(\d*)\s*-->\s*((\d*):)?(\d*):(\d*)(\.|,)(\d*)/;
    const numberRe = /^\d*$/;
    const chunks = [[]];
    lines.forEach((line) => {
        if (line !== "") {
            chunks[chunks.length - 1].push(line);
        }
        else {
            chunks.push([]);
        }
    });
    const parsedLines = chunks
        .filter(c => c.length > 0)
        .map(c => {
        if (numberRe.test(c[0])) {
            c = c.slice(1);
        }
        const cueIndex = c.findIndex(line => timeParseRe.test(line));
        if (cueIndex < 0 || /^(NOTE|STYLE|REGION)(\s|$)/.test(c[0])) return null;
        c = c.slice(cueIndex);
        const parseResult = timeParseRe.exec(c[0]);
        if (!parseResult)
            return null;
        const [, , sh, sm, ss, , sms, , eh, em, es, _sep2, ems] = parseResult;
        const time = parseInt(sh || '0') * 60 * 60 * 1000 + parseInt(sm) * 60 * 1000 + parseInt(ss) * 1000 + parseInt(sms);
        const timeEnd = parseInt(eh || '0') * 60 * 60 * 1000 + parseInt(em) * 60 * 1000 + parseInt(es) * 1000 + parseInt(ems);
        const text = c.slice(1).join("\n");
        return {
            time,
            timeEnd,
            text,
            extLrc: [],
        };
    })
        .filter(c => c !== null);
    return parsedLines;
}
