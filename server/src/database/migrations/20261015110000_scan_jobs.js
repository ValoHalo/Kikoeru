exports.up = knex => require('../scanJobs').createScanTables(knex);
exports.down = async knex => {
    await knex.schema.dropTableIfExists('t_cover_status');
    await knex.schema.dropTableIfExists('t_scan_job_item');
    await knex.schema.dropTableIfExists('t_scan_job');
};
