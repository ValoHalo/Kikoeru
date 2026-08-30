"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbVersion = exports.createSchema = void 0;
const db_1 = require("./db");
const knexfile_1 = require("./knexfile");
const dbVersion = '20210502081522';
exports.dbVersion = dbVersion;
const createSchema = (connection = db_1.knex) => connection.schema
    .createTable('t_circle', (table) => {
    table.increments();
    table.string('name').notNullable();
})
    .createTable('t_work', (table) => {
    table.bigIncrements('id');
    table.timestamps(true, true);
    table.string('root_folder').notNullable();
    table.string('dir').notNullable();
    table.string('title').notNullable();
    table.integer('circle_id').unsigned().notNullable();
    table.boolean('nsfw');
    table.string('release');
    table.integer('dl_count');
    table.integer('price');
    table.integer('review_count');
    table.integer('rate_count');
    table.float('rate_average_2dp');
    table.text('rate_count_detail');
    table.text('rank');
    table.string('lyric_status').notNullable();
    table.bigInteger('original_work_id').notNullable().defaultTo(0);
    table.json('memo');
    table.integer('is_custom_meta').defaultTo(0);
    table.foreign('circle_id').references('id').inTable('t_circle');
    table.index(['circle_id', 'release', 'dl_count', 'review_count', 'price', 'rate_average_2dp'], 't_work_index');
})
    .createTable('t_tag', (table) => {
    table.increments();
    table.string('name').notNullable();
})
    .createTable('t_va', (table) => {
    table.string('id');
    table.string('name').notNullable();
    table.primary(['id']);
})
    .createTable('r_tag_work', (table) => {
    table.integer('tag_id').unsigned();
    table.bigInteger('work_id').unsigned();
    table.foreign('tag_id').references('id').inTable('t_tag');
    table.foreign('work_id').references('id').inTable('t_work');
    table.primary(['tag_id', 'work_id']);
})
    .createTable('r_va_work', (table) => {
    table.string('va_id');
    table.bigInteger('work_id').unsigned();
    table.foreign('va_id').references('id').inTable('t_va').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('work_id').references('id').inTable('t_work').onUpdate('CASCADE').onDelete('CASCADE');
    table.primary(['va_id', 'work_id']);
})
    .createTable('t_user', (table) => {
    table.string('name').notNullable();
    table.string('password').notNullable();
    table.string('group').notNullable();
    table.primary(['name']);
})
    .createTable('t_review', (table) => {
    table.string('user_name').notNullable();
    table.bigInteger('work_id').unsigned().notNullable();
    table.integer('rating');
    table.string('review_text');
    table.timestamps(true, true);
    table.string('progress');
    table.foreign('user_name').references('name').inTable('t_user').onDelete('CASCADE');
    table.foreign('work_id').references('id').inTable('t_work').onDelete('CASCADE');
    table.primary(['user_name', 'work_id']);
})
    .createTable('t_play_histroy', (table) => {
    table.string('user_name').notNullable();
    table.bigInteger('work_id').unsigned().notNullable();
    table.timestamps(true, true);
    table.json('state').notNullable();
    table.foreign('user_name').references('name').inTable('t_user').onDelete('CASCADE');
    table.foreign('work_id').references('id').inTable('t_work').onDelete('CASCADE');
    table.primary(['user_name', 'work_id']);
})
    .createTable('t_playlist', (table) => {
    table.increments('id');
    table.string('user_name').notNullable();
    table.string('name', 80).notNullable();
    table.timestamps(true, true);
    table.foreign('user_name').references('name').inTable('t_user').onDelete('CASCADE');
    table.unique(['user_name', 'name']);
})
    .createTable('t_playlist_item', (table) => {
    table.increments('id');
    table.integer('playlist_id').unsigned().notNullable();
    table.bigInteger('work_id').unsigned().notNullable();
    table.text('relative_path').notNullable();
    table.string('title', 512).notNullable();
    table.string('work_title', 512).notNullable().defaultTo('');
    table.integer('position').unsigned().notNullable();
    table.foreign('playlist_id').references('id').inTable('t_playlist').onDelete('CASCADE');
    table.index(['playlist_id', 'position']);
})
    .raw(`DROP VIEW IF EXISTS staticMetadata;`)
    .raw(`
    CREATE VIEW staticMetadata AS
    WITH 
    workWithVa AS (
      SELECT
        r_va_work.work_id AS va_work_id,
        ${knexfile_1.dbSpecifiedFunctionName.jsonArrayAgg}(t_va.name) AS vaNames,
        ${knexfile_1.dbSpecifiedFunctionName.jsonArrayAgg}(t_va.id) AS vaIds
      from r_va_work
      JOIN t_va ON r_va_work.va_id = t_va.id 
      GROUP BY r_va_work.work_id
    ),
    workWithTag AS (
      SELECT 
        r_tag_work.work_id AS tag_work_id,
        ${knexfile_1.dbSpecifiedFunctionName.jsonArrayAgg}(t_tag.name) AS tagNames,
        ${knexfile_1.dbSpecifiedFunctionName.jsonArrayAgg}(t_tag.id) AS tagIds 
      from r_tag_work
      JOIN t_tag ON r_tag_work.tag_id = t_tag.id
      GROUP BY r_tag_work.work_id
    ),
    relatedWorks AS (
      SELECT
        stw.original_work_id AS source_original_work_id,
        ${knexfile_1.dbSpecifiedFunctionName.jsonArrayAgg}(stw.id) AS related_work_ids,
        ${knexfile_1.dbSpecifiedFunctionName.jsonArrayAgg}(stw.title) AS related_work_titles
      FROM t_work AS stw
      WHERE stw.original_work_id IS NOT NULL
      GROUP BY stw.original_work_id
    )

    SELECT 
      t_work.id,
      t_work.created_at,
      t_work.updated_at,
      t_work.title,
      t_work.circle_id,
      t_circle.name,
      t_work.nsfw,
      t_work.release,
      json_object('id', t_work.circle_id, 'name', t_circle.name) AS circleObj,
      t_work.dl_count,
      t_work.price,
      t_work.review_count,
      t_work.rate_count,
      t_work.rate_average_2dp,
      t_work.rate_count_detail,
      t_work.rank,
      t_work.lyric_status,
      t_work.original_work_id,
      t_work.memo,
      relatedWorks.related_work_ids,
      relatedWorks.related_work_titles,
		  workWithVa.vaNames,
		  workWithVa.vaIds,
		  workWithTag.tagNames,
		  workWithTag.tagIds
    FROM t_work
    LEFT JOIN workWithVa ON workWithVa.va_work_id = t_work.id
    LEFT JOIN workWithTag ON workWithTag.tag_work_id = t_work.id
    LEFT JOIN t_circle ON t_circle.id = t_work.circle_id
    LEFT JOIN relatedWorks ON relatedWorks.source_original_work_id = t_work.original_work_id
    ;
  `)
    .then(() => {
    console.log(' * 成功构建数据库结构.');
})
    .catch((err) => {
    if (err.toString().indexOf('table `t_circle` already exists') !== -1) {
        console.log(' * 数据库结构已经存在.');
    }
    else {
        throw err;
    }
});
exports.createSchema = createSchema;
