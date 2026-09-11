"use strict";

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { isPathInside } = require('./pathSafety');
const { supportedMediaExtList } = require('./utils');
const { config } = require('../config');
const { Minimatch } = require('minimatch');

async function inspectWorkFolder(root, relativePath) {
    try {
        await fs.readdir(root.path);
        const absolutePath = path.resolve(root.path, relativePath);
        if (!relativePath || !isPathInside(path.resolve(root.path), absolutePath)) {
            return { state: 'unavailable' };
        }
        let info;
        try { info = await fs.stat(absolutePath); }
        catch (error) {
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
                await fs.readdir(root.path);
                return { state: 'missing', fingerprint: 'missing' };
            }
            throw error;
        }
        if (!info.isDirectory()) return { state: 'missing', fingerprint: 'missing' };
        const rootRealPath = await fs.realpath(root.path);
        const hash = crypto.createHash('sha256');
        const excluded = (config.excludeFolderGlobs || []).map(rule => new Minimatch(rule));
        let mediaCount = 0;
        let busy = false;
        const visited = new Set();
        async function visit(directory) {
            const real = await fs.realpath(directory);
            if (!isPathInside(rootRealPath, real) || visited.has(real)) throw new Error('Invalid work directory link');
            visited.add(real);
            const entries = await fs.readdir(directory, { withFileTypes: true });
            entries.sort((a, b) => a.name.localeCompare(b.name));
            for (const entry of entries) {
                if (['.git', 'node_modules', '@eaDir', 'System Volume Information'].includes(entry.name)) continue;
                const fullPath = path.join(directory, entry.name);
                const stat = await fs.stat(fullPath);
                if (stat.isDirectory()) { await visit(fullPath); continue; }
                if (!stat.isFile()) continue;
                if (excluded.some(matcher => matcher.match(fullPath))) continue;
                const fileRealPath = await fs.realpath(fullPath);
                if (!isPathInside(rootRealPath, fileRealPath)) throw new Error('Invalid work file link');
                hash.update(JSON.stringify([path.relative(absolutePath, fullPath), stat.size, stat.mtimeMs, stat.ctimeMs]));
                const media = supportedMediaExtList.includes(path.extname(entry.name).toLowerCase());
                if (media) mediaCount++;
                if ((media && stat.size === 0) || /\.(part|partial|crdownload|download|tmp|!qB)$/i.test(entry.name)) busy = true;
            }
        }
        await visit(absolutePath);
        return { state: mediaCount ? 'present' : 'empty', fingerprint: hash.digest('hex'), busy, mediaCount };
    }
    catch (error) {
        return { state: 'unavailable', error: error.code || error.message };
    }
}

module.exports = { inspectWorkFolder };
