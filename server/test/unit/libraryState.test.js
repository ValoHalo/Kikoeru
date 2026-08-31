"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const createKnex = require("knex");

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "kikoeru-library-state-"));
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
const { createSchema } = require("../../src/database/schema");
const libraryMigration = require("../../src/database/migrations/20260830150000_add_library_state");
const libraryRouter = require("../../src/routes/library");
const scanFailuresRouter = require("../../src/routes/scanFailures");

test.before(async () => {
    await createSchema(db.knex);
    await db.knex("t_user").insert([
        { name: "admin", password: "admin", group: "administrator" },
        { name: "listener", password: "listener", group: "user" },
    ]);
    await db.knex("t_circle").insert({ id: 1, name: "Circle" });
    await db.knex("t_work").insert([1, 2, 3].map(id => ({
        id,
        root_folder: "VoiceWork",
        dir: `RJ00000${id}`,
        title: `Work ${id}`,
        circle_id: 1,
        lyric_status: "",
    })));
});

test.after(async () => {
    await db.knex.destroy();
    fs.rmSync(runtime, { recursive: true, force: true });
});

test("library routes export Express middleware functions", () => {
    assert.equal(typeof libraryRouter, "function");
    assert.equal(typeof scanFailuresRouter, "function");
});

test("library migration upgrades an existing database and can roll back", async () => {
    const knex = createKnex({
        client: "better-sqlite3",
        connection: { filename: ":memory:" },
        useNullAsDefault: true,
    });
    try {
        await knex.schema.createTable("t_user", table => table.string("name").primary());
        await knex.schema.createTable("t_work", table => table.bigInteger("id").primary());
        await libraryMigration.up(knex);
        for (const table of ["t_scan_failure", "t_work_user_state", "t_work_collection", "t_work_collection_item"]) {
            assert.equal(await knex.schema.hasTable(table), true);
        }
        await libraryMigration.down(knex);
        assert.equal(await knex.schema.hasTable("t_scan_failure"), false);
        assert.equal(await knex.schema.hasTable("t_work_collection_item"), false);
    }
    finally {
        await knex.destroy();
    }
});

test("scan failures persist attempts and clear by folder identity", async () => {
    const identity = { code: "RJ000001", rootFolder: "VoiceWork", relativeDir: "RJ000001" };
    const firstId = await db.recordScanFailure({ ...identity, stage: "metadata", message: "timeout" });
    const secondId = await db.recordScanFailure({ ...identity, stage: "cover", message: "image unavailable" });
    assert.equal(Number(secondId), Number(firstId));

    const failures = await db.getScanFailures();
    assert.equal(failures.length, 1);
    assert.equal(failures[0].attempts, 2);
    assert.equal(failures[0].stage, "cover");
    assert.equal(failures[0].message, "image unavailable");

    assert.equal(await db.clearScanFailure(identity), 1);
    assert.deepEqual(await db.getScanFailures(), []);
});

test("archives are isolated per user and excluded from ordinary listings", async () => {
    assert.equal(await db.archiveWork("admin", 2), true);
    assert.equal(await db.archiveWork("admin", 999), false);

    const adminWorks = await db.getWorksBy("admin");
    const listenerWorks = await db.getWorksBy("listener");
    assert.deepEqual(adminWorks.map(work => Number(work.id)).sort(), [1, 3]);
    assert.deepEqual(listenerWorks.map(work => Number(work.id)).sort(), [1, 2, 3]);

    const archived = await db.getArchivedWorks("admin");
    assert.equal(archived.totalCount, 1);
    assert.deepEqual(archived.works.map(work => Number(work.id)), [2]);
    assert.equal(await db.unarchiveWork("admin", 2), 1);
});

test("work collections support create, add, reorder, remove, rename, and delete", async () => {
    const collectionId = Number(await db.createWorkCollection("admin", "睡前"));
    assert.equal(await db.addWorkCollectionItems("admin", collectionId, [2, 1, 999]), 2);
    assert.equal(await db.addWorkCollectionItems("admin", collectionId, [1, 2]), 0);

    let collections = await db.getWorkCollections("admin");
    assert.equal(collections.length, 1);
    assert.equal(Number(collections[0].item_count), 2);

    let collection = await db.getWorkCollection("admin", collectionId);
    assert.deepEqual(collection.items.map(item => Number(item.id)), [2, 1]);
    assert.deepEqual(collection.items.map(item => item.position), [0, 1]);

    assert.equal(await db.reorderWorkCollectionItems("admin", collectionId, [1, 2]), true);
    assert.equal(await db.reorderWorkCollectionItems("admin", collectionId, [1, 3]), false);
    collection = await db.getWorkCollection("admin", collectionId);
    assert.deepEqual(collection.items.map(item => Number(item.id)), [1, 2]);

    assert.equal(await db.renameWorkCollection("admin", collectionId, "工作"), 1);
    assert.equal((await db.getWorkCollection("admin", collectionId)).collection.name, "工作");
    assert.equal(await db.removeWorkCollectionItem("admin", collectionId, 1), 1);
    assert.equal((await db.getWorkCollection("admin", collectionId)).items.length, 1);
    assert.equal(await db.deleteWorkCollection("admin", collectionId), 1);
    assert.equal(await db.getWorkCollection("admin", collectionId), null);
});
