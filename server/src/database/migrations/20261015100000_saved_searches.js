exports.up = async function (knex) {
    if (await knex.schema.hasTable('t_saved_search')) return;
    await knex.schema.createTable('t_saved_search', table => {
        table.increments('id');
        table.string('user_name').notNullable();
        table.string('name', 80).notNullable();
        table.json('query').notNullable();
        table.timestamps(true, true);
        table.foreign('user_name').references('name').inTable('t_user').onDelete('CASCADE');
        table.unique(['user_name', 'name']);
    });
};
exports.down = knex => knex.schema.dropTableIfExists('t_saved_search');
