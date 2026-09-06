"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.circleIdSplitter = exports.CIRCLE_ID_TYPE_TO_NUMBER = exports.CIRCLE_ID_TYPE_LIST = exports.idSplitter = exports.ID_TYPE_TO_NUMBER = exports.ID_TYPE_LIST = void 0;
exports.getIdType = getIdType;
exports.getIdDigit = getIdDigit;
exports.getIdDigitFromString = getIdDigitFromString;
exports.formatID = formatID;
exports.idNumberToCode = idNumberToCode;
exports.codeToIdNumber = codeToIdNumber;
exports.getIDTypeString = getIDTypeString;
exports.circleCodeToId = circleCodeToId;
exports.isCustomCode = isCustomCode;
exports.getMinCustomNumber = getMinCustomNumber;
exports.getMaxCustomNumber = getMaxCustomNumber;
exports.isValidWorkId = isValidWorkId;
exports.ID_TYPE_LIST = ["RJ", "BJ", "VJ", "CC"];
exports.ID_TYPE_TO_NUMBER = exports.ID_TYPE_LIST.reduce((d, e) => (d[e] = exports.ID_TYPE_LIST.indexOf(e), d), {});
exports.idSplitter = 1e12;
function getIdType(id) {
    const t = typeof id;
    switch (t) {
        case "string":
            return id.substring(0, 2);
        case "number":
            return Math.floor(id / exports.idSplitter);
        default:
            throw new Error(`get id type failed, ${id} is unsupported type ${t}`);
    }
}
function getIdDigit(id) {
    return Math.floor(id % exports.idSplitter);
}
function getIdDigitFromString(code) {
    return code.substring(2);
}
function formatID(idDigit) {
    if (idDigit >= 1000000) {
        return `0${idDigit}`.slice(-8);
    }
    else {
        return `000000${idDigit}`.slice(-6);
    }
}
function idNumberToCode(id) {
    const parsedId = parseInt(id);
    const idDigit = getIdDigit(parsedId);
    const idType = getIdType(parsedId);
    const idPrefix = exports.ID_TYPE_LIST[idType];
    return `${idPrefix}${formatID(idDigit)}`;
}
function codeToIdNumber(code) {
    const upcode = code.toUpperCase();
    const idType = getIdType(upcode);
    const digits = parseInt(getIdDigitFromString(upcode));
    const n = exports.ID_TYPE_TO_NUMBER[idType] * exports.idSplitter + digits;
    return n;
}
function getIDTypeString(idNumberOrCode) {
    const idType = getIdType(idNumberOrCode);
    if (typeof idType === 'number') {
        return exports.ID_TYPE_LIST[idType];
    }
    else {
        return idType;
    }
}
exports.CIRCLE_ID_TYPE_LIST = ["RG", "BG", "VG"];
exports.CIRCLE_ID_TYPE_TO_NUMBER = exports.CIRCLE_ID_TYPE_LIST.reduce((d, e) => (d[e] = exports.CIRCLE_ID_TYPE_LIST.indexOf(e), d), {});
exports.circleIdSplitter = 1000 * 1000 * 1000;
function circleCodeToId(code) {
    const upperCode = code.toUpperCase();
    for (const type of exports.CIRCLE_ID_TYPE_LIST) {
        if (upperCode.startsWith(type)) {
            const idTypeNumber = exports.CIRCLE_ID_TYPE_TO_NUMBER[type];
            return exports.circleIdSplitter * idTypeNumber + parseInt(upperCode.replace(type, ""));
        }
    }
    throw new Error(`unknown circle code: ${code}, which is not started from ${exports.CIRCLE_ID_TYPE_LIST}`);
}
function isCustomCode(code) {
    return code.startsWith("CC");
}
function getMinCustomNumber() {
    return exports.idSplitter * exports.ID_TYPE_TO_NUMBER["CC"] + 1;
}
function getMaxCustomNumber() {
    return exports.idSplitter * (exports.ID_TYPE_TO_NUMBER["CC"] + 1) - 1;
}
function isValidWorkId(id) {
    return getIdDigit(id) != 0;
}
