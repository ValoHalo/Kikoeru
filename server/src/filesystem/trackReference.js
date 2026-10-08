"use strict";

const path = require('path');
const { resolvePathInside } = require('./pathSafety');

function normalizeTrackPath(value) {
    if (typeof value !== 'string') throw new TypeError('Invalid track path');
    const relativePath = value.replace(/\\/g, '/');
    if (path.win32.isAbsolute(relativePath) || relativePath.split('/').some(part => !part || part === '.' || part === '..')) {
        throw new Error('Invalid track path');
    }
    resolvePathInside(path.resolve('.'), relativePath);
    return relativePath;
}

function encodeTrackPath(relativePath) {
    return `p_${Buffer.from(normalizeTrackPath(relativePath), 'utf8').toString('base64url')}`;
}

function decodeTrackPath(reference) {
    if (typeof reference !== 'string' || !/^p_[A-Za-z0-9_-]+$/.test(reference)) throw new Error('Invalid track reference');
    const relativePath = Buffer.from(reference.slice(2), 'base64url').toString('utf8');
    if (encodeTrackPath(relativePath) !== reference) throw new Error('Invalid track reference');
    return relativePath;
}

function restoreTrackReference(track, workId) {
    let relativePath = track.relativePath || [track.subtitle, track.title].filter(Boolean).join('/');
    try {
        if (!relativePath) relativePath = decodeTrackPath(String(track.hash || '').split('/')[1]);
        relativePath = normalizeTrackPath(relativePath);
        track.relativePath = relativePath;
        track.hash = `${workId}/${encodeTrackPath(relativePath)}`;
    }
    catch {
        // A bare legacy index cannot identify its original file.
        track.hash = `${workId}/unavailable`;
    }
    track.mediaStreamUrl = `/api/media/stream/${track.hash}`;
    track.mediaDownloadUrl = `/api/media/download/${track.hash}`;
}

module.exports = { normalizeTrackPath, encodeTrackPath, decodeTrackPath, restoreTrackReference };
