"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = normalize;
const strftime_1 = __importDefault(require("./strftime"));
const utils_1 = require("../../filesystem/utils");
function joinNameAndId(names, ids) {
    if (names === null || ids === null)
        return [];
    const nameArr = (0, utils_1.ensureIsJsonObject)(names);
    const idArr = (0, utils_1.ensureIsJsonObject)(ids);
    return idArr.map((id, index) => ({
        id,
        name: nameArr[index],
    }));
}
function normalize(works, options = {}) {
    return works.map((record) => {
        record.nsfw = record.nsfw == null ? null : Boolean(record.nsfw);
        record.circle = (0, utils_1.ensureIsJsonObject)(record.circleObj);
        record.rate_count_detail = JSON.parse(record.rate_count_detail);
        record.rank = record.rank ? JSON.parse(record.rank) : null;
        record.vas = joinNameAndId(record.vaNames, record.vaIds);
        record.tags = joinNameAndId(record.tagNames, record.tagIds);
        record.relatedWorks = joinNameAndId(record.related_work_titles, record.related_work_ids);
        if (Object.prototype.hasOwnProperty.call(record, "state")) {
            record.state = (0, utils_1.ensureIsJsonObject)(record.state);
            record.play_updated_at = (0, strftime_1.default)('%F', record.play_updated_at);
        }
        if (Object.prototype.hasOwnProperty.call(record, "review_updated_at")) {
            record.review_updated_at = (0, strftime_1.default)('%F %H:%M:%S', record.review_updated_at);
        }
        delete record.circleObj;
        delete record.vaObj;
        delete record.tagObj;
        delete record.relatedWorkObj;
        if (options.dateOnly && record.updated_at) {
            record.updated_at = (0, strftime_1.default)('%F', record.updated_at);
        }
        const parsedMemo = record.memo ? (0, utils_1.ensureIsJsonObject)(record.memo) : {};
        const durationMap = parsedMemo.duration || {};
        const totalDuration = Object.values(durationMap).reduce((acc, x) => acc + x, 0);
        record.memo = {
            duration: durationMap,
            totalDuration: totalDuration,
        };
        return record;
    });
}
