"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const express = require("express");

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "kikoeru-position-history-"));
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
    await db.knex("t_work").insert([1, 2, 3].map(id => ({ id, circle_id: 1, root_folder: "VoiceWork", dir: `RJ${id}`, title: `Work ${id}`, lyric_status: "", nsfw: id === 2 })));
    const position = (user_name, work_id, relative_path, seconds) => ({ user_name, work_id, relative_path, seconds, reason: "seek" });
    await db.knex("t_play_position").insert([
        position("alice", 1, "mp3/main.mp3", 20),
        position("alice", 1, "mp3/main.mp3", 40),
        position("alice", 1, "mp3/other.mp3", 60),
        position("alice", 2, "mp3/main.mp3", 80),
        position("bob", 1, "mp3/main.mp3", 100),
        ...Array.from({ length: 110 }, (_, index) => position("alice", 3, "recent.mp3", index)),
    ]);
    const app = express();
    app.use((req, _res, next) => { if (req.headers["x-test-user"]) req.user = { name: req.headers["x-test-user"] }; next(); });
    app.use("/api/histroy", require("../../src/routes/play_histroy").default);
    server = await new Promise(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
    url = `http://127.0.0.1:${server.address().port}/api/histroy/positions`;
});

test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.knex.destroy();
    fs.rmSync(runtime, { recursive: true, force: true });
});

async function positions(params = {}, user = "alice") {
    const response = await fetch(`${url}?${new URLSearchParams(params)}`, { headers: { "x-test-user": user } });
    assert.equal(response.status, 200);
    return (await response.json()).positions;
}

test("current-file filtering happens before the result limit and preserves newest-first order", async () => {
    const rows = await positions({ workId: 1, relativePath: "mp3/main.mp3" });
    assert.deepEqual(rows.map(row => row.seconds), [40, 20]);
    assert.ok(rows.every(row => row.work_id === 1 && row.relative_path === "mp3/main.mp3"));
    assert.deepEqual((await positions({ workId: 1, relativePath: "mp3\\main.mp3" })).map(row => row.id), rows.map(row => row.id));
    assert.deepEqual(await positions({ workId: 1, relativePath: "missing.mp3" }), []);
});

test("the existing global endpoint stays limited and account visibility applies to filtered results", async () => {
    assert.equal((await fetch(url)).status, 403);
    const globalRows = await positions();
    assert.equal(globalRows.length, 100);
    assert.ok(globalRows.every(row => row.user_name === "alice"));
    assert.ok(globalRows.every((row, index) => index === 0 || row.id < globalRows[index - 1].id));
    assert.deepEqual((await positions({ workId: 1, relativePath: "mp3/main.mp3" }, "bob")).map(row => row.seconds), [100]);
    assert.deepEqual((await positions({ workId: 2, relativePath: "mp3/main.mp3" })).map(row => row.seconds), [80]);
    assert.deepEqual(await positions({ workId: 2, relativePath: "mp3/main.mp3", nsfw: 1 }), []);
});

test("invalid filters are rejected instead of becoming an unfiltered history request", async () => {
    for (const query of ["workId=invalid", "workId=0", "workId=1&workId=2", "relativePath=", "relativePath=one.mp3&relativePath=two.mp3"]) {
        const response = await fetch(`${url}?${query}`, { headers: { "x-test-user": "alice" } });
        assert.equal(response.status, 400, query);
    }
});
