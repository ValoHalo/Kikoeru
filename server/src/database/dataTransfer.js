"use strict";

const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const { normalizeTrackPath, restoreTrackReference } = require('../filesystem/trackReference');
const { t } = require('../i18n');

const FORMAT = 'valohalo-kikoeru-data';
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_ROWS = 250000;
const definitions = {
    t_circle: ['id name', 'id'],
    t_tag: ['id name', 'id'],
    t_va: ['id name', 'id'],
    t_user: ['name', 'name'],
    t_work: ['id created_at updated_at root_folder dir title circle_id nsfw release dl_count price review_count rate_count rate_average_2dp rate_count_detail rank lyric_status original_work_id memo is_custom_meta', 'id'],
    r_tag_work: ['tag_id work_id', 'tag_id work_id'],
    r_va_work: ['va_id work_id', 'va_id work_id'],
    t_review: ['user_name work_id rating review_text created_at updated_at progress', 'user_name work_id'],
    t_play_histroy: ['user_name work_id created_at updated_at state', 'user_name work_id'],
    t_playlist: ['id user_name name created_at updated_at', 'id'],
    t_playlist_item: ['id playlist_id work_id relative_path title work_title position', 'id'],
    t_work_collection: ['id user_name name created_at updated_at', 'id'],
    t_work_collection_item: ['id collection_id work_id position created_at', 'id'],
    t_work_user_state: ['user_name work_id archived_at', 'user_name work_id'],
    t_bookmark: ['id user_name work_id relative_path seconds name note', 'id'],
    t_work_availability: ['work_id missing_since', 'work_id'],
    t_scan_failure: ['id code root_folder relative_dir stage message attempts created_at updated_at', 'id'],
    t_play_position: ['id user_name work_id relative_path seconds reason created_at', 'id'],
    t_saved_search: ['id user_name name query created_at updated_at', 'id'],
};
const TABLES = Object.fromEntries(Object.entries(definitions).map(([table, [columns, key]]) => [table, { columns: columns.split(' '), key: key.split(' ') }]));
const CORE_TABLES = ['t_circle', 't_tag', 't_va', 't_user', 't_work', 'r_tag_work', 'r_va_work', 't_review', 't_play_histroy'];
const BASELINE = '20260803090000_remove_ai_translation_tasks.js';
const FEATURES = {
    '20260830090000_create_playlists.js': ['t_playlist', 't_playlist_item'],
    '20260830150000_add_library_state.js': ['t_scan_failure', 't_work_user_state', 't_work_collection', 't_work_collection_item'],
    '20260905120000_index_work_list_queries.js': [],
    '20260912000000_work_availability.js': ['t_work_availability'],
    '20261008000000_create_bookmarks.js': ['t_bookmark'],
    '20261008010000_add_bookmark_name.js': [],
    '20261015090000_playback_positions.js': ['t_play_position'],
    '20261015100000_saved_searches.js': ['t_saved_search'],
};
const LEGACY_LAST_MIGRATION = '20231201003918_work_file_memo.js';
const OPTIONAL_VALUES = new Set(['nsfw', 'release', 'dl_count', 'price', 'review_count', 'rate_count', 'rate_average_2dp', 'rate_count_detail', 'rank', 'memo', 'rating', 'review_text', 'progress', 'is_custom_meta']);
const INTEGER_FIELDS = new Set(['id', 'work_id', 'circle_id', 'tag_id', 'playlist_id', 'collection_id', 'original_work_id', 'dl_count', 'price', 'review_count', 'rate_count', 'rating', 'is_custom_meta', 'position', 'seconds', 'attempts']);

function fail(key, details = {}) {
    const error = new Error(t(`dataTransfer.${key}`, details));
    error.status = 400;
    throw error;
}

function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function identifier(value, minimum = 1) {
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return false;
    return Number.isSafeInteger(Number(value)) && Number(value) >= minimum;
}

