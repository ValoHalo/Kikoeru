"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "kikoeru-works-page-"));
fs.mkdirSync(path.join(runtime, "config"));
fs.mkdirSync(path.join(runtime, "sqlite"));
fs.writeFileSync(path.join(runtime, "config/config.json"), JSON.stringify({ sqliteType: process.env.KIKOERU_TEST_SQLITE_TYPE || "better-sqlite3" }));
process.env.KIKOERU_DATA_DIR = runtime;
process.env.FREEZE_CONFIG_FILE = "1";
const db = require("../../src/database/db");
const { createSchema } = require("../../src/database/schema");
const normalize = require("../../src/routes/utils/normalize").default;

test.before(async () => {
    await createSchema();
    await db.knex("t_user").insert([
        { name: "admin", password: "test", group: "administrator" },
        { name: "listener", password: "test", group: "user" },
    ]);
    await db.knex("t_circle").insert([{ id: 1, name: "Circle" }, { id: 2, name: "Other" }]);
    await db.knex("t_tag").insert([{ id: 1, name: "Tag" }, { id: 2, name: "Second tag" }]);
    await db.knex("t_va").insert([{ id: "a", name: "Voice" }, { id: "b", name: "Second voice" }]);
    await db.knex("t_work").insert(Array.from({ length: 8 }, (_, i) => ({
        id: 100001 + i, root_folder: "library", dir: `RJ${100001 + i}`, title: `Work ${i}`,
        circle_id: i % 2 + 1, nsfw: i % 2, release: `2026-09-0${i % 3 + 1}`,
        created_at: `2026-09-0${i + 1}`, lyric_status: i % 2 ? "local" : "",
        original_work_id: i < 3 ? 100001 : 100001 + i,
        price: i * 100, rate_average_2dp: i / 2, dl_count: i * 20, review_count: i,
        rate_count_detail: "[]", memo: JSON.stringify({ duration: { "track.mp3": 123 } }),
    })));
    await db.knex("r_tag_work").insert([
        { tag_id: 2, work_id: 100001 }, { tag_id: 1, work_id: 100001 }, { tag_id: 2, work_id: 100004 },
    ]);
    await db.knex("r_va_work").insert([
        { va_id: "b", work_id: 100001 }, { va_id: "a", work_id: 100001 }, { va_id: "b", work_id: 100005 },
    ]);
    await db.knex("t_review").insert([
        { user_name: "admin", work_id: 100001, rating: 2 },
        { user_name: "admin", work_id: 100004, rating: 5 },
        { user_name: "listener", work_id: 100001, rating: 4 },
    ]);
    await db.archiveWork("admin", 100003);
    await db.knex('t_work').where('id', 100001).update({ dir: '中文目录\\RJ100001' });
    for (const [id, memo] of [
        [100002, { mtime: { 'mp3\\右侧掏耳.mp3': 123 }, duration: { 'wav\\右侧掏耳.wav': 12 } }],
        [100003, { mtime: { '归档掏耳.mp3': 123 } }],
        [100004, { duration: { 'MP3/左侧掏耳.mp3': 12, '100%_! 特典.mp3': 10 } }],
        [100005, { mtime: { '时长未知/掏耳.mp3': 123 }, duration: {} }],
        [100006, { duration: { '100XYZ 特典.mp3': 10 }, note: '不要匹配这段掏耳说明' }],
    ]) {
        await db.knex('t_work').where('id', id).update({ memo: JSON.stringify(memo) });
    }
    await db.knex('t_work_collection').insert({ id: 1, user_name: 'admin', name: 'Selected' });
    await db.knex('t_work_collection_item').insert({ collection_id: 1, work_id: 100004, position: 0 });
});

test.after(async () => {
    await db.knex.destroy();
    fs.rmSync(runtime, { recursive: true, force: true });
});

