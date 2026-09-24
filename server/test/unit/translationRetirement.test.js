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
