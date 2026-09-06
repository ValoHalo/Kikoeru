"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.knexConnections = exports.dbSpecifiedFunctionName = void 0;
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const sqlite_type = config_1.config.sqliteType || "sqlite3";
console.warn("using sqlite type: ", sqlite_type);
config_1.config.sqliteType = sqlite_type;
let connection = {
    filename: path_1.default.join(config_1.config.databaseFolderDir, 'db.sqlite3'),
};
exports.dbSpecifiedFunctionName = {
    insertOrIgnore: "insert or ignore",
    jsonArrayAgg: "json_group_array",
};
if (sqlite_type.includes("mysql")) {
    connection = config_1.config.mysqlConnection;
    console.log("mysql connect = ", connection);
    exports.dbSpecifiedFunctionName = {
        insertOrIgnore: "insert ignore",
        jsonArrayAgg: "JSON_ARRAYAGG",
    };
}
exports.knexConnections = {
    development: {
        client: sqlite_type,
        useNullAsDefault: true,
        connection,
        acquireConnectionTimeout: 40000,
        pool: {
            afterCreate: (conn, done) => {
                if (sqlite_type === 'sqlite3') {
                    conn.run('PRAGMA foreign_keys = ON;', function (err) {
                        if (err) {
                            done(err, conn);
                        }
                        else {
                            conn.run(`PRAGMA busy_timeout = ${config_1.config.dbBusyTimeout};`, function (err) {
                                done(err, conn);
                            });
                        }
                    });
                }
                else if (sqlite_type === 'better-sqlite3') {
                    try {
                        conn.pragma('foreign_keys = ON');
                        conn.pragma(`busy_timeout = ${config_1.config.dbBusyTimeout}`);
                    }
                    catch (err) {
                        done(err, conn);
                        return;
                    }
                    done(null, conn);
                }
                else {
                    done(null, conn);
                }
            }
        }
    },
    upgrade: {
        client: sqlite_type,
        connection: connection,
        migrations: {
            tableName: 'knex_migrations'
        },
        pool: {},
    },
    testConfig: {
        client: sqlite_type,
        connection: {
            filename: path_1.default.join(__dirname, '../test/db-test.sqlite3'),
        },
        useNullAsDefault: true,
        migrations: {
            tableName: 'knex_migrations'
        },
        pool: {},
    },
};
Object.assign(module.exports, exports.knexConnections);
