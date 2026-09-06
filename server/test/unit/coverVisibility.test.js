"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const express = require("express");

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "kikoeru-cover-visibility-"));
process.env.KIKOERU_DATA_DIR = runtime;
process.env.FREEZE_CONFIG_FILE = "1";
const { config } = require("../../src/config");
const db = require("../../src/database/db");
const { getCoverPath } = require("../../src/filesystem/utils");
const metadata = require("../../src/routes/metadata").default;
const media = require("../../src/routes/media").default;
const placeholder = fs.readFileSync(path.join(__dirname, "../../src/static/no-image.jpg"));
let server;
let baseUrl;

test.before(async () => {
    fs.mkdirSync(config.databaseFolderDir, { recursive: true });
    fs.mkdirSync(config.coverFolderDir, { recursive: true });
    const root = path.join(runtime, "works");
    config.rootFolders = [{ name: "test", path: root }];
    await db.knex.schema.createTable("t_work", table => {
        table.integer("id").primary();
        table.boolean("nsfw");
        table.string("root_folder");
        table.string("dir");
        table.json("memo");
    });
    for (const [index, nsfw] of [false, true, null].entries()) {
        const id = index + 1;
        await db.knex("t_work").insert({ id, nsfw, root_folder: "test", dir: String(id), memo: "{}" });
        for (const type of ["main", "sam", "240x240"]) {
            const target = getCoverPath(id, type);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, `cover-${id}-${type}`);
        }
        fs.mkdirSync(path.join(root, String(id)), { recursive: true });
        fs.writeFileSync(path.join(root, String(id), "custom.jpg"), `custom-${id}`);
    }
    const app = express();
    app.use("/api/media", media);
    app.use("/api", metadata);
    server = await new Promise(resolve => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.knex.destroy();
    fs.rmSync(runtime, { recursive: true, force: true });
});

test("cover visibility applies to every size and local custom cover, including unknown works", async () => {
    const paths = ["cover/ID?type=main", "cover/ID?type=sam", "cover/ID?type=240x240", "media/stream/ID/0?", "media/download/ID/0?"];
    for (const id of [1, 2, 3]) {
        for (const pattern of paths) {
            const url = `${baseUrl}/api/${pattern.replace("ID", id)}`;
            const normal = await fetch(url);
            assert.equal(normal.status, 200);
            const normalBody = Buffer.from(await normal.arrayBuffer());
            assert.notDeepEqual(normalBody, placeholder);
            const hidden = await fetch(`${url}&hideNsfw=1`);
            assert.equal(hidden.status, 200);
            assert.deepEqual(Buffer.from(await hidden.arrayBuffer()), id === 1 ? normalBody : placeholder);
        }
    }
    const missing = await fetch(`${baseUrl}/api/cover/999?hideNsfw=1`);
    assert.equal(missing.status, 200);
    assert.deepEqual(Buffer.from(await missing.arrayBuffer()), placeholder);
});
