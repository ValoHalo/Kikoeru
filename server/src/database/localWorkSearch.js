"use strict";

const normalizePath = value => value.replace(/\\/g, '/');

function localWorkIds(knex, keyword) {
    // Treat filename punctuation literally, including SQL LIKE wildcards.
    const pattern = `%${normalizePath(keyword).replace(/[!%_]/g, '!$&')}%`;
    const query = knex('t_work').select('id').whereRaw(
        "LOWER(REPLACE(dir, CHAR(92), '/')) LIKE LOWER(?) ESCAPE '!'", [pattern]);
    const memo = "CASE WHEN JSON_VALID(memo) THEN memo ELSE '{}' END";
    for (const field of ['mtime', 'duration']) {
        if (knex.client.config.client.includes('mysql')) {
            query.orWhereRaw(`JSON_SEARCH(LOWER(REPLACE(JSON_KEYS(${memo}, ?),
                CONCAT(CHAR(92), CHAR(92)), '/')), 'one', LOWER(?), '!') IS NOT NULL`,
            [`$.${field}`, pattern]);
        } else {
            query.orWhereRaw(`EXISTS (SELECT 1 FROM json_each(${memo}, ?) AS local_file
                WHERE typeof(local_file.key) = 'text'
                AND LOWER(REPLACE(local_file.key, CHAR(92), '/')) LIKE LOWER(?) ESCAPE '!')`,
            [`$.${field}`, pattern]);
        }
    }
    return query;
}

function localSearchMatch(work, keywords) {
    const needles = keywords.filter(value => typeof value === 'string' && value.trim())
        .map(value => normalizePath(value).toLowerCase());
    const matches = value => typeof value === 'string'
        && needles.some(needle => normalizePath(value).toLowerCase().includes(needle));
    if (matches(work.dir)) return { type: 'directory', name: normalizePath(work.dir) };

    let memo;
    try {
        memo = typeof work.memo === 'string' ? JSON.parse(work.memo) : work.memo;
    } catch {
        return null;
    }
    for (const field of ['mtime', 'duration']) {
        const files = memo?.[field];
        if (!files || typeof files !== 'object' || Array.isArray(files)) continue;
        const name = Object.keys(files).find(matches);
        if (name) return { type: 'track', name: normalizePath(name) };
    }
    return null;
}

module.exports = { localWorkIds, localSearchMatch };
