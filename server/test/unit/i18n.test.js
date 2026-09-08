"use strict";

const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const { i18n, t, localizeRequest } = require('../../src/i18n');

test('Chinese messages preserve interpolated names and paths', () => {
    const name = 'Alice <test> {name}';
    assert.equal(t('credentials.userExists', { name }), `用户 ${name} 已存在.`);
    assert.equal(t('media.folderMissing', { root_folder: 'D:\\Audio' }), '找不到文件夹: "D:\\Audio"，请尝试重启服务器或重新扫描.');
});

test('request languages remain independent across asynchronous responses', async () => {
    i18n.addResourceBundle('test', 'translation', { credentials: { userExists: '[test] {name}' } });
    const app = express();
    app.use(localizeRequest);
    app.get('/', async (req, res) => {
        await new Promise(resolve => setImmediate(resolve));
        res.json({ error: t('credentials.userExists', { name: req.query.name }) });
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/?name=Alice`;
    try {
        const [fixture, chinese, unsupported] = await Promise.all(['test', 'zh-CN', 'fr'].map(language => fetch(url, {
            headers: { 'Accept-Language': language },
        }).then(response => response.json())));
        assert.deepEqual(fixture, { error: '[test] Alice' });
        assert.deepEqual(chinese, { error: '用户 Alice 已存在.' });
        assert.deepEqual(unsupported, chinese);
        assert.equal(t('credentials.userExists', { name: 'Bob' }), '用户 Bob 已存在.');
    } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        i18n.removeResourceBundle('test', 'translation');
    }
});