async function comparePage(makeQuery, options = {}) {
    const settings = { order: "release", sort: "desc", seed: 7, offset: 0, limit: 3, ...options };
    const legacy = makeQuery(false);
    const totalCount = await db.countQuery(legacy.clone(), "id");
    if (settings.order === "random") legacy.orderBy(db.knex.raw("id % ?", settings.seed));
    else legacy.orderBy(settings.order, settings.sort).orderBy([
        { column: "release", order: "desc" }, { column: "id", order: "desc" },
    ]);
    const expected = normalize(await legacy.offset(settings.offset).limit(settings.limit));
    const result = await db.getWorksPage(makeQuery(true), settings);
    assert.equal(result.totalCount, totalCount);
    assert.deepEqual(normalize(result.works), expected);
}

test("paged metadata matches the view for every sort and both user scopes", async () => {
    for (const username of ["admin", "listener", ""]) {
        for (const order of ["release", "rating", "dl_count", "price", "rate_average_2dp", "review_count", "id", "created_at", "random"]) {
            for (const sort of ["asc", "desc"]) {
                await comparePage(idsOnly => db.getWorksBy(username, undefined, undefined, idsOnly), { order, sort, offset: 2 });
            }
        }
    }
});

test("filters, keyword search and advanced related-work search retain their results", async () => {
    for (const [field, id] of [["circle", 1], ["tag", 1], ["va", "b"]]) {
        await comparePage(idsOnly => db.getWorksBy("admin", field, id, idsOnly));
    }
    for (const nsfw of [0, 1, 2]) {
        for (const lyric of ["", "local", "no", "local_no"]) {
            await comparePage(idsOnly => db.lyricFilter(lyric, db.nsfwFilter(nsfw,
                db.getWorksBy("admin", undefined, undefined, idsOnly))));
        }
    }
    for (const keyword of ["Work", "Circle", "Tag", "Voice", "RJ100001", "100001", "missing"]) {
        await comparePage(idsOnly => db.getWorksByKeyWord("admin", keyword, idsOnly));
    }
    for (const conditions of [[], [{ t: 1, d: "Voice" }], [{ t: 3, d: 1 }], [{ t: 2, d: "a" }, { t: 4, d: 1 }], [{ t: 5, d: "RJ100001" }]]) {
        await comparePage(idsOnly => db.advanceSearch(conditions, "admin", idsOnly));
    }
    await comparePage(idsOnly => db.getWorksBy("admin", undefined, undefined, idsOnly), { offset: 100 });
});

test("random single-work selection keeps count and returns complete metadata", async () => {
    const query = db.getWorksBy("admin", undefined, undefined, true);
    const result = await db.getWorksPage(query, { order: "betterRandom" });
    assert.equal(result.totalCount, 7);
    assert.equal(result.works.length, 1);
    const expected = await db.getWorksBy("admin").where("id", result.works[0].id);
    assert.deepEqual(normalize(result.works), normalize(expected));
});

test('local directory and track search handles cached paths, legacy memos and literal punctuation', async () => {
    for (const [keyword, expected] of [
        ['中文目录', [100001]],
        ['掏耳', [100002, 100004, 100005]],
        ['MP3/右侧', [100002]],
        ['mp3\\左侧', [100004]],
        ['时长未知', [100005]],
        ['100%_!', [100004]],
        ['不要匹配这段', []],
        ["' OR 1=1 --", []],
    ]) {
        for (const idsOnly of [false, true]) {
            const rows = await db.getWorksByKeyWord('admin', keyword, idsOnly).orderBy('id');
            assert.deepEqual(rows.map(work => work.id), expected, keyword);
        }
        await comparePage(idsOnly => db.getWorksByKeyWord('admin', keyword, idsOnly), { limit: 1, offset: 1 });
    }
    const result = await db.getWorksPage(db.getWorksByKeyWord('admin', '掏耳', true), {
        order: 'id', sort: 'asc', offset: 0, limit: 2, searchKeywords: ['掏耳'],
    });
    assert.equal(result.totalCount, 3, 'multiple matching audio formats must not duplicate a work');
    const works = normalize(result.works);
    assert.deepEqual(works.map(work => work.searchMatch), [
        { type: 'track', name: 'mp3/右侧掏耳.mp3' },
        { type: 'track', name: 'MP3/左侧掏耳.mp3' },
    ]);
    assert.ok(works.every(work => !('dir' in work) && !('root_folder' in work)));
    const directory = await db.getWorksPage(db.getWorksByKeyWord('admin', '中文目录', true), {
        order: 'id', sort: 'asc', offset: 0, limit: 2, searchKeywords: ['中文目录'],
    });
    assert.deepEqual(directory.works[0].searchMatch, { type: 'directory', name: '中文目录/RJ100001' });
});

