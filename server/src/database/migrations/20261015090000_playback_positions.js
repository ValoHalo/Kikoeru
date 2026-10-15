exports.up = async function (knex) {
    if (await knex.schema.hasTable('t_play_position')) return;
    await knex.schema.createTable('t_play_position', table => {
        table.increments('id');
        table.string('user_name').notNullable();
        table.bigInteger('work_id').unsigned().notNullable();
        table.text('relative_path').notNullable();
        table.integer('seconds').unsigned().notNullable();
        table.string('reason', 16).notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.foreign('user_name').references('name').inTable('t_user').onDelete('CASCADE');
        table.foreign('work_id').references('id').inTable('t_work').onDelete('CASCADE');
        table.index(['user_name', 'id']);
    });
};
exports.down = knex => knex.schema.dropTableIfExists('t_play_position');
