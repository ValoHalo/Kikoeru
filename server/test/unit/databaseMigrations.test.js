"use strict";

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const baseline = require('../fixtures/database-v0.7.0.json');

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'kikoeru-migrations-'));
fs.mkdirSync(path.join(runtime, 'config'));
fs.writeFileSync(path.join(runtime, 'config/config.json'), JSON.stringify({
    sqliteType: process.env.KIKOERU_TEST_SQLITE_TYPE || 'better-sqlite3',
    dbUseDefaultPath: true,
}));
process.env.KIKOERU_DATA_DIR = runtime;
process.env.FREEZE_CONFIG_FILE = '1';
process.env.NODE_ENV = 'test';

const { knex } = require('../../src/database/db');
const { initDatabase } = require('../../src/database/init');
const Storage = require('../../src/database/storage');
const migrations = [
    '20260830090000_create_playlists.js',
    '20260830150000_add_library_state.js',
    '20260905120000_index_work_list_queries.js',
    '20260912000000_work_availability.js',
];

test.after(async () => {
    await knex.destroy();
    fs.rmSync(runtime, { recursive: true, force: true });
});

async function schema() {
    return knex('sqlite_master').select('type', 'name', 'sql').whereNotNull('sql')
        .whereNotIn('name', ['sqlite_sequence', 'knex_migrations']).orderBy('name');
}

async function data() {
    const tables = await knex('sqlite_master').pluck('name').where('type', 'table')
        .whereNotIn('name', ['sqlite_sequence', 'knex_migrations']).orderBy('name');
    const result = {};
    for (const table of tables) result[table] = await knex(table).select();
    return result;
}

async function reset() {
    await knex.raw('PRAGMA foreign_keys = OFF');
    try {
        const objects = await knex('sqlite_master').select('name', 'type')
            .whereIn('type', ['view', 'table']).whereNot('name', 'sqlite_sequence');
        for (const object of objects.filter(item => item.type === 'view'))
            await knex.schema.dropView(object.name);
        for (const object of objects.filter(item => item.type === 'table'))
            await knex.schema.dropTable(object.name);
    } finally {
        await knex.raw('PRAGMA foreign_keys = ON');
    }
}

async function createBaseline(completed) {
    await reset();
    for (const statement of baseline.schema) await knex.raw(statement);
    const storage = new Storage({ connection: knex });
    await storage.ensureTable();
    await knex('knex_migrations').insert(baseline.migrations.map((name, index) => ({
        id: index + 1, name, batch: 1, migration_time: '2026-08-05 00:00:00',
    })));
    for (const name of migrations.slice(0, completed)) {
        await require(`../../src/database/migrations/${name}`).up(knex);
        await storage.logMigration(name);
    }
    await knex('t_user').insert({ name: 'listener', password: 'saved-password', group: 'user' });
    await knex('t_circle').insert({ id: 1, name: 'Circle' });
    await knex('t_work').insert({
        id: 1, title: 'Saved work', root_folder: 'VoiceWork', dir: 'RJ000001', circle_id: 1,
        lyric_status: 'local', memo: JSON.stringify({ note: 'Saved memo' }), is_custom_meta: 1,
    });
    await knex('t_tag').insert({ id: 1, name: 'Tag' });
    await knex('r_tag_work').insert({ tag_id: 1, work_id: 1 });
    await knex('t_va').insert({ id: 'saved-va-id', name: 'Voice actor' });
    await knex('r_va_work').insert({ va_id: 'saved-va-id', work_id: 1 });
    await knex('t_review').insert({ user_name: 'listener', work_id: 1, rating: 5, review_text: 'Saved review', progress: 'listening' });
    await knex('t_play_histroy').insert({ user_name: 'listener', work_id: 1, state: JSON.stringify({ position: 123, path: 'track.mp3' }) });
    if (completed >= 1) {
        await knex('t_playlist').insert({ id: 1, user_name: 'listener', name: 'Saved playlist' });
        await knex('t_playlist_item').insert({ playlist_id: 1, work_id: 1, relative_path: 'track.mp3', title: 'Track', work_title: 'Saved work', position: 0 });
    }
    if (completed >= 2) {
        await knex('t_scan_failure').insert({ code: 'RJ000002', root_folder: 'VoiceWork', relative_dir: 'RJ000002', message: 'Saved failure' });
        await knex('t_work_user_state').insert({ user_name: 'listener', work_id: 1 });
        await knex('t_work_collection').insert({ id: 1, user_name: 'listener', name: 'Saved collection' });
        await knex('t_work_collection_item').insert({ collection_id: 1, work_id: 1, position: 0 });
    }
    if (completed >= 4) await knex('t_work_availability').insert({ work_id: 1 });
}