test('local search keeps archive, missing-file, collection and content filters', async () => {
    const query = () => db.getWorksByKeyWord('admin', '掏耳', true);
    const ids = async query => (await query.orderBy('id')).map(work => work.id);
    assert.deepEqual(await ids(db.getWorksByKeyWord('listener', '掏耳', true)), [100002, 100003, 100004, 100005]);
    assert.deepEqual(await ids(db.nsfwFilter(1, query())), [100005]);
    assert.deepEqual(await ids(db.lyricFilter('local', query())), [100002, 100004]);
    assert.deepEqual(await ids(db.collectionFilter(1, 'admin', query())), [100004]);
    assert.deepEqual(await ids(db.collectionFilter(1, 'listener', query())), []);
    await db.knex('t_work_availability').insert({ work_id: 100005 });
    try {
        assert.deepEqual(await ids(query()), [100002, 100004]);
        await comparePage(idsOnly => db.getWorksByKeyWord('admin', '掏耳', idsOnly));
    } finally {
        await db.knex('t_work_availability').where('work_id', 100005).del();
    }
});

test('advanced fuzzy search includes local names and retains related-work intersection semantics', async () => {
    const conditions = [{ t: 1, d: '掏耳' }, { t: 4, d: 2 }];
    const rows = await db.advanceSearch(conditions, 'admin', true).orderBy('id');
    assert.deepEqual(rows.map(work => work.id), [100001, 100002, 100004]);
    await comparePage(idsOnly => db.advanceSearch(conditions, 'admin', idsOnly), { offset: 1, limit: 1 });
});

test('unrelated missing or malformed memo data does not break local search', async () => {
    for (const memo of [null, '{invalid', 'null', JSON.stringify({ mtime: ['掏耳'], duration: '掏耳' })]) {
        await db.knex('t_work').where('id', 100008).update({ memo });
        const rows = await db.getWorksByKeyWord('admin', '掏耳', true).orderBy('id');
        assert.deepEqual(rows.map(work => work.id), [100002, 100004, 100005]);
    }
    await db.knex('t_work').where('id', 100008).update({ memo: JSON.stringify({ duration: { 'track.mp3': 123 } }) });
});

test("upgraded indexes match a fresh database and retain query results", async () => {
    const migration = require("../../src/database/migrations/20260905120000_index_work_list_queries");
    const readIndexes = () => db.knex("sqlite_master").select("name", "sql")
        .whereIn("name", ["t_work_release_id_index", "t_work_original_work_id_index",
            "r_tag_work_work_id_index", "r_va_work_work_id_index"]).orderBy("name");
    const fresh = await readIndexes();
    assert.equal(fresh.length, 4);
    await migration.down(db.knex);
    assert.deepEqual(await readIndexes(), []);
    await comparePage(idsOnly => db.getWorksBy("admin", undefined, undefined, idsOnly), { order: "id", sort: "asc" });
    await migration.up(db.knex);
    assert.deepEqual(await readIndexes(), fresh);
    await comparePage(idsOnly => db.getWorksBy("admin", undefined, undefined, idsOnly), { order: "id", sort: "asc" });
});
