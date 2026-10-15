"use strict";
async function createClipTables(knex) {
    if (!(await knex.schema.hasTable('t_clip'))) await knex.schema.createTable('t_clip', table => {
        table.increments('id');
        table.string('user_name').notNullable();
        table.bigInteger('work_id').unsigned().notNullable();
        table.text('relative_path').notNullable();
        table.float('start_seconds').notNullable();
        table.float('end_seconds').notNullable();
        table.string('name', 120).notNullable();
        table.string('note', 500).notNullable().defaultTo('');
        table.timestamps(true, true);
        table.foreign('user_name').references('name').inTable('t_user').onDelete('CASCADE');
        table.foreign('work_id').references('id').inTable('t_work').onDelete('CASCADE');
        table.index(['user_name', 'work_id']);
    });
    if (!(await knex.schema.hasTable('t_clip_playlist'))) await knex.schema.createTable('t_clip_playlist', table => {
        table.increments('id');
        table.string('user_name').notNullable();
        table.string('name', 80).notNullable();
        table.timestamps(true, true);
        table.foreign('user_name').references('name').inTable('t_user').onDelete('CASCADE');
        table.unique(['user_name', 'name']);
    });
    if (!(await knex.schema.hasTable('t_clip_playlist_item'))) await knex.schema.createTable('t_clip_playlist_item', table => {
        table.increments('id');
        table.integer('clip_playlist_id').unsigned().notNullable();
        table.integer('clip_id').unsigned().notNullable();
        table.integer('position').unsigned().notNullable();
        table.foreign('clip_playlist_id').references('id').inTable('t_clip_playlist').onDelete('CASCADE');
        table.foreign('clip_id').references('id').inTable('t_clip').onDelete('CASCADE');
        table.index(['clip_playlist_id', 'position']);
    });
}
module.exports = { createClipTables };