function jsonValue(value, table, column) {
    try { return typeof value === 'string' ? JSON.parse(value) : value; }
    catch { fail('invalidValue', { table, column }); }
}

function recordKey(row, fields) {
    return JSON.stringify(fields.map(field => {
        const value = row[field];
        if (field !== 'created_at' || value == null) return value;
        const timestamp = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
        return new Date(timestamp).toISOString();
    }));
}

function readSqlite(buffer) {
    let db;
    try {
        db = new Database(buffer, { readonly: true });
        db.pragma('trusted_schema = OFF');
        db.pragma('query_only = ON');
        if (db.pragma('quick_check', { simple: true }) !== 'ok') fail('damaged');
        const objects = db.prepare("SELECT name, type, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all();
        const tableNames = new Set(objects.filter(entry => entry.type === 'table' && !/^CREATE\s+VIRTUAL/i.test(entry.sql || '')).map(entry => entry.name));
        const columns = new Map();
        for (const table of [...Object.keys(TABLES), 'knex_migrations', 't_translate_task']) {
            if (!tableNames.has(table)) continue;
            const info = db.prepare(`PRAGMA table_info("${table}")`).all();
            columns.set(table, new Set(info.map(column => column.name)));
            if (Object.hasOwn(TABLES, table)) {
                const primaryKey = info.filter(column => column.pk).sort((a, b) => a.pk - b.pk).map(column => column.name);
                if (JSON.stringify(primaryKey) !== JSON.stringify(TABLES[table].key)) fail('unsupported');
            }
        }
        const workColumns = columns.get('t_work');
        if (!workColumns || CORE_TABLES.some(table => !columns.has(table))) fail('unsupported');
        if (!['password', 'group'].every(column => columns.get('t_user').has(column))) fail('unsupported');
        const nativeFields = ['original_work_id', 'is_custom_meta'].filter(column => workColumns.has(column));
        if (nativeFields.length === 1) fail('unsupported');
        let migrations = [];
        if (columns.has('knex_migrations')) {
            if (!columns.get('knex_migrations').has('name')) fail('unsupported');
            migrations = db.prepare('SELECT name FROM knex_migrations LIMIT 1000').all().map(row => row.name);
            if (migrations.some(name => typeof name !== 'string' || !/^\d{14}_.+\.js$/.test(name))) fail('unsupported');
        }
        const native = nativeFields.length === 2;
        if (native) {
            if (!migrations.includes(BASELINE) && !migrations.includes(Object.keys(FEATURES)[0])) fail('unsupported');
            if (migrations.some(name => name > BASELINE && !Object.hasOwn(FEATURES, name))) fail('newerVersion');
            for (const [migration, tables] of Object.entries(FEATURES)) {
                if (tables.some(table => columns.has(table) !== migrations.includes(migration))) fail('unsupported');
            }
            if (columns.has('t_translate_task')) fail('unsupported');
            if (columns.has('t_bookmark') && columns.get('t_bookmark').has('name') !== migrations.includes('20261008010000_add_bookmark_name.js')) fail('unsupported');
        } else {
            if (migrations.some(name => name > LEGACY_LAST_MIGRATION)) fail('unsupported');
            if (Object.keys(TABLES).some(table => !CORE_TABLES.includes(table) && columns.has(table))) fail('unsupported');
        }
        const allowedTables = new Set([...Object.keys(TABLES), 'knex_migrations', 'knex_migrations_lock', ...(native ? [] : ['t_translate_task'])]);
        if (objects.some(entry => entry.type === 'table' && !allowedTables.has(entry.name))) fail('unsupported');
        const tables = {};
        let count = 0;
        for (const [table, spec] of Object.entries(TABLES)) {
            if (!columns.has(table)) { tables[table] = []; continue; }
            const defaults = !native && table === 't_work' ? ['original_work_id', 'is_custom_meta'] : table === 't_bookmark' ? ['name'] : [];
            const selected = spec.columns.filter(column => !defaults.includes(column) || columns.get(table).has(column));
            if (selected.some(column => !columns.get(table).has(column))) fail('unsupported');
            const allowedColumns = new Set([...spec.columns, ...(table === 't_user' ? ['password', 'group'] : [])]);
            if ([...columns.get(table)].some(column => !allowedColumns.has(column))) fail('unsupported');
            tables[table] = db.prepare(`SELECT ${selected.map(column => `"${column}"`).join(',')} FROM "${table}" LIMIT ?`).all(MAX_ROWS + 1);
            count += tables[table].length;
            if (count > MAX_ROWS) fail('tooLarge');
            for (const row of tables[table]) {
                for (const column of defaults) if (!Object.hasOwn(row, column)) row[column] = column === 'name' ? '' : 0;
                if (!native && table === 't_work') {
                    row.original_work_id = row.id;
                    row.lyric_status = String(row.lyric_status).includes('local') ? 'local' : '';
                }
            }
        }
        const ignoredTranslationTasks = columns.has('t_translate_task') ? db.prepare('SELECT COUNT(*) AS count FROM t_translate_task').get().count : 0;
        return { source: native ? 'branchDatabase' : 'legacyDatabase', tables, ignoredTranslationTasks };
    } catch (error) {
        if (error.status) throw error;
        fail('damaged');
    } finally { if (db) db.close(); }
}

function normalizeTables(tables) {
    if (!object(tables) || Object.keys(tables).some(table => !Object.hasOwn(TABLES, table))) fail('unsupported');
    let count = 0;
    let unavailableTracks = 0;
    for (const [table, spec] of Object.entries(TABLES)) {
        if (!Array.isArray(tables[table])) fail('unsupported');
        count += tables[table].length;
        if (count > MAX_ROWS) fail('tooLarge');
        const keys = new Set();
        tables[table] = tables[table].map(input => {
            if (!object(input) || Object.keys(input).some(column => !spec.columns.includes(column))) fail('unsupported');
            const row = {};
            for (const column of spec.columns) {
                let value = input[column];
                if (value === undefined || value === null) {
                    if (!OPTIONAL_VALUES.has(column)) fail('invalidValue', { table, column });
                    row[column] = null;
                    continue;
                }
                if (INTEGER_FIELDS.has(column) && !(table === 't_va' && column === 'id')) {
                    const localMetadataId = ['circle_id', 'tag_id'].includes(column) || (['t_circle', 't_tag'].includes(table) && column === 'id');
                    const minimum = localMetadataId ? Number.MIN_SAFE_INTEGER : ['id', 'work_id', 'playlist_id', 'collection_id'].includes(column) ? 1 : 0;
                    if (!identifier(value, minimum)) fail('invalidValue', { table, column });
                    value = Number(value);
                } else if (column === 'nsfw') {
                    if (![0, 1, false, true].includes(value)) fail('invalidValue', { table, column });
                    value = Number(value);
                } else if (column === 'rate_average_2dp') {
                    if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 5) fail('invalidValue', { table, column });
                    value = Number(value);
                } else if (['memo', 'state', 'rank', 'rate_count_detail', 'query'].includes(column)) {
                    value = jsonValue(value, table, column);
                    if (value !== null && !object(value) && !Array.isArray(value)) fail('invalidValue', { table, column });
                    if (column === 'state' && !object(value)) fail('invalidValue', { table, column });
                    if (table === 't_saved_search' && column === 'query') {
                        try { value = require('./savedSearch').normalizeSavedSearch(value); }
                        catch { fail('invalidValue', { table, column }); }
                    }
                    value = JSON.stringify(value);
                } else if (['created_at', 'updated_at', 'archived_at', 'missing_since'].includes(column)) {
                    const timestamp = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
                    const date = new Date(timestamp);
                    if (!Number.isFinite(date.getTime())) fail('invalidValue', { table, column });
                    value = date.toISOString().replace('T', ' ').replace('Z', '');
                } else if (typeof value !== 'string' || value.includes('\0') || value.length > 1024 * 1024) {
                    fail('invalidValue', { table, column });
                }
                row[column] = value;
            }
            for (const column of ['dir', 'relative_path', 'relative_dir']) {
                if (!Object.hasOwn(row, column)) continue;
                if (column !== 'relative_path' && row[column] === '') continue;
                try { row[column] = normalizeTrackPath(row[column]); }
                catch { fail('invalidValue', { table, column }); }
            }
            if (row.rating !== undefined && row.rating !== null && row.rating > 5) fail('invalidValue', { table, column: 'rating' });
            if (row.progress !== undefined && row.progress !== null && !['marked', 'listening', 'listened', 'replay', 'postponed'].includes(row.progress)) fail('invalidValue', { table, column: 'progress' });
            if (table === 't_play_histroy') {
                const state = JSON.parse(row.state);
                if (!Array.isArray(state.queue) || !Number.isInteger(state.index) || state.index < 0 || (state.queue.length > 0 && state.index >= state.queue.length) || typeof state.seconds !== 'number' || !Number.isFinite(state.seconds) || state.seconds < 0) fail('invalidValue', { table, column: 'state' });
                state.queue = state.queue.map(track => {
                    if (!object(track) || typeof track.title !== 'string') fail('invalidValue', { table, column: 'state.queue' });
                    const clean = {};
                    for (const field of ['title', 'subtitle', 'workTitle', 'duration', 'type', 'workId', 'hash', 'relativePath']) {
                        if (typeof track[field] === 'string' || typeof track[field] === 'number') clean[field] = track[field];
                    }
                    const workId = clean.workId || String(clean.hash || '').split('/')[0] || row.work_id;
                    if (!identifier(workId)) fail('invalidValue', { table, column: 'state.queue.workId' });
                    clean.workId = Number(workId);
                    restoreTrackReference(clean, clean.workId);
                    if (clean.hash.endsWith('/unavailable')) unavailableTracks += 1;
                    return clean;
                });
                row.state = JSON.stringify(state);
            }
            const key = recordKey(row, spec.key);
            if (keys.has(key)) fail('duplicate', { table });
            keys.add(key);
            return row;
        });
    }
    for (const [table, fields] of [['t_playlist', ['user_name', 'name']], ['t_work_collection', ['user_name', 'name']], ['t_work_collection_item', ['collection_id', 'work_id']]]) {
        if (new Set(tables[table].map(row => recordKey(row, fields))).size !== tables[table].length) fail('duplicate', { table });
    }
    const ids = Object.fromEntries(Object.entries(TABLES).filter(([, spec]) => spec.key.length === 1).map(([table, spec]) => [table, new Set(tables[table].map(row => row[spec.key[0]]))]));
    for (const [table, rows] of Object.entries(tables)) {
        for (const row of rows) {
            for (const [field, parent] of [['circle_id', 't_circle'], ['tag_id', 't_tag'], ['va_id', 't_va'], ['user_name', 't_user'], ['playlist_id', 't_playlist'], ['collection_id', 't_work_collection'], ['work_id', 't_work']]) {
                if (field === 'work_id' && table === 't_playlist_item') continue;
                if (Object.hasOwn(row, field) && !ids[parent].has(row[field])) fail('brokenReference', { table, column: field });
            }
        }
    }
    return { tables, unavailableTracks };
}

