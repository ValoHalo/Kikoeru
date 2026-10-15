"use strict";

function normalizeSavedSearch(value) {
    if (!value || !['/works', '/search'].includes(value.path) || !value.query || !value.filters || JSON.stringify(value).length > 32768) throw new TypeError('Invalid saved search');
    const query = {};
    for (const key of ['keyword', 'circleId', 'tagId', 'vaId', 'collectionId']) {
        if (value.query[key] === undefined) continue;
        if (typeof value.query[key] !== 'string' || value.query[key].length > 2048) throw new TypeError('Invalid saved search query');
        query[key] = value.query[key];
    }
    const filters = value.filters;
    if (!['release', 'rating', 'dl_count', 'price', 'rate_average_2dp', 'review_count', 'id', 'created_at', 'random'].includes(filters.order)
        || !['asc', 'desc'].includes(filters.sort) || ![0, 1, 2].includes(filters.nsfw)
        || !Array.isArray(filters.lyric) || filters.lyric.some(item => !['lyric_local'].includes(item))
        || !Array.isArray(filters.keywords) || filters.keywords.length > 100
        || filters.keywords.some(item => !item || ![0, 1, 2, 3, 4].includes(item.t) || typeof item.d !== 'string' || item.d.length > 2048)) throw new TypeError('Invalid saved search filters');
    return { path: value.path, query, filters: { order: filters.order, sort: filters.sort, nsfw: filters.nsfw, lyric: filters.lyric, keywords: filters.keywords.map(({ t, d }) => ({ t, d })) }, ...(value.unavailable === true ? { unavailable: true } : {}) };
}
module.exports = { normalizeSavedSearch };
