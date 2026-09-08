"use strict";

const fs = require('node:fs');
const path = require('node:path');
const { parse: parseSfc } = require('@vue/compiler-sfc');
const { parse: parseTemplate } = require('@vue/compiler-dom');
const babel = require('@babel/parser');
const { baseCompile } = require('@intlify/message-compiler');

const root = path.resolve(__dirname, '../src');
const messages = require('../src/i18n/locales/zh-CN.json');
const errors = [];
const han = /\p{Script=Han}/u;

function children(node) {
    return Object.entries(node).filter(([key]) => !['loc', 'comments', 'extra'].includes(key))
        .flatMap(([, value]) => Array.isArray(value) ? value : [value])
        .filter(value => value && typeof value === 'object' && 'type' in value);
}

function compileMessages(object, locale, parameters = new Map(), prefix = '') {
    for (const [name, value] of Object.entries(object)) {
        const key = prefix ? `${prefix}.${name}` : name;
        if (typeof value !== 'string') { compileMessages(value, locale, parameters, key); continue; }
        const names = new Set();
        const { ast } = baseCompile(value, { onError: error => errors.push(`${locale} ${key}: ${error.message}`) });
        const visit = node => {
            if (node.type === 4) names.add(node.key);
            children(node).forEach(visit);
        };
        visit(ast);
        parameters.set(key, names);
    }
    return parameters;
}

function checkJs(source, file, expression = false) {
    let ast;
    try {
        ast = expression ? babel.parseExpression(source) : babel.parse(source, { sourceType: 'module' });
    } catch (error) {
        if (expression) return checkJs(source, file);
        errors.push(`${file}: ${error.message}`);
        return;
    }
    const visit = node => {
        if (node.type === 'CallExpression' && source.slice(node.callee.start, node.callee.end).startsWith('console.')) return;
        if (node.type === 'StringLiteral' && han.test(node.value)) errors.push(`${file}: hardcoded text: ${node.value}`);
        if (node.type === 'TemplateLiteral' && node.quasis.some(part => han.test(part.value.cooked))) errors.push(`${file}: hardcoded template text`);
        if (node.type === 'CallExpression' && (['t', '$t'].includes(node.callee.name) || node.callee.property?.name === '$t')) {
            const key = node.arguments[0];
            if (key?.type === 'StringLiteral') {
                const required = parameters.get(key.value);
                if (!required) errors.push(`${file}: unknown message ${key.value}`);
                else {
                    const args = node.arguments[1];
                    const names = new Set(args?.type === 'ObjectExpression' ? args.properties.map(prop => prop.key?.name || prop.key?.value) : []);
                    for (const name of required) if (!names.has(name)) errors.push(`${file}: ${key.value} is missing parameter ${name}`);
                }
            }
        }
        children(node).forEach(visit);
    };
    visit(ast);
}

function checkTemplate(source, file) {
    const visit = node => {
        if (node.type === 2 && han.test(node.content)) errors.push(`${file}: hardcoded template text: ${node.content.trim()}`);
        if (node.type === 5) checkJs(node.content.content, file, true);
        for (const prop of node.props || []) {
            if (prop.type === 6 && prop.value && han.test(prop.value.content)) errors.push(`${file}: hardcoded ${prop.name}`);
            if (prop.type === 7 && prop.exp && prop.name !== 'for') checkJs(prop.exp.content, file, true);
        }
        (node.children || []).forEach(visit);
    };
    visit(parseTemplate(source));
}

function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) { if (entry.name !== 'i18n') visit(file); continue; }
        if (!/\.(vue|js)$/.test(file)) continue;
        const source = fs.readFileSync(file, 'utf8');
        const name = path.relative(root, file);
        if (file.endsWith('.js')) checkJs(source, name);
        else {
            const { descriptor } = parseSfc(source);
            if (descriptor.script) checkJs(descriptor.script.content, name);
            if (descriptor.template) checkTemplate(descriptor.template.content, name);
        }
    }
}

const parameters = compileMessages(messages, 'zh-CN');
const localeFiles = fs.readdirSync(path.join(root, 'i18n/locales')).filter(file => file.endsWith('.json'));
for (const file of localeFiles) {
    if (file === 'zh-CN.json') continue;
    const translated = compileMessages(JSON.parse(fs.readFileSync(path.join(root, 'i18n/locales', file), 'utf8')), file);
    for (const key of new Set([...parameters.keys(), ...translated.keys()])) {
        if (!parameters.has(key)) errors.push(`${file}: unknown message ${key}`);
        else if (!translated.has(key)) errors.push(`${file}: missing message ${key}`);
        else if ([...parameters.get(key)].sort().join(',') !== [...translated.get(key)].sort().join(',')) {
            errors.push(`${file}: parameter mismatch for ${key}`);
        }
    }
}
visit(root);
if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
} else console.log(`UI message checks passed for ${parameters.size} messages in ${localeFiles.length} locales.`);