function readImport(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) fail('fileRequired');
    if (buffer.length > MAX_BYTES) fail('tooLarge');
    let input;
    if (buffer.subarray(0, 16).equals(Buffer.from('SQLite format 3\0'))) {
        input = readSqlite(buffer);
    } else {
        let backup;
        try { backup = JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, '')); }
        catch { fail('unsupported'); }
        if (!object(backup) || backup.format !== FORMAT) fail('unsupported');
        if (backup.formatVersion !== 1 || ![1, 2, 3].includes(backup.schemaVersion)) fail('newerVersion');
        if (backup.schemaVersion === 1 && object(backup.tables)) backup.tables.t_play_position = [];
        if (backup.schemaVersion < 3 && object(backup.tables)) backup.tables.t_saved_search = [];
        input = { source: 'branchBackup', appVersion: backup.appVersion, exportedAt: backup.exportedAt, tables: backup.tables, ignoredTranslationTasks: 0 };
    }
    return { ...input, ...normalizeTables(input.tables), digest: crypto.createHash('sha256').update(buffer).digest('hex') };
}

async function previewImport(input, knex, rootFolders) {
    const counts = Object.fromEntries(Object.entries(input.tables).map(([table, rows]) => [table, rows.length]));
    const users = new Set();
    const roots = new Set();
    for (const rows of Object.values(input.tables)) {
        for (const row of rows) {
            if (Object.hasOwn(row, 'user_name')) users.add(row.user_name);
            if (Object.hasOwn(row, 'root_folder')) roots.add(row.root_folder);
        }
    }
    return {
        source: input.source, digest: input.digest, appVersion: input.appVersion, exportedAt: input.exportedAt,
        counts, users: [...users], roots: [...roots],
        targetUsers: (await knex('t_user').select('name')).map(user => user.name),
        targetRoots: rootFolders.map(folder => folder.name),
        ignoredTranslationTasks: input.ignoredTranslationTasks, unavailableTracks: input.unavailableTracks,
    };
}

