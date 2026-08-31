"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "kikoeru-metadata-semantics-"));
const configDir = path.join(runtime, "config");
const databaseDir = path.join(runtime, "sqlite");
fs.mkdirSync(configDir, { recursive: true });
fs.mkdirSync(databaseDir, { recursive: true });
fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify({
    sqliteType: "better-sqlite3",
    dbUseDefaultPath: true,
}));
process.env.KIKOERU_DATA_DIR = runtime;
process.env.FREEZE_CONFIG_FILE = "1";
process.env.NODE_ENV = "test";

const db = require("../../src/database/db");
const scanner = require("../../src/filesystem/scannerModules");
const normalize = require("../../src/routes/utils/normalize").default;
const { scrapeDlsiteJsonObject } = require("../../src/scraper/dlsite");

test.before(async () => {
    await db.knex.schema
        .createTable("t_circle", table => {
            table.integer("id").primary();
            table.string("name");
        })
        .createTable("t_work", table => {
            table.bigInteger("id").primary();
            table.string("root_folder").notNullable().defaultTo("VoiceWork");
            table.string("dir").notNullable().defaultTo("");
            table.string("title");
            table.integer("circle_id");
            table.integer("is_custom_meta").defaultTo(0);
        })
        .createTable("t_tag", table => {
            table.integer("id").primary();
            table.string("name");
        })
        .createTable("r_tag_work", table => {
            table.integer("tag_id");
            table.bigInteger("work_id");
        })
        .createTable("t_va", table => {
            table.string("id").primary();
            table.string("name");
        })
        .createTable("r_va_work", table => {
            table.string("va_id");
            table.bigInteger("work_id");
        })
        .createTable("t_scan_failure", table => {
            table.increments("id");
            table.string("code", 16).notNullable();
            table.string("root_folder").notNullable();
            table.string("relative_dir", 1024).notNullable();
            table.string("stage", 32).notNullable().defaultTo("metadata");
            table.text("message").notNullable();
            table.integer("attempts").unsigned().notNullable().defaultTo(1);
            table.timestamps(true, true);
        });
    await db.knex("t_circle").insert([
        { id: 1, name: "Original circle" },
        { id: 2, name: "Custom circle" },
    ]);
    await db.knex("t_work").insert([1, 2, 3, 4, 5].map(id => ({
        id,
        title: `Work ${id}`,
        circle_id: 1,
        is_custom_meta: 0,
    })));
});

test.after(async () => {
    await db.knex.destroy();
    fs.rmSync(runtime, { recursive: true, force: true });
});

test("each partial custom metadata edit marks the work as custom", async () => {
    const titleOnly = Object.assign(Object.create(null), { title: "Custom title" });
    await db.customWorkMetadata(1, titleOnly);
    await db.customWorkMetadata(2, { tags: [{ id: 10, name: "Custom tag" }] });
    await db.customWorkMetadata(3, { vas: [{ id: "custom-va", name: "Custom VA" }] });
    await db.customWorkMetadata(4, { circle: { id: 2, name: "Custom circle" } });

    const works = await db.knex("t_work").whereIn("id", [1, 2, 3, 4]).orderBy("id");
    assert.deepEqual(works.map(work => work.is_custom_meta), [1, 1, 1, 1]);
    assert.equal(works[0].title, "Custom title");
    assert.equal(works[3].circle_id, 2);
});

test("metadata refresh preserves skipped, updated, and failed results", async () => {
    await db.knex("t_work").where("id", 5).update({ is_custom_meta: 1 });
    const protectedCounts = await scanner.refreshWorks(
        Promise.resolve([{ id: 5 }]),
        "id",
        scanner.updateMetadata,
    );
    assert.deepEqual(protectedCounts, { updated: 0, skipped: 1, failed: 0 });

    const counts = await scanner.refreshWorks(
        Promise.resolve([{ id: 1 }, { id: 2 }, { id: 3 }]),
        "id",
        async id => ({ 1: "updated", 2: "skipped", 3: "failed" })[id],
    );
    assert.deepEqual(counts, { updated: 1, skipped: 1, failed: 1 });
});

test("folder scan distinguishes new work from an existing cover repair", () => {
    assert.equal(scanner.classifyFolderResult(false, "skipped"), "added");
    assert.equal(scanner.classifyFolderResult(false, "added"), "added");
    assert.equal(scanner.classifyFolderResult(true, "skipped"), "skipped");
    assert.equal(scanner.classifyFolderResult(true, "added"), "updated");
    assert.equal(scanner.classifyFolderResult(true, "failed"), "failed");
});

test("any successfully repaired requested cover counts as an update", () => {
    assert.equal(scanner.classifyCoverDownloadResults(["sam"]), "added");
    assert.equal(scanner.classifyCoverDownloadResults([null, "240x240"]), "added");
    assert.equal(scanner.classifyCoverDownloadResults([null]), "failed");
});

test("normalization accepts records without a usable hasOwnProperty method", () => {
    const record = Object.assign(Object.create(null), {
        hasOwnProperty: null,
        nsfw: 0,
        circleObj: '{"id":1,"name":"Circle"}',
        rate_count_detail: "[]",
        rank: null,
        vaNames: null,
        vaIds: null,
        tagNames: null,
        tagIds: null,
        related_work_titles: null,
        related_work_ids: null,
        state: '{"index":0}',
        play_updated_at: "2026-08-03T00:00:00.000Z",
        review_updated_at: "2026-08-03T00:00:00.000Z",
        memo: null,
    });

    const [normalized] = normalize([record]);
    assert.deepEqual(normalized.state, { index: 0 });
    assert.match(normalized.review_updated_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test("DLsite JSON parsing accepts a null-prototype creators object", () => {
    const creators = Object.assign(Object.create(null), {
        voice_by: [{ name: "Voice Actor" }],
    });
    const work = scrapeDlsiteJsonObject([{
        product_name: "Work title",
        maker_id: "RG00001",
        maker_name: "Circle",
        age_category: 3,
        regist_date: "2026-08-03",
        genres: [],
        creaters: creators,
    }]);

    assert.equal(work.vas.length, 1);
    assert.equal(work.vas[0].name, "Voice Actor");
});
