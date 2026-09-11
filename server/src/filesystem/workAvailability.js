"use strict";

const { inspectWorkFolder } = require('./workSnapshot');

async function setWorkMissing(db, workId, missing) {
    if (missing) {
        await db.knex('t_work_availability').insert({ work_id: workId }).onConflict('work_id').ignore();
    }
    else {
        await db.knex('t_work_availability').where('work_id', workId).del();
    }
}

async function reconcileAvailability(db, roots) {
    const works = await db.knex('t_work').select('id', 'root_folder', 'dir');
    const byName = new Map(roots.map(root => [root.name, root]));
    for (const work of works) {
        const root = byName.get(work.root_folder);
        if (!root) continue;
        const snapshot = await inspectWorkFolder(root, work.dir);
        if (snapshot.state === 'unavailable' || snapshot.busy) continue;
        await setWorkMissing(db, work.id, snapshot.state !== 'present');
    }
}

module.exports = { setWorkMissing, reconcileAvailability };
