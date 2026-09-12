"use strict";

const EFFECT_TERM = '(?:(?<![a-z])(?:se|sfx)(?![a-z])|sound[\\s_-]*effects?|効果音|效果音|音效)';
const SEPARATOR = '[\\s_\\-:：]*';
const WITHOUT_EFFECTS = new RegExp(
    `(?:無し|なし|无|無|没有|沒有|不含|不带|不帶|(?<![a-z])(?:no|without)${SEPARATOR})${SEPARATOR}${EFFECT_TERM}` +
    `|${EFFECT_TERM}${SEPARATOR}(?:無し|なし|无|無|抜き|抜|(?<![a-z])(?:off|none|removed)(?![a-z]))`,
    'i',
);
const WITH_EFFECTS = new RegExp(EFFECT_TERM, 'i');

// A closer explicit marker overrides an inherited folder marker.
function getAudioEffectState(name, inherited = true) {
    const normalized = String(name || '').normalize('NFKC');
    if (WITHOUT_EFFECTS.test(normalized)) return false;
    if (WITH_EFFECTS.test(normalized)) return true;
    return inherited;
}

module.exports = { getAudioEffectState };
