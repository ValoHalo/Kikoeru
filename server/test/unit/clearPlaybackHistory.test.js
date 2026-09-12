"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const express = require("express");

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "kikoeru-clear-history-"));
fs.mkdirSync(path.join(runtime, "config"));
fs.mkdirSync(path.join(runtime, "sqlite"));
fs.writeFileSync(path.join(runtime, "config/config.json"), JSON.stringify({ sqliteType: "sqlite3", auth: true }));
process.env.KIKOERU_DATA_DIR = runtime;
process.env.FREEZE_CONFIG_FILE = "1";
process.env.NODE_ENV = "test";
const db = require("../../src/database/db");
const { createSchema } = require("../../src/database/schema");
let server;
let url;

test.before(async () => {
    await createSchema(db.knex);
    await db.knex("t_user").insert(["alice", "bob"].map(name => ({ name, password: "test", group: "user" })));
    await db.knex("t_circle").insert({ id: 1, name: "Circle" });
    await db.knex("t_work").insert([1, 2].map(id => ({ id, circle_id: 1, root_folder: "VoiceWork", dir: `RJ${id}`, title: `Work ${id}`, lyric_status: "" })));
    await db.knex("t_review").insert({ user_name: "alice", work_id: 1, rating: 4, progress: "listening" });
    const collection = await db.createWorkCollection("alice", "Collection");
    await db.addWorkCollectionItems("alice", collection, [1]);
    for (const name of ["alice", "bob"]) {
        for (const id of [1, 2]) await db.updatePlayHistroy(name, id, JSON.stringify({ queue: [], index: 0, seconds: 20 }));
    }
    const app = express();
    app.use(express.json());
    // The test harness supplies an identity after the authentication boundary.
    app.use((req, _res, next) => { if (req.headers["x-test-user"]) req.user = { name: req.headers["x-test-user"] }; next(); });
    app.use("/api/histroy", require("../../src/routes/play_histroy").default);
    server = await new Promise(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
    url = `http://127.0.0.1:${server.address().port}/api/histroy`;
});

test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.knex.destroy();
    fs.rmSync(runtime, { recursive: true, force: true });
});

test("clearing requires authentication and only removes the authenticated account's history", async () => {
    assert.equal((await fetch(`${url}/all`, { method: "DELETE" })).status, 403);
    assert.equal((await db.knex("t_play_histroy")).length, 4);
    const response = await fetch(`${url}/all`, {
        method: "DELETE", headers: { "x-test-user": "alice", "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: "bob" }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).deleted, 2);
    assert.equal((await db.knex("t_play_histroy").where("user_name", "alice")).length, 0);
    assert.equal((await db.knex("t_play_histroy").where("user_name", "bob")).length, 2);
    assert.equal((await db.knex("t_work")).length, 2);
    assert.equal((await db.knex("t_review")).length, 1);
    assert.equal((await db.knex("t_work_collection_item")).length, 1);
    const again = await fetch(`${url}/all`, { method: "DELETE", headers: { "x-test-user": "alice" } });
    assert.equal((await again.json()).deleted, 0);
    await assert.rejects(db.clearPlayHistory(null));
});

test("single-work deletion still requires a work id and keeps other history", async () => {
    const headers = { "x-test-user": "bob", "Content-Type": "application/json" };
    assert.equal((await fetch(url, { method: "DELETE", headers, body: "{}" })).status, 400);
    assert.equal((await db.knex("t_play_histroy").where("user_name", "bob")).length, 2);
    assert.equal((await fetch(url, { method: "DELETE", headers, body: JSON.stringify({ work_id: 1 }) })).status, 200);
    assert.deepEqual((await db.knex("t_play_histroy").where("user_name", "bob")).map(row => row.work_id), [2]);
});
