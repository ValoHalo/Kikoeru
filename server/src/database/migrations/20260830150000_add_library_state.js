exports.up = async function (knex) {
    if (!(await knex.schema.hasTable('t_scan_failure'))) {
        await knex.schema.createTable('t_scan_failure', (table) => {
            table.increments('id');
            table.string('code', 16).notNullable();
            table.string('root_folder').notNullable();
            table.string('relative_dir', 1024).notNullable();
            table.string('stage', 32).notNullable().defaultTo('metadata');
            table.text('message').notNullable();
            table.integer('attempts').unsigned().notNullable().defaultTo(1);
            table.timestamps(true, true);
            table.index(['code', 'root_folder']);
        });
    }
    if (!(await knex.schema.hasTable('t_work_user_state'))) {
        await knex.schema.createTable('t_work_user_state', (table) => {
            table.string('user_name').notNullable();
            table.bigInteger('work_id').unsigned().notNullable();
            table.timestamp('archived_at').notNullable().defaultTo(knex.fn.now());
            table.foreign('user_name').references('name').inTable('t_user').onDelete('CASCADE');
            table.foreign('work_id').references('id').inTable('t_work').onDelete('CASCADE');
            table.primary(['user_name', 'work_id']);
        });
    }
    if (!(await knex.schema.hasTable('t_work_collection'))) {
        await knex.schema.createTable('t_work_collection', (table) => {
            table.increments('id');
            table.string('user_name').notNullable();
            table.string('name', 80).notNullable();
            table.timestamps(true, true);
            table.foreign('user_name').references('name').inTable('t_user').onDelete('CASCADE');
            table.unique(['user_name', 'name']);
        });
    }
    if (!(await knex.schema.hasTable('t_work_collection_item'))) {
        await knex.schema.createTable('t_work_collection_item', (table) => {
            table.increments('id');
            table.integer('collection_id').unsigned().notNullable();
            table.bigInteger('work_id').unsigned().notNullable();
            table.integer('position').unsigned().notNullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.foreign('collection_id').references('id').inTable('t_work_collection').onDelete('CASCADE');
            table.foreign('work_id').references('id').inTable('t_work').onDelete('CASCADE');
            table.unique(['collection_id', 'work_id']);
            table.index(['collection_id', 'position']);
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('t_work_collection_item');
    await knex.schema.dropTableIfExists('t_work_collection');
    await knex.schema.dropTableIfExists('t_work_user_state');
    await knex.schema.dropTableIfExists('t_scan_failure');
};
