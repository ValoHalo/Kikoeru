exports.up = async function (knex) {
    if (await knex.schema.hasTable('t_work_availability')) return;
    await knex.schema.createTable('t_work_availability', table => {
        table.bigInteger('work_id').unsigned().primary();
        table.timestamp('missing_since').notNullable().defaultTo(knex.fn.now());
        table.foreign('work_id').references('id').inTable('t_work').onDelete('CASCADE');
    });
};
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('t_work_availability');
};
