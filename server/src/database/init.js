"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = void 0;
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("../auth/utils");
const knex_migrate_1 = require("./knex-migrate");
const db_1 = require("./db");
const package_json_1 = __importDefault(require("../../package.json"));
const compare_versions_1 = __importDefault(require("compare-versions"));
const config_1 = require("../config");
const schema_1 = require("./schema");
async function checkSupportedDatabase() {
    if (!['sqlite3', 'better-sqlite3'].includes(config_1.config.sqliteType))
        return;
    const unsupported = () => new Error('数据库需要是本仓库 v0.7.0 或更高版本已完成初始化或升级的数据库。请保留现有数据，先使用兼容的旧版本完成升级。');
    if (!(await db_1.knex.schema.hasTable('knex_migrations')))
        throw unsupported();
    // The legacy baseline and the first retained migration cover both old and fresh installations.
    const baseline = await db_1.knex('knex_migrations').whereIn('name', [
        '20260803090000_remove_ai_translation_tasks.js',
        '20260830090000_create_playlists.js',
    ]).first();
    if (!baseline)
        throw unsupported();
    for (const [table, columns] of [
        ['t_work', ['lyric_status', 'original_work_id', 'memo', 'is_custom_meta']],
        ['t_review', ['user_name', 'work_id', 'progress']],
        ['t_play_histroy', ['user_name', 'work_id', 'state']],
    ]) {
        const info = await db_1.knex(table).columnInfo();
        if (columns.some(column => !Object.hasOwn(info, column)))
            throw unsupported();
    }
}
function ensureDir(dirPath) {
    if (!fs_1.default.existsSync(dirPath)) {
        try {
            fs_1.default.mkdirSync(dirPath, { recursive: true });
        }
        catch (err) {
            console.error("ensureDir failed: ", err);
            return false;
        }
    }
    return true;
}
const initDatabase = async () => {
    let configVersion = config_1.config.version;
    let currentVersion = package_json_1.default.version;
    async function runMigrations() {
        await (0, knex_migrate_1.knexMigrate)('up', undefined, ({ action, migration }) => {
            console.log('Doing ' + action + ' on ' + migration);
        });
    }
    async function skipMigrations() {
        await (0, knex_migrate_1.knexMigrate)('skipAll', undefined);
    }
    function initDatabaseDir() {
        if (!ensureDir(config_1.config.databaseFolderDir)) {
            console.error(` ! 在创建存放数据库文件的文件夹时出错`);
        }
    }
    function ensureTranscodeDir() {
        if (!ensureDir(config_1.config.transcodeFolderDir)) {
            console.error(` ! 在创建存放转码文件的文件夹时出错`);
        }
        if (!ensureDir(config_1.config.transcodeTempFolderDir)) {
            console.error(` ! 在创建存放临时转码文件的文件夹时出错`);
        }
    }
    const databaseExist = await (0, db_1.checkDatabaseExists)();
    if (databaseExist) {
        try {
            await checkSupportedDatabase();
            // Always apply pending schema migrations. Maintenance releases can
            // add migrations without changing the legacy config version.
            await runMigrations();
            if (compare_versions_1.default.compare(currentVersion, configVersion, '>')) {
                (0, config_1.migrateConfigVersion)();
            }
        }
        catch (error) {
            console.log('升级迁移过程中出错，请在GitHub issues中报告作者');
            console.error(error);
            throw error;
        }
    }
    else if (!databaseExist) {
        initDatabaseDir();
        await (0, schema_1.createSchema)();
        try {
            await (0, db_1.createUser)({
                name: 'admin',
                password: (0, utils_1.md5)('admin'),
                group: 'administrator'
            });
        }
        catch (err) {
            console.error(err.message);
            throw err;
        }
        try {
            await skipMigrations();
        }
        catch (err) {
            console.error(` ! 在构建数据库结构过程中出错: ${err.message}`, err.stack);
            throw err;
        }
        if (compare_versions_1.default.compare(currentVersion, configVersion, '>')) {
            (0, config_1.migrateConfigVersion)();
        }
    }
    ensureTranscodeDir();
    await (0, db_1.fixDatabase)();
};
exports.initDatabase = initDatabase;
