"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.detectSubtitleFileLanguage = detectSubtitleFileLanguage;
exports.detectSubtitleLanguage = detectSubtitleLanguage;
exports.isPreferredSubtitleLanguage = isPreferredSubtitleLanguage;
exports.normalizeSubtitleLanguage = normalizeSubtitleLanguage;
exports.stripSubtitleLanguageSuffix = stripSubtitleLanguageSuffix;

const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");
const jschardet = require("jschardet");

const supportedLanguages = new Set(["auto", "zh", "ja", "en", "ko"]);
const languageSuffixPattern = /(?:^|[._\-\s[(])(zh(?:[-_](?:cn|tw|hans|hant))?|chs|cht|cn|sc|tc|chinese|ja|jp|jpn|japanese|en|eng|english|ko|kor|korean)(?=$|[._\-\s\])])/i;

function normalizeSubtitleLanguage(value, fallback = "auto") {
    const normalized = String(value || "").trim().toLowerCase();
    return supportedLanguages.has(normalized) ? normalized : fallback;
}

function languageFromFileName(fileName) {
    const stem = path.parse(String(fileName || "")).name;
    const matches = [...stem.matchAll(new RegExp(languageSuffixPattern.source, "gi"))];
    if (matches.length === 0)
        return null;
    const token = matches[matches.length - 1][1].toLowerCase();
    if (/^(?:zh|chs|cht|cn|sc|tc|chinese)/.test(token))
        return "zh";
    if (/^(?:ja|jp|jpn|japanese)/.test(token))
        return "ja";
    if (/^(?:en|eng|english)/.test(token))
        return "en";
    if (/^(?:ko|kor|korean)/.test(token))
        return "ko";
    return null;
}

function stripSubtitleLanguageSuffix(value) {
    return String(value || "")
        .replace(new RegExp(`${languageSuffixPattern.source}$`, "i"), "")
        .replace(/[._\-\s[(]+$/, "");
}

function subtitleTextOnly(content) {
    return String(content || "")
        .replace(/^WEBVTT.*$/gim, " ")
        .replace(/^\s*\d+\s*$/gm, " ")
        .replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?[,.]\d{1,3}\s*-->.*$/gm, " ")
        .replace(/^\s*(?:\[(?:Script Info|V4\+? Styles|Events)\]|Format:|Style:|Comment:).*$/gim, " ")
        .replace(/^\s*Dialogue:[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,/gim, "")
        .replace(/<[^>]+>|\{\\[^}]+\}|\[[^\]]+\]/g, " ");
}

function countMatches(text, pattern) {
    return (text.match(pattern) || []).length;
}

function detectSubtitleLanguage(content, fileName = "") {
    const text = subtitleTextOnly(content);
    const kanaCount = countMatches(text, /[\u3040-\u30ff\u31f0-\u31ff]/g);
    const hangulCount = countMatches(text, /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g);
    const hanCount = countMatches(text, /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g);
    const latinCount = countMatches(text, /[A-Za-z]/g);

    if (hangulCount >= 4 && hangulCount >= kanaCount && hangulCount >= hanCount * 0.2)
        return "ko";
    if (kanaCount >= 4 && kanaCount / Math.max(1, kanaCount + hanCount) >= 0.03)
        return "ja";
    if (hanCount >= 4)
        return "zh";
    if (latinCount >= 12)
        return "en";
    return languageFromFileName(fileName) || "und";
}

async function detectSubtitleFileLanguage(fileName) {
    const fileBuffer = await fs.promises.readFile(fileName);
    const charset = jschardet.detect(fileBuffer).encoding || "utf-8";
    return detectSubtitleLanguage(iconv.decode(fileBuffer, charset), path.basename(fileName));
}

function isPreferredSubtitleLanguage(language, preferredLanguage) {
    const preferred = normalizeSubtitleLanguage(preferredLanguage);
    return preferred === "auto" || language === preferred;
}
