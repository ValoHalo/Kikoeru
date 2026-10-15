exports.up = knex => require('../clips').createClipTables(knex);
exports.down = async knex => {
    await knex.schema.dropTableIfExists('t_clip_playlist_item');
    await knex.schema.dropTableIfExists('t_clip_playlist');
    await knex.schema.dropTableIfExists('t_clip');
};
