exports.up = async function (knex) {
    if (!(await knex.schema.hasColumn('t_bookmark', 'name'))) {
        await knex.schema.alterTable('t_bookmark', (table) => {
            table.string('name', 120).notNullable().defaultTo('');
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.alterTable('t_bookmark', (table) => {
        table.dropColumn('name');
    });
};
