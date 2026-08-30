"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fillNewCustomMetaInfo = exports.customWorkMetadata = exports.updatePlayHistroy = exports.getPlayHistroy = exports.deleteUserReview = exports.updateUserReview = exports.getWorksWithReviews = exports.deleteUser = exports.resetUserPassword = exports.updateUserPassword = exports.createUser = exports.getMetadata = exports.getLabels = exports.updateWorkLyricStatus = exports.updateWorkMetadata = exports.getWorksByKeyWord = exports.getWorksBy = exports.removeWork = exports.getWorkMetadata = exports.insertWorkMetadata = exports.knex = void 0;
exports.updateWorkLocalLyricStatus = updateWorkLocalLyricStatus;
exports.deletePlayHistroy = deletePlayHistroy;
exports.nsfwFilter = nsfwFilter;
exports.lyricFilter = lyricFilter;
exports.getWorkMemo = getWorkMemo;
exports.setWorkMemo = setWorkMemo;
exports.advanceSearch = advanceSearch;
exports.uncensorDlsiteTags = uncensorDlsiteTags;
exports.checkDatabaseExists = checkDatabaseExists;
exports.countQuery = countQuery;
exports.fixDatabase = fixDatabase;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const idConverter_1 = require("../filesystem/idConverter");
const dlsite_tag_uncensored_lut_1 = require("../scraper/dlsite_tag_uncensored_lut");
const utils_1 = require("../filesystem/utils");
const knexfile_1 = require("./knexfile");
const utils_2 = require("../scraper/utils");
const knexfile_2 = require("./knexfile");
const mysql2_1 = __importDefault(require("mysql2"));
const knex_1 = __importDefault(require("knex"));
const knex = (0, knex_1.default)(knexfile_2.knexConnections.development);
exports.knex = knex;
function mysqlCheckTableExists(connection, tableName) {
    return new Promise((resolve, reject) => {
        const query = `show tables like ?`;
        connection.query(query, [tableName], (err, results) => {
            if (err) {
                console.error('Error executing query:', err);
                reject(err);
                return;
            }
            if (results.length > 0) {
                console.log(`Table "${tableName}" exists.`);
                resolve(true);
            }
            else {
                console.log(`Table "${tableName}" does not exist.`);
                resolve(false);
            }
        });
    });
}
async function checkDatabaseExists() {
    console.log('checkDatabaseExists: ', config_1.config.sqliteType);
    if (config_1.config.sqliteType.includes("sqlite3")) {
        const sqlitePath = path_1.default.join(config_1.config.databaseFolderDir, 'db.sqlite3');
        const exists = fs_1.default.existsSync(sqlitePath);
        console.log('checkDatabaseExists sqlite file path: : ', sqlitePath, ' exists: ', exists);
        return exists;
    }
    else if (config_1.config.sqliteType.includes("mysql")) {
        const connection = mysql2_1.default.createConnection(config_1.config.mysqlConnection);
        const tableName = 't_work';
        const exists = await mysqlCheckTableExists(connection, tableName);
        connection.end();
        return exists;
    }
}
async function fixDatabase() {
    try {
        const zeroIdCircle = await knex('t_circle').where('id', 0).first();
        if (zeroIdCircle) {
            const sameNameCircle = await knex('t_circle').where('name', zeroIdCircle.name).andWhereNot('id', zeroIdCircle.id).first();
            if (sameNameCircle) {
                await knex('t_work').where('circle_id', 0).update({ circle_id: sameNameCircle.id });
                await knex('t_circle').where('id', 0).del();
            }
            console.log(`修复circle id 0 bug`);
        }
    }
    catch (error) {
        console.error('修复数据库失败', error);
        throw error;
    }
}
const insertWorkMetadata = (work) => knex.transaction(trx => trx.raw(trx('t_circle')
    .insert({
    id: work.circle.id,
    name: work.circle.name,
}).toString().replace('insert', knexfile_1.dbSpecifiedFunctionName.insertOrIgnore))
    .then(() => trx('t_work')
    .insert({
    id: work.id,
    root_folder: work.rootFolderName,
    dir: work.dir,
    title: work.title,
    circle_id: work.circle.id,
    nsfw: work.nsfw,
    release: work.release,
    dl_count: work.dl_count,
    price: work.price,
    review_count: work.review_count,
    rate_count: work.rate_count,
    rate_average_2dp: work.rate_average_2dp,
    rate_count_detail: JSON.stringify(work.rate_count_detail),
    rank: work.rank ? JSON.stringify(work.rank) : null,
    lyric_status: work.lyric_status,
    original_work_id: work.original_work_id,
}))
    .then(() => {
    const promises = [];
    for (let i = 0; i < work.tags.length; i += 1) {
        promises.push(trx.raw(trx('t_tag')
            .insert({
            id: work.tags[i].id,
            name: work.tags[i].name,
        }).toString().replace('insert', knexfile_1.dbSpecifiedFunctionName.insertOrIgnore))
            .then(() => trx('r_tag_work')
            .insert({
            tag_id: work.tags[i].id,
            work_id: work.id,
        })));
    }
    for (let i = 0; i < work.vas.length; i += 1) {
        promises.push(trx.raw(trx('t_va')
            .insert({
            id: work.vas[i].id,
            name: work.vas[i].name,
        }).toString().replace('insert', knexfile_1.dbSpecifiedFunctionName.insertOrIgnore))
            .then(() => trx.raw(trx('r_va_work')
            .insert({
            va_id: work.vas[i].id,
            work_id: work.id,
        }).toString().replace('insert', knexfile_1.dbSpecifiedFunctionName.insertOrIgnore))));
    }
    return Promise.all(promises)
        .then(() => trx);
}));
exports.insertWorkMetadata = insertWorkMetadata;
const updateWorkMetadata = (work, options = {}) => knex.transaction(async (trx) => {
    await trx('t_work')
        .where('id', '=', work.id)
        .update({
        dl_count: work.dl_count,
        price: work.price,
        review_count: work.review_count,
        rate_count: work.rate_count,
        rate_average_2dp: work.rate_average_2dp,
        rate_count_detail: JSON.stringify(work.rate_count_detail),
        rank: work.rank ? JSON.stringify(work.rank) : null,
        original_work_id: work.original_work_id,
    });
    if (options.includeVA || options.refreshAll) {
        await trx('r_va_work').where('work_id', work.id).del();
        for (const va of work.vas) {
            await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO t_va(id, name) VALUES (?, ?)`, [va.id, va.name]);
            await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO r_va_work(va_id, work_id) VALUES (?, ?)`, [va.id, work.id]);
        }
    }
    if (options.includeTags || options.refreshAll) {
        if (options.purgeTags) {
            await trx('r_tag_work').where('work_id', work.id).del();
        }
        for (const tag of work.tags) {
            await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO t_tag(id, name) VALUES (?, ?)`, [tag.id, tag.name]);
            await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO r_tag_work(tag_id, work_id) VALUES (?, ?)`, [tag.id, work.id]);
        }
    }
    if (options.includeNSFW) {
        await trx('t_work')
            .where('id', '=', work.id)
            .update({
            nsfw: work.nsfw
        });
    }
    if (options.refreshAll) {
        await trx.raw(trx('t_circle')
            .insert({
            id: work.circle.id,
            name: work.circle.name,
        })
            .toString()
            .replace('insert', knexfile_1.dbSpecifiedFunctionName.insertOrIgnore));
        await trx('t_work')
            .where('id', '=', work.id)
            .update({
            nsfw: work.nsfw,
            title: work.title,
            release: work.release,
            circle_id: work.circle.id,
        });
    }
});
exports.updateWorkMetadata = updateWorkMetadata;
const customWorkMetadata = (workId, someMetadata) => knex.transaction(async (trx) => {
    const hasTitle = Object.prototype.hasOwnProperty.call(someMetadata, 'title') && Boolean(someMetadata.title);
    const hasTags = Object.prototype.hasOwnProperty.call(someMetadata, 'tags') && Boolean(someMetadata.tags);
    const hasVas = Object.prototype.hasOwnProperty.call(someMetadata, 'vas') && Boolean(someMetadata.vas);
    const hasCircle = Object.prototype.hasOwnProperty.call(someMetadata, 'circle') && Boolean(someMetadata.circle);
    if (hasTitle) {
        await trx('t_work').where('id', '=', workId).update({ title: someMetadata.title });
    }
    if (hasTags) {
        await trx('r_tag_work').where('work_id', workId).del();
        for (const tag of someMetadata.tags) {
            if (tag.id === 0) {
                const result = await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO t_tag(id, name) VALUES (
          CASE 
            WHEN (SELECT MIN(id) FROM t_tag) IS NULL THEN -1  -- 如果表为空，插入 -1
            WHEN (SELECT MIN(id) FROM t_tag) > 0 THEN -1  -- 如果最小值大于0，插入 -1
            ELSE (SELECT MIN(id) FROM t_tag) - 1  -- 否则插入最小值减一
          END,
          ?
        )
        RETURNING id; -- knex可能版本太老没有returning()能用，只能在sql里手动return了
        `, [tag.name]);
                tag.id = result[0] && result[0].id;
            }
            else {
                await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO t_tag(id, name) VALUES (?, ?)`, [tag.id, tag.name]);
            }
            await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO r_tag_work(tag_id, work_id) VALUES (?, ?)`, [tag.id, workId]);
        }
    }
    if (hasVas) {
        await trx('r_va_work').where('work_id', workId).del();
        for (const va of someMetadata.vas) {
            if (Number(va.id) === 0)
                va.id = (0, utils_2.nameToUUID)(va.name);
            await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO t_va(id, name) VALUES (?, ?)`, [va.id, va.name]);
            await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO r_va_work(va_id, work_id) VALUES (?, ?)`, [va.id, workId]);
        }
    }
    if (hasCircle) {
        const circle = someMetadata.circle;
        if (circle.id === 0) {
            const result = await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO t_circle(id, name) VALUES (
        CASE 
          WHEN (SELECT MIN(id) FROM t_circle) IS NULL THEN -1  -- 如果表为空，插入 -1
          WHEN (SELECT MIN(id) FROM t_circle) > 0 THEN -1  -- 如果最小值大于0，插入 -1
          ELSE (SELECT MIN(id) FROM t_circle) - 1  -- 否则插入最小值减一
        END,
        ?
      )
      RETURNING id; -- knex可能版本太老没有returning()能用，只能在sql里手动return了
      `, [circle.name]);
            circle.id = result[0] && result[0].id;
            console.log("insert new circle: ", circle);
        }
        else {
            await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO t_circle(id, name) VALUES (?, ?)`, [circle.id, circle.name]);
            console.log("exists circle: ", circle);
        }
        console.log("update circle data");
        await trx('t_work')
            .where('id', '=', workId)
            .update({
            circle_id: circle.id,
        });
    }
    if (hasTitle || hasTags || hasVas || hasCircle) {
        await trx('t_work').where('id', '=', workId).update({ is_custom_meta: 1 });
    }
});
exports.customWorkMetadata = customWorkMetadata;
const fillNewCustomMetaInfo = (someMetadata) => knex.transaction(async (trx) => {
    const existingRow = await trx('t_circle').where("name", "=", someMetadata.circle.name).first();
    if (existingRow) {
        someMetadata.circle.id = existingRow.id;
        console.log("existing row");
    }
    else {
        let minId;
        const minIdRow = await trx('t_circle').min('id as minId').first();
        console.log("new minIdRow = ", minIdRow);
        if (!minIdRow) {
            minId = -1;
            console.log("no circle");
        }
        else if (minIdRow && minIdRow.minId > 0) {
            minId = -1;
            console.log("no custom circle");
        }
        else {
            minId = minIdRow.minId - 1;
            console.log("next custom circle");
        }
        console.log("insert new circle ", minId, someMetadata.circle.name);
        someMetadata.circle.id = minId;
        await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO t_circle(id, name) VALUES (?,?)`, [minId, someMetadata.circle.name]);
    }
    if (!(0, idConverter_1.isValidWorkId)(someMetadata.id)) {
        const result = await trx('t_work')
            .whereBetween('id', [(0, idConverter_1.getMinCustomNumber)(), (0, idConverter_1.getMaxCustomNumber)()])
            .orderBy('id', 'desc')
            .first();
        let newWorkId;
        if (result) {
            newWorkId = result.id + 1;
        }
        else {
            newWorkId = (0, idConverter_1.getMinCustomNumber)();
        }
        someMetadata.id = newWorkId;
    }
});
exports.fillNewCustomMetaInfo = fillNewCustomMetaInfo;
const updateWorkLyricStatus = (workId, new_status) => knex.transaction(async (trx) => {
    await trx('t_work')
        .where('id', '=', workId)
        .update({
        lyric_status: new_status,
    });
});
exports.updateWorkLyricStatus = updateWorkLyricStatus;
async function updateWorkLocalLyricStatus(isContainLocalLyric, currentStatus, workId) {
    let toStatus = currentStatus;
    if (isContainLocalLyric && !currentStatus.includes("local")) {
        toStatus = currentStatus.includes("ai") ? "ai_local" : "local";
    }
    else if (!isContainLocalLyric && currentStatus.includes("local")) {
        toStatus = currentStatus.includes("ai") ? "ai" : "";
    }
    if (toStatus !== currentStatus) {
        console.log('update local lyric status: ', workId, toStatus);
        await updateWorkLyricStatus(workId, toStatus);
        return true;
    }
    return false;
}
const getWorkMetadata = async (id, username) => {
    const ratingSubQuery = knex('t_review')
        .select(['t_review.work_id', 't_review.rating AS userRating', 't_review.review_text', 't_review.progress', "t_review.updated_at", 't_review.user_name'])
        .join('t_work', 't_work.id', 't_review.work_id')
        .where('t_review.user_name', username).as('userrate');
    const histroyQuery = knex('t_play_histroy')
        .select([
        't_play_histroy.work_id',
        't_play_histroy.state AS state',
        't_play_histroy.updated_at AS play_updated_at'
    ])
        .join('t_work', 't_work.id', 't_play_histroy.work_id')
        .where('t_play_histroy.user_name', "=", username).as('histroy');
    let query = () => knex('staticMetadata')
        .select(['staticMetadata.*', 'userrate.userRating', 'userrate.review_text', 'userrate.progress', 'userrate.updated_at', 'userrate.user_name', 'histroy.state', 'histroy.play_updated_at'])
        .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id')
        .leftJoin(histroyQuery, 'histroy.work_id', 'staticMetadata.id')
        .where('id', '=', id);
    const work = await query();
    if (work.length === 0)
        throw new Error(`There is no work with id ${id} in the database.`);
    return work;
};
exports.getWorkMetadata = getWorkMetadata;
const cleanupOrphans = async (trxProvider, circle, tags, vas) => {
    const trx = await trxProvider();
    const getCount = (tableName, colName, colValue) => new Promise((resolveCount, rejectCount) => {
        trx(tableName)
            .select(colName)
            .where(colName, '=', colValue)
            .count()
            .first()
            .then((res) => res['count(*)'])
            .then((count) => resolveCount(count))
            .catch((err) => rejectCount(err));
    });
    const promises = [];
    promises.push(new Promise((resolveCircle, rejectCircle) => {
        getCount('t_work', 'circle_id', circle)
            .then((count) => {
            if (count === 0) {
                trx('t_circle')
                    .del()
                    .where('id', '=', circle)
                    .then(() => resolveCircle())
                    .catch((err) => rejectCircle(err));
            }
            else {
                resolveCircle();
            }
        });
    }));
    for (let i = 0; i < tags.length; i += 1) {
        const tag = tags[i];
        const count = await getCount('r_tag_work', 'tag_id', tag);
        if (count === 0) {
            promises.push(trx('t_tag')
                .delete()
                .where('id', '=', tag));
        }
    }
    for (let i = 0; i < vas.length; i += 1) {
        const va = vas[i];
        const count = await getCount('r_va_work', 'va_id', va);
        if (count === 0) {
            promises.push(trx('t_va')
                .delete()
                .where('id', '=', va));
        }
    }
    await Promise.all(promises);
};
const removeWork = async (id, trxProvider) => {
    const trx = await trxProvider();
    const circle = await trx('t_work').select('circle_id').where('id', '=', id).first();
    const tags = await trx('r_tag_work').select('tag_id').where('work_id', '=', id);
    const vas = await trx('r_va_work').select('va_id').where('work_id', '=', id);
    await trx('t_play_histroy').del().where('work_id', '=', id);
    await trx('r_tag_work').del().where('work_id', '=', id);
    await trx('r_va_work').del().where('work_id', '=', id);
    await trx('t_review').del().where('work_id', '=', id);
    await trx('t_work').del().where('id', '=', id);
    await cleanupOrphans(trxProvider, circle.circle_id, tags.map((tag) => tag.tag_id), vas.map((va) => va.va_id));
};
exports.removeWork = removeWork;
function nsfwFilter(nsfw, knexQuery) {
    switch (nsfw) {
        case 1: return knexQuery.where('nsfw', '=', false);
        case 2: return knexQuery.where('nsfw', '=', true);
        default: return knexQuery;
    }
}
function lyricFilter(lyricFilter, knexQuery) {
    const raw = lyricFilter
        .trim()
        .split("_")
        .filter((x) => x.length > 0)
        .filter((x) => ["local", "no"].includes(x))
        .map((x) => x === "no"
        ? `lyric_status = ''`
        : `lyric_status LIKE '%${x}%'`)
        .join(" OR ");
    let query = knexQuery;
    if (raw.length > 0) {
        query = knexQuery.whereRaw(`(${raw})`);
    }
    return query;
}
const getWorksBy = (username, field, id) => {
    let workIdQuery;
    const ratingSubQuery = knex('t_review')
        .select(['t_review.work_id', 't_review.rating'])
        .join('t_work', 't_work.id', 't_review.work_id')
        .where('t_review.user_name', username).as('userrate');
    switch (field) {
        case 'circle':
            return knex('staticMetadata').select(['staticMetadata.*', 'userrate.rating AS userRating'])
                .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id')
                .where('circle_id', '=', id);
        case 'tag':
            workIdQuery = knex('r_tag_work').select('work_id').where('tag_id', '=', id);
            return knex('staticMetadata').select(['staticMetadata.*', 'userrate.rating AS userRating'])
                .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id')
                .where('id', 'in', workIdQuery);
        case 'va':
            workIdQuery = knex('r_va_work').select('work_id').where('va_id', '=', id);
            return knex('staticMetadata').select(['staticMetadata.*', 'userrate.rating AS userRating'])
                .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id')
                .where('id', 'in', workIdQuery);
        default:
            return knex('staticMetadata').select(['staticMetadata.*', 'userrate.rating AS userRating'])
                .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id');
    }
};
exports.getWorksBy = getWorksBy;
const AdvanceSearchCondType = {
    UNKNOWN: 0,
    FUZZY: 1,
    VA: 2,
    TAG: 3,
    CIRCLE: 4,
    CODE: 5,
};
function advanceSearch(conditions, username) {
    const intersectQueryList = [];
    for (let cond of conditions) {
        const data = cond.d;
        if (cond.t === AdvanceSearchCondType.FUZZY) {
            const circleIdQuery = knex('t_circle').select('id').where('name', 'like', `%${data}%`);
            const tagIdQuery = knex('t_tag').select('id').where('name', 'like', `%${data}%`);
            const vaIdQuery = knex('t_va').select('id').where('name', 'like', `%${data}%`);
            const workIdQuery = knex('t_work').select('id as work_id')
                .where('title', 'like', `%${data}%`)
                .orWhere('circle_id', 'in', circleIdQuery)
                .union([
                knex('r_tag_work').select('work_id').where('tag_id', 'in', tagIdQuery),
                knex('r_va_work').select('work_id').where('va_id', 'in', vaIdQuery),
            ]);
            intersectQueryList.push(workIdQuery);
        }
        else if (cond.t === AdvanceSearchCondType.TAG) {
            const workIdQuery = knex('r_tag_work').select('work_id').where('tag_id', '=', data);
            intersectQueryList.push(workIdQuery);
        }
        else if (cond.t === AdvanceSearchCondType.VA) {
            const workIdQuery = knex('r_va_work').select('work_id').where('va_id', '=', data);
            intersectQueryList.push(workIdQuery);
        }
        else if (cond.t === AdvanceSearchCondType.CIRCLE) {
            const workIdQuery = knex('t_work').select('id as work_id').where('circle_id', '=', data);
            intersectQueryList.push(workIdQuery);
        }
        else if (cond.t === AdvanceSearchCondType.CODE) {
            const searchCode = data;
            let workIdQuery = knex('t_work').select('id as work_id');
            if (/^(RJ|BJ|VJ|CC)\d+/i.test(searchCode)) {
                const idNumber = (0, idConverter_1.codeToIdNumber)(searchCode);
                workIdQuery = workIdQuery.where('id', '=', idNumber);
            }
            else if (/^\d+/.test(searchCode)) {
                const idNumber = parseInt(searchCode);
                workIdQuery = workIdQuery.where('id', '=', idNumber);
                idConverter_1.ID_TYPE_LIST.forEach((_, idTypeNumber) => {
                    if (idTypeNumber === 0)
                        return;
                    workIdQuery = workIdQuery.orWhere('id', '=', idTypeNumber * idConverter_1.idSplitter + idNumber);
                });
            }
            else {
                continue;
            }
            intersectQueryList.push(workIdQuery);
        }
    }
    const ratingSubQuery = knex('t_review')
        .select(['t_review.work_id', 't_review.rating'])
        .join('t_work', 't_work.id', 't_review.work_id')
        .where('t_review.user_name', username).as('userrate');
    let query = knex('staticMetadata').select(['staticMetadata.*', 'userrate.rating AS userRating'])
        .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id');
    const originalWorkIds = intersectQueryList.reduce((accQuery, idQuery) => accQuery.andWhere("id", "in", idQuery), knex('t_work').select('original_work_id'));
    const relatedWorkIds = query.andWhere("original_work_id", "in", originalWorkIds);
    return relatedWorkIds;
}
const getWorksByKeyWord = (username = 'admin', keyword) => {
    const ratingSubQuery = knex('t_review')
        .select(['t_review.work_id', 't_review.rating'])
        .join('t_work', 't_work.id', 't_review.work_id')
        .where('t_review.user_name', username).as('userrate');
    const codeRegex = /(RJ|BJ|VJ)?(\d{6,8})/i;
    const searchCode = keyword.match(codeRegex) ? keyword.match(codeRegex)[0].toUpperCase() : '';
    if (searchCode) {
        let query = knex('staticMetadata').select(['staticMetadata.*', 'userrate.rating AS userRating'])
            .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id');
        if (/^[a-zA-Z]{2}/.test(searchCode)) {
            const idNumber = (0, idConverter_1.codeToIdNumber)(searchCode);
            query = query.where('id', '=', idNumber);
        }
        else {
            const idNumber = parseInt(searchCode);
            query = query.where('id', '=', idNumber);
            idConverter_1.ID_TYPE_LIST.forEach((_, idTypeNumber) => {
                if (idTypeNumber === 0)
                    return;
                query = query.orWhere('id', '=', idTypeNumber * idConverter_1.idSplitter + idNumber);
            });
        }
        return query;
    }
    const circleIdQuery = knex('t_circle').select('id').where('name', 'like', `%${keyword}%`);
    const tagIdQuery = knex('t_tag').select('id').where('name', 'like', `%${keyword}%`);
    const vaIdQuery = knex('t_va').select('id').where('name', 'like', `%${keyword}%`);
    const workIdQuery = knex('r_tag_work').select('work_id').where('tag_id', 'in', tagIdQuery).union([
        knex('r_va_work').select('work_id').where('va_id', 'in', vaIdQuery)
    ]);
    return knex('staticMetadata').select(['staticMetadata.*', 'userrate.rating AS userRating'])
        .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id')
        .where('title', 'like', `%${keyword}%`)
        .orWhere('circle_id', 'in', circleIdQuery)
        .orWhere('id', 'in', workIdQuery);
};
exports.getWorksByKeyWord = getWorksByKeyWord;
const getLabels = (field) => {
    if (field === 'circle') {
        return knex('t_work')
            .join(`t_${field}`, `${field}_id`, '=', `t_${field}.id`)
            .select(`t_${field}.id`, 'name')
            .groupBy(`${field}_id`)
            .count(`${field}_id as count`);
    }
    else if (field === 'tag' || field === 'va') {
        return knex(`r_${field}_work`)
            .join(`t_${field}`, `${field}_id`, '=', 'id')
            .select('id', 'name')
            .groupBy(`${field}_id`)
            .count(`${field}_id as count`);
    }
};
exports.getLabels = getLabels;
const createUser = (user) => knex.transaction(trx => trx('t_user')
    .where('name', '=', user.name)
    .first()
    .then((res) => {
    if (res) {
        throw new Error(`用户 ${user.name} 已存在.`);
    }
    return trx('t_user')
        .insert(user);
}));
exports.createUser = createUser;
const updateUserPassword = (user, newPassword) => knex.transaction(trx => trx('t_user')
    .where('name', '=', user.name)
    .first()
    .then((res) => {
    if (!res) {
        throw new Error('用户名或密码错误.');
    }
    return trx('t_user')
        .where('name', '=', user.name)
        .update({
        password: newPassword
    });
}));
exports.updateUserPassword = updateUserPassword;
const resetUserPassword = (user) => knex.transaction(trx => trx('t_user')
    .where('name', '=', user.name)
    .first()
    .then((res) => {
    if (!res) {
        throw new Error('用户名错误.');
    }
    return trx('t_user')
        .where('name', '=', user.name)
        .update({
        password: 'password'
    });
}));
exports.resetUserPassword = resetUserPassword;
const deleteUser = (users) => knex.transaction(trx => trx('t_user')
    .where('name', 'in', users.map((user) => user.name))
    .del());
