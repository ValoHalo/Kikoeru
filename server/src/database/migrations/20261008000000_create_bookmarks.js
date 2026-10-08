exports.up = async function (knex) {
    if (!(await knex.schema.hasTable('t_bookmark'))) {
        await knex.schema.createTable('t_bookmark', (table) => {
            table.increments('id');
            table.string('user_name').notNullable();
            table.bigInteger('work_id').unsigned().notNullable();
            table.text('relative_path').notNullable();
            table.integer('seconds').unsigned().notNullable();
            table.string('note', 500).notNullable().defaultTo('');
            table.foreign('user_name').references('name').inTable('t_user').onDelete('CASCADE');
            table.foreign('work_id').references('id').inTable('t_work').onDelete('CASCADE');
            table.index(['user_name', 'work_id']);
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('t_bookmark');
};
