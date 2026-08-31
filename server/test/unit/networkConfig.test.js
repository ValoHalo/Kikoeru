"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "kikoeru-network-config-"));
process.env.KIKOERU_DATA_DIR = runtime;
process.env.FREEZE_CONFIG_FILE = "1";
process.env.NODE_ENV = "test";

const httpClient = require("../../src/network/httpClient");

test.after(() => {
    fs.rmSync(runtime, { recursive: true, force: true });
});

test("proxy mode preserves legacy manual proxy settings", () => {
    assert.equal(httpClient.resolveProxyMode({ httpProxyPort: 7890 }), "manual");
    assert.equal(httpClient.resolveProxyMode({ httpProxyPort: 0 }), "direct");
    assert.equal(httpClient.resolveProxyMode({ httpProxyMode: "environment", httpProxyPort: 7890 }), "environment");
});

test("direct and environment modes produce distinct axios settings", () => {
    const direct = httpClient.applyNetworkConfig({ headers: { accept: "application/json" }, proxy: { host: "stale" } }, {
        httpProxyMode: "direct",
    });
    assert.equal(direct.proxy, false);
    assert.equal(direct.httpAgent, undefined);
    assert.equal(direct.httpsAgent, undefined);
    assert.deepEqual(direct.headers, { accept: "application/json" });

    const environment = httpClient.applyNetworkConfig({ proxy: false }, {
        httpProxyMode: "environment",
    });
    assert.equal(Object.hasOwn(environment, "proxy"), false);
    assert.equal(environment.httpAgent, undefined);
    assert.equal(environment.httpsAgent, undefined);
});

test("manual proxy validates the port and replaces stale agents immediately", () => {
    assert.throws(() => httpClient.applyNetworkConfig({}, {
        httpProxyMode: "manual",
        httpProxyHost: "127.0.0.1",
        httpProxyPort: 0,
    }), /1 到 65535/);

    const request = { httpAgent: { stale: true }, httpsAgent: { stale: true } };
    const proxied = httpClient.applyNetworkConfig(request, {
        httpProxyMode: "manual",
        httpProxyHost: "proxy.local",
        httpProxyPort: 8080,
    });
    assert.notEqual(proxied.httpAgent, request.httpAgent);
    assert.notEqual(proxied.httpsAgent, request.httpsAgent);
    assert.equal(proxied.proxy, false);

    const direct = httpClient.applyNetworkConfig(proxied, { httpProxyMode: "direct" });
    assert.equal(direct.httpAgent, undefined);
    assert.equal(direct.httpsAgent, undefined);
    assert.equal(direct.proxy, false);
});

test("environment proxy status recognizes upper and lower case variables", () => {
    const names = ["HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy", "NO_PROXY", "no_proxy"];
    const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
    try {
        names.forEach(name => { delete process.env[name]; });
        process.env.http_proxy = "http://proxy.local:8080";
        process.env.HTTPS_PROXY = "http://proxy.local:8080";
        process.env.no_proxy = "localhost";
        assert.deepEqual(httpClient.getEnvironmentProxyStatus(), {
            http: true,
            https: true,
            noProxy: true,
        });
    }
    finally {
        names.forEach(name => {
            if (previous[name] === undefined)
                delete process.env[name];
            else
                process.env[name] = previous[name];
        });
    }
});