test('released SQLite databases retain their data through initialization', async t => {
    let currentSchema;
    await t.test('fresh installation records only the retained migrations and restarts', async () => {
        await initDatabase();
        currentSchema = await schema();
        assert.equal((await knex('t_user').first()).name, 'admin');
        assert.deepEqual(await knex('knex_migrations').orderBy('id').pluck('name'), migrations);
        const records = await knex('knex_migrations').orderBy('id');
        await initDatabase();
        assert.deepEqual(await knex('knex_migrations').orderBy('id'), records);
        assert.deepEqual(await schema(), currentSchema);
    });

    for (const [completed, version] of ['v0.7.0', 'v0.7.5', 'v0.7.6', 'v0.8.0', 'v1.0.0'].entries()) {
        await t.test(`${version} upgrades directly and restarts without changing saved data`, async () => {
            await createBaseline(completed);
            const before = await data();
            const records = await knex('knex_migrations').orderBy('id');
            await initDatabase();
            const after = await data();
            for (const [table, rows] of Object.entries(before)) assert.deepEqual(after[table], rows, table);
            for (const table of Object.keys(after)) {
                if (!Object.hasOwn(before, table)) assert.deepEqual(after[table], [], table);
            }
            assert.deepEqual(await schema(), currentSchema);
            const upgradedRecords = await knex('knex_migrations').orderBy('id');
            assert.deepEqual(upgradedRecords.slice(0, records.length), records);
            assert.deepEqual(upgradedRecords.map(row => row.name), [...baseline.migrations, ...migrations]);
            assert.deepEqual(await knex.raw('PRAGMA foreign_key_check'), []);
            await initDatabase();
            assert.deepEqual(await data(), after);
            assert.deepEqual(await schema(), currentSchema);
            assert.deepEqual(await knex('knex_migrations').orderBy('id'), upgradedRecords);
        });
    }

    for (const reason of ['missing migration table', 'missing baseline record', 'missing baseline columns']) {
        await t.test(`${reason} is rejected before migrations or data changes`, async () => {
            await createBaseline(0);
            if (reason === 'missing migration table') await knex.schema.dropTable('knex_migrations');
            if (reason === 'missing baseline record') await knex('knex_migrations').del();
            if (reason === 'missing baseline columns') await knex.schema.renameTable('t_play_histroy', 'saved_history');
            const before = await data();
            const previousSchema = await schema();
            const hasRecords = await knex.schema.hasTable('knex_migrations');
            const records = hasRecords ? await knex('knex_migrations').orderBy('id') : null;
            await assert.rejects(initDatabase(), /v0\.7\.0/);
            assert.deepEqual(await data(), before);
            assert.deepEqual(await schema(), previousSchema);
            assert.equal(await knex.schema.hasTable('knex_migrations'), hasRecords);
            if (hasRecords) assert.deepEqual(await knex('knex_migrations').orderBy('id'), records);
        });
    }

    await t.test('a failing pending migration is not recorded as completed', async () => {
        await createBaseline(2);
        await knex.schema.table('t_work', table => table.index(['original_work_id', 'id'], 't_work_original_work_id_index'));
        const before = await data();
        const previousSchema = await schema();
        const records = await knex('knex_migrations').orderBy('id');
        await assert.rejects(initDatabase(), /already exists/);
        assert.deepEqual(await data(), before);
        assert.deepEqual(await schema(), previousSchema);
        assert.deepEqual(await knex('knex_migrations').orderBy('id'), records);
    });
});
