"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const createKnex = require("knex");
const moduleRuntime = fs.mkdtempSync(path.join(os.tmpdir(), "kikoeru-schema-test-"));
process.env.KIKOERU_DATA_DIR = moduleRuntime;
const { createSchema } = require("../../src/database/schema");
const retirementMigration = require("../../src/database/migrations/20260803090000_remove_ai_translation_tasks");

test.after(() => {
    fs.rmSync(moduleRuntime, { recursive: true, force: true });
});

function makeDatabase() {
    return createKnex({
        client: "better-sqlite3",
        connection: { filename: ":memory:" },
        useNullAsDefault: true,
    });
}

test("fresh schema does not create the retired translation task table", async () => {
    const knex = makeDatabase();
    try {
        await createSchema(knex);
        assert.equal(await knex.schema.hasTable("t_translate_task"), false);
        assert.equal(await knex.schema.hasTable("t_work"), true);
    } finally {
        await knex.destroy();
    }
});

test("upgrade removes translation task schema and migrates lyric status", async () => {
    const knex = makeDatabase();
    try {
        await knex.schema.createTable("t_work", table => {
            table.bigInteger("id").primary();
            table.string("lyric_status").notNullable().defaultTo("");
        });
        await knex.schema.createTable("t_translate_task", table => {
            table.increments();
            table.timestamps(true, true);
            table.bigInteger("work_id").notNullable();
        });
        await knex.raw(`
            CREATE TRIGGER t_translate_task_trigger_update
            AFTER UPDATE ON t_translate_task
            BEGIN
                UPDATE t_translate_task SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
            END;
        `);
        await knex("t_work").insert([
            { id: 1, lyric_status: "ai" },
            { id: 2, lyric_status: "ai_local" },
            { id: 3, lyric_status: "local" },
        ]);

        await retirementMigration.up(knex);

        assert.equal(await knex.schema.hasTable("t_translate_task"), false);
        const trigger = await knex("sqlite_master")
            .where({ type: "trigger", name: "t_translate_task_trigger_update" })
            .first();
        assert.equal(trigger, undefined);
        assert.deepEqual(await knex("t_work").orderBy("id").pluck("lyric_status"), ["", "local", "local"]);
    } finally {
        await knex.destroy();
    }
});