exports.deleteUser = deleteUser;
const updateUserReview = async (username, workid, rating, review_text = '', progress = '', starOnly = true, progressOnly = false) => knex.transaction(async (trx) => {
    if (starOnly) {
        await trx.raw('UPDATE t_review SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE user_name = ? AND work_id = ?;', [rating, username, workid]);
        await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO t_review (user_name, work_id, rating) VALUES (?, ?, ?);`, [username, workid, rating]);
    }
    else if (progressOnly) {
        await trx.raw('UPDATE t_review SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE user_name = ? AND work_id = ?;', [progress, username, workid]);
        await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO t_review (user_name, work_id, progress) VALUES (?, ?, ?);`, [username, workid, progress]);
    }
    else {
        await trx.raw('UPDATE t_review SET rating = ?, review_text = ?, progress = ?, updated_at = CURRENT_TIMESTAMP WHERE user_name = ? AND work_id = ?;', [rating, review_text, progress, username, workid]);
        await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO t_review (user_name, work_id, rating, review_text, progress) VALUES (?, ?, ?, ?, ?);`, [username, workid, rating, review_text, progress]);
    }
});
exports.updateUserReview = updateUserReview;
const deleteUserReview = (username, workid) => knex.transaction(trx => trx('t_review')
    .where('user_name', '=', username)
    .andWhere('work_id', '=', workid)
    .del());
exports.deleteUserReview = deleteUserReview;
const getWorksWithReviews = async ({ username = '', limit = 1000, offset = 0, orderBy = 'release', sortOption = 'desc', filter } = {}) => {
    let works;
    let totalCount;
    const ratingSubQuery = knex('t_review')
        .select(['t_review.work_id', 't_review.rating AS userRating', 't_review.review_text', 't_review.progress', 't_review.updated_at as review_updated_at', 't_review.user_name'])
        .join('t_work', 't_work.id', 't_review.work_id')
        .where('t_review.user_name', username).as('userrate');
    if (orderBy == "updated_at") {
        orderBy = "review_updated_at";
    }
    let query = () => knex('staticMetadata')
        .select(['staticMetadata.*', 'userrate.userRating', 'userrate.review_text', 'userrate.progress', 'review_updated_at', 'userrate.user_name'])
        .join(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id')
        .orderBy(orderBy, sortOption).orderBy([{ column: 'release', order: 'desc' }, { column: 'id', order: 'desc' }]);
    if (filter) {
        totalCount = await countQuery(query().where('progress', '=', filter), 'id');
        works = await query().where('progress', '=', filter).limit(limit).offset(offset);
    }
    else {
        totalCount = await countQuery(query(), 'id');
        works = await query().limit(limit).offset(offset);
    }
    return { works, totalCount };
};
exports.getWorksWithReviews = getWorksWithReviews;
const getPlayHistroy = async ({ username = '', sortOption = 'desc', limit = 1000, offset = 0 }) => {
    let works;
    let totalCount;
    const histroyQuery = knex('t_play_histroy')
        .select([
        't_play_histroy.work_id',
        't_play_histroy.state AS state',
        't_play_histroy.updated_at AS play_updated_at'
    ])
        .join('t_work', 't_work.id', 't_play_histroy.work_id')
        .where('t_play_histroy.user_name', "=", username).as('histroy');
    const query = () => knex('staticMetadata')
        .select(['staticMetadata.*', 'histroy.state', 'histroy.play_updated_at'])
        .join(histroyQuery, 'histroy.work_id', 'staticMetadata.id')
        .orderBy('play_updated_at', sortOption);
    totalCount = await countQuery(query(), 'id');
    works = await query().limit(limit).offset(offset);
    return { works, totalCount };
};
exports.getPlayHistroy = getPlayHistroy;
const updatePlayHistroy = async (username, work_id, state) => knex.transaction(async (trx) => {
    await trx.raw(`${knexfile_1.dbSpecifiedFunctionName.insertOrIgnore} INTO t_play_histroy (user_name, work_id, state) VALUES (?, ?, ?);`, [username, work_id, state]);
    await trx.raw('UPDATE t_play_histroy SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE user_name = ? AND work_id = ?;', [state, username, work_id]);
});
exports.updatePlayHistroy = updatePlayHistroy;
async function deletePlayHistroy(username, work_id) {
    await knex('t_play_histroy').select('*').where('work_id', '=', work_id).where('user_name', '=', username).first().del();
}
async function getPlaylists(username) {
    return knex('t_playlist')
        .leftJoin('t_playlist_item', 't_playlist.id', 't_playlist_item.playlist_id')
        .where('t_playlist.user_name', username)
        .groupBy('t_playlist.id', 't_playlist.user_name', 't_playlist.name', 't_playlist.created_at', 't_playlist.updated_at')
        .select('t_playlist.id', 't_playlist.name', 't_playlist.created_at', 't_playlist.updated_at')
        .count('t_playlist_item.id as item_count')
        .orderBy('t_playlist.updated_at', 'desc');
}
exports.getPlaylists = getPlaylists;
async function getPlaylist(username, playlistId) {
    const playlist = await knex('t_playlist')
        .select('id', 'name', 'created_at', 'updated_at')
        .where({ id: playlistId, user_name: username })
        .first();
    if (!playlist)
        return null;
    const items = await knex('t_playlist_item')
        .select('id', 'playlist_id', 'work_id', 'relative_path', 'title', 'work_title', 'position')
        .where('playlist_id', playlistId)
        .orderBy('position', 'asc')
        .orderBy('id', 'asc');
    return { playlist, items };
}
exports.getPlaylist = getPlaylist;
async function createPlaylist(username, name, items = []) {
    return knex.transaction(async (trx) => {
        const result = await trx('t_playlist').insert({ user_name: username, name });
        const playlistId = typeof result[0] === 'object' ? result[0].id : result[0];
        if (items.length > 0) {
            await trx('t_playlist_item').insert(items.map((item, position) => ({
                playlist_id: playlistId,
                work_id: item.work_id,
                relative_path: item.relative_path,
                title: item.title,
                work_title: item.work_title || '',
                position,
            })));
        }
        return playlistId;
    });
}
exports.createPlaylist = createPlaylist;
async function renamePlaylist(username, playlistId, name) {
    return knex('t_playlist')
        .where({ id: playlistId, user_name: username })
        .update({ name, updated_at: knex.fn.now() });
}
exports.renamePlaylist = renamePlaylist;
async function deletePlaylist(username, playlistId) {
    return knex('t_playlist').where({ id: playlistId, user_name: username }).del();
}
exports.deletePlaylist = deletePlaylist;
async function addPlaylistItems(username, playlistId, items) {
    return knex.transaction(async (trx) => {
        const playlist = await trx('t_playlist').select('id').where({ id: playlistId, user_name: username }).first();
        if (!playlist)
            return false;
        const lastItem = await trx('t_playlist_item').where('playlist_id', playlistId).max('position as position').first();
        const startPosition = lastItem && lastItem.position !== null ? Number(lastItem.position) + 1 : 0;
        await trx('t_playlist_item').insert(items.map((item, index) => ({
            playlist_id: playlistId,
            work_id: item.work_id,
            relative_path: item.relative_path,
            title: item.title,
            work_title: item.work_title || '',
            position: startPosition + index,
        })));
        await trx('t_playlist').where('id', playlistId).update({ updated_at: trx.fn.now() });
        return true;
    });
}
exports.addPlaylistItems = addPlaylistItems;
async function deletePlaylistItem(username, playlistId, itemId) {
    return knex.transaction(async (trx) => {
        const playlist = await trx('t_playlist').select('id').where({ id: playlistId, user_name: username }).first();
        if (!playlist)
            return false;
        const deleted = await trx('t_playlist_item').where({ id: itemId, playlist_id: playlistId }).del();
        if (deleted)
            await trx('t_playlist').where('id', playlistId).update({ updated_at: trx.fn.now() });
        return Boolean(deleted);
    });
}
exports.deletePlaylistItem = deletePlaylistItem;
async function reorderPlaylistItems(username, playlistId, itemIds) {
    return knex.transaction(async (trx) => {
        const playlist = await trx('t_playlist').select('id').where({ id: playlistId, user_name: username }).first();
        if (!playlist)
            return false;
        const rows = await trx('t_playlist_item').select('id').where('playlist_id', playlistId);
        const existingIds = rows.map(row => Number(row.id)).sort((a, b) => a - b);
        const requestedIds = itemIds.map(Number).sort((a, b) => a - b);
        if (existingIds.length !== requestedIds.length || existingIds.some((id, index) => id !== requestedIds[index]))
            return false;
        for (let position = 0; position < itemIds.length; position++) {
            await trx('t_playlist_item').where({ id: itemIds[position], playlist_id: playlistId }).update({ position });
        }
        await trx('t_playlist').where('id', playlistId).update({ updated_at: trx.fn.now() });
        return true;
    });
}
exports.reorderPlaylistItems = reorderPlaylistItems;
const getMetadata = ({ field = 'circle', id } = {}) => {
    const validFields = ['circle', 'tag', 'va'];
    if (!validFields.includes(field))
        throw new Error('无效的查询域');
    return knex(`t_${field}`)
        .select('*')
        .where('id', '=', id)
        .first();
};
exports.getMetadata = getMetadata;
async function getWorkMemo(work_id) {
    const work = await knex('t_work')
        .select('id', 'memo')
        .where('id', '=', work_id)
        .first();
    return (0, utils_1.ensureIsJsonObject)(work.memo);
}
async function setWorkMemo(work_id, memo) {
    await knex('t_work')
        .where('id', '=', work_id)
        .update({
        memo: JSON.stringify(memo)
    });
}
async function uncensorDlsiteTags() {
    const language = config_1.config.tagLanguage;
    for (let tagId in dlsite_tag_uncensored_lut_1.dlsite_tag_uncensored_lut) {
        const uncensorTagName = dlsite_tag_uncensored_lut_1.dlsite_tag_uncensored_lut[tagId][language].name;
        if (!uncensorTagName) {
            console.warn(`uncensor tag id[${tagId}], get name failed: ${uncensorTagName}, skip it`);
            continue;
        }
        console.log(`reset tag[${tagId}] name to ${uncensorTagName}`);
        await knex('t_tag').where('id', '=', tagId).update({
            name: uncensorTagName,
        });
    }
}
async function countQuery(query, column) {
    return (await knex.from(query.as("temp")).count(column, { as: "count" }))[0].count;
}
