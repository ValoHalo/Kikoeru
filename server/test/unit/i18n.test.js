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
        const [fixture, chinese, unsupported, english, american, british, preferred] = await Promise.all(['test', 'zh-CN', 'fr', 'en', 'en-US', 'en-GB', 'en-GB,en;q=0.9,zh-CN;q=0.8'].map(language => fetch(url, {
            headers: { 'Accept-Language': language },
        }).then(response => response.json())));
        assert.deepEqual(fixture, { error: '[test] Alice' });
        assert.deepEqual(chinese, { error: '用户 Alice 已存在.' });
        assert.deepEqual(unsupported, chinese);
        assert.deepEqual(english, { error: 'User Alice already exists.' });
        assert.deepEqual(american, english);
        assert.deepEqual(british, english);
        assert.deepEqual(preferred, english);
        assert.equal(t('credentials.userExists', { name: 'Bob' }), '用户 Bob 已存在.');
    } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        i18n.removeResourceBundle('test', 'translation');
    }
});

test('English messages preserve parameters and use singular and plural forms', () => {
    const english = i18n.getFixedT('en');
    const name = 'Alice <test> {name}';
    assert.equal(english('credentials.userExists', { name }), `User ${name} already exists.`);
    assert.equal(english('media.folderMissing', { root_folder: 'D:\\Audio' }), 'Folder not found: "D:\\Audio". Try restarting the server or rescanning.');
    for (const count of [0, 1, 2]) {
        assert.equal(english('library.added', { count }), `Added ${count} ${count === 1 ? 'work' : 'works'}`);
        assert.equal(english('scanFailures.cleared', { count }), `Cleared ${count} failure ${count === 1 ? 'record' : 'records'}`);
    }
});

test('English covers every Chinese message with matching parameters and plural forms', () => {
    function flatten(object, prefix = '') {
        return Object.entries(object).flatMap(([key, value]) => {
            const name = prefix ? `${prefix}.${key}` : key;
            return typeof value === 'string' ? [[name, value]] : flatten(value, name);
        });
    }
    const chinese = new Map(flatten(require('../../src/i18n/locales/zh-CN.json')));
    const english = new Map(flatten(require('../../src/i18n/locales/en.json')));
    const parameters = value => [...new Set([...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort();
    for (const [key, message] of chinese) {
        const variants = english.has(key) ? [key] : ['one', 'other'].map(form => `${key}_${form}`);
        for (const variant of variants) {
            assert.ok(english.has(variant), `Missing English message: ${variant}`);
            assert.deepEqual(parameters(english.get(variant)), parameters(message), variant);
        }
    }
    for (const key of english.keys()) assert.ok(chinese.has(key.replace(/_(one|other)$/, '')), `Unknown message: ${key}`);
});
