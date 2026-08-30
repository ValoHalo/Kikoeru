exports.up = async function (knex) {
    if (!(await knex.schema.hasTable('t_playlist'))) {
        await knex.schema.createTable('t_playlist', (table) => {
            table.increments('id');
            table.string('user_name').notNullable();
            table.string('name', 80).notNullable();
            table.timestamps(true, true);
            table.foreign('user_name').references('name').inTable('t_user').onDelete('CASCADE');
            table.unique(['user_name', 'name']);
        });
    }
    if (!(await knex.schema.hasTable('t_playlist_item'))) {
        await knex.schema.createTable('t_playlist_item', (table) => {
            table.increments('id');
            table.integer('playlist_id').unsigned().notNullable();
            table.bigInteger('work_id').unsigned().notNullable();
            table.text('relative_path').notNullable();
            table.string('title', 512).notNullable();
            table.string('work_title', 512).notNullable().defaultTo('');
            table.integer('position').unsigned().notNullable();
            table.foreign('playlist_id').references('id').inTable('t_playlist').onDelete('CASCADE');
            table.index(['playlist_id', 'position']);
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('t_playlist_item');
    await knex.schema.dropTableIfExists('t_playlist');
};
