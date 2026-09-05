exports.up = async function (knex) {
    await knex.schema.table('t_work', table => {
        table.index(['release', 'id'], 't_work_release_id_index');
        table.index(['original_work_id', 'id'], 't_work_original_work_id_index');
    });
    await knex.schema.table('r_tag_work', table => {
        table.index(['work_id'], 'r_tag_work_work_id_index');
    });
    await knex.schema.table('r_va_work', table => {
        table.index(['work_id'], 'r_va_work_work_id_index');
    });
};

exports.down = async function (knex) {
    await knex.schema.table('r_va_work', table => {
        table.dropIndex(['work_id'], 'r_va_work_work_id_index');
    });
    await knex.schema.table('r_tag_work', table => {
        table.dropIndex(['work_id'], 'r_tag_work_work_id_index');
    });
    await knex.schema.table('t_work', table => {
        table.dropIndex(['original_work_id', 'id'], 't_work_original_work_id_index');
        table.dropIndex(['release', 'id'], 't_work_release_id_index');
    });
};
