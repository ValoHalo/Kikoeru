"use strict";

const { AsyncLocalStorage } = require('node:async_hooks');
const i18next = require('i18next');
const messages = require('./locales/zh-CN.json');
const english = require('./locales/en.json');

const languageContext = new AsyncLocalStorage();
const i18n = i18next.createInstance();
i18n.init({
    initAsync: false,
    lng: 'zh-CN',
    fallbackLng: 'zh-CN',
    resources: { 'zh-CN': { translation: messages }, en: { translation: english } },
    interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
});

function t(key, params) {
    return (languageContext.getStore() || i18n.t.bind(i18n))(key, params);
}

function localizeRequest(req, _res, next) {
    const locale = req.acceptsLanguages(Object.keys(i18n.store.data)) || 'zh-CN';
    // Keep concurrent browser requests independent without changing API payloads.
    languageContext.run(i18n.getFixedT(locale), next);
}

module.exports = { i18n, t, localizeRequest };