async function exportData(knex, appVersion) {
    const tables = await knex.transaction(async trx => {
        const result = {};
        for (const [table, spec] of Object.entries(TABLES)) result[table] = await trx(table).select(spec.columns).orderBy(spec.key);
        return result;
    });
    normalizeTables(tables);
    const buffer = Buffer.from(JSON.stringify({ format: FORMAT, formatVersion: 1, schemaVersion: 3, appVersion, exportedAt: new Date().toISOString(), tables }));
    if (buffer.length > MAX_BYTES) fail('tooLarge');
    return buffer;
}

async function importData(input, options, knex, rootFolders) {
    if (!object(options) || options.digest !== input.digest || !object(options.users) || !object(options.roots)) fail('previewRequired');
    return knex.transaction(async trx => {
        const preview = await previewImport(input, trx, rootFolders);
        const selectedUsers = [];
        for (const user of preview.users) {
            if (!Object.hasOwn(options.users, user) || (options.users[user] !== null && !preview.targetUsers.includes(options.users[user]))) fail('mappingRequired');
            if (options.users[user] !== null) selectedUsers.push(options.users[user]);
        }
        if (new Set(selectedUsers).size !== selectedUsers.length) fail('userCollision');
        for (const root of preview.roots) {
            if (!Object.hasOwn(options.roots, root) || !preview.targetRoots.includes(options.roots[root])) fail('mappingRequired');
        }
        const result = {};
        const existing = {};
        for (const [table, spec] of Object.entries(TABLES)) {
            existing[table] = await trx(table).select(spec.columns);
            result[table] = { added: 0, skipped: 0 };
        }
        const newWorks = new Set();
        const workLocations = new Map(existing.t_work.map(work => [recordKey(work, ['root_folder', 'dir']), work.id]));
        const parentIds = { t_playlist: new Map(), t_work_collection: new Map() };
        const metadataIds = { t_circle: new Map(), t_tag: new Map() };
        for (const [table, spec] of Object.entries(TABLES)) {
            if (table === 't_user') continue;
            const list = table === 't_playlist' || table === 't_work_collection' || table === 't_saved_search';
            const autoId = list || ['t_playlist_item', 't_work_collection_item', 't_bookmark', 't_scan_failure', 't_play_position'].includes(table);
            const keyFields = list ? ['user_name', 'name'] : table === 't_play_position' ? ['user_name', 'work_id', 'relative_path', 'seconds', 'created_at'] : table === 't_bookmark' ? ['user_name', 'work_id', 'relative_path', 'seconds', 'name', 'note'] : table === 't_scan_failure' ? ['root_folder', 'relative_dir', 'code'] : spec.key;
            const keys = new Set(existing[table].map(row => recordKey(row, keyFields)));
            const customNames = new Map(existing[table].filter(row => row.id < 0).map(row => [row.name, row.id]));
            let nextCustomId = existing[table].reduce((minimum, row) => Math.min(minimum, Number(row.id) || 0), 0) - 1;
            for (const original of input.tables[table]) {
                const row = { ...original };
                if (Object.hasOwn(metadataIds, table)) {
                    // Negative IDs are local to each library; names preserve their identity across imports.
                    if (row.id < 0) {
                        if (customNames.has(row.name)) {
                            metadataIds[table].set(original.id, customNames.get(row.name));
                            result[table].skipped += 1;
                            continue;
                        }
                        if (keys.has(recordKey(row, spec.key))) row.id = nextCustomId;
                        nextCustomId = Math.min(nextCustomId, row.id) - 1;
                        customNames.set(row.name, row.id);
                    }
                    metadataIds[table].set(original.id, row.id);
                }
                if (Object.hasOwn(row, 'circle_id')) row.circle_id = metadataIds.t_circle.get(row.circle_id);
                if (Object.hasOwn(row, 'tag_id')) row.tag_id = metadataIds.t_tag.get(row.tag_id);
                if (table === 't_saved_search') {
                    const search = JSON.parse(row.query);
                    for (const [key, metadataTable] of [['tagId', 't_tag'], ['circleId', 't_circle']]) {
                        if (search.query[key] && metadataIds[metadataTable].has(Number(search.query[key]))) search.query[key] = String(metadataIds[metadataTable].get(Number(search.query[key])));
                    }
                    if (search.query.collectionId) {
                        const source = input.tables.t_work_collection.find(item => item.id === Number(search.query.collectionId) && item.user_name === original.user_name);
                        const target = source && await trx('t_work_collection').where({ user_name: options.users[source.user_name], name: source.name }).first();
                        if (target) search.query.collectionId = String(target.id);
                        else search.unavailable = true;
                    }
                    row.query = JSON.stringify(search);
                }
                if (Object.hasOwn(row, 'user_name')) {
                    row.user_name = options.users[row.user_name];
                    if (row.user_name === null) { result[table].skipped += 1; continue; }
                }
                if (Object.hasOwn(row, 'root_folder')) row.root_folder = options.roots[row.root_folder];
                if (['r_tag_work', 'r_va_work', 't_work_availability'].includes(table) && !newWorks.has(row.work_id)) { result[table].skipped += 1; continue; }
                if (table === 't_playlist_item' || table === 't_work_collection_item') {
                    const parent = table === 't_playlist_item' ? 't_playlist' : 't_work_collection';
                    const column = table === 't_playlist_item' ? 'playlist_id' : 'collection_id';
                    if (!parentIds[parent].has(row[column])) { result[table].skipped += 1; continue; }
                    row[column] = parentIds[parent].get(row[column]);
                }
                const key = recordKey(row, keyFields);
                if (!['t_playlist_item', 't_work_collection_item'].includes(table) && keys.has(key)) { result[table].skipped += 1; continue; }
                if (table === 't_work') {
                    const location = recordKey(row, ['root_folder', 'dir']);
                    if (workLocations.has(location) && workLocations.get(location) !== row.id) fail('pathCollision', { id: row.id });
                    workLocations.set(location, row.id);
                    newWorks.add(row.id);
                }
                if (autoId) delete row.id;
                const inserted = await trx(table).insert(row);
                if (list && parentIds[table]) parentIds[table].set(original.id, Number(inserted[0]));
                keys.add(key);
                result[table].added += 1;
            }
        }
        return result;
    });
}

module.exports = { MAX_BYTES, TABLES, readImport, previewImport, exportData, importData };
