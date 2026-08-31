"use strict";

const axios = require("axios");
const { httpOverHttp, httpsOverHttp } = require("tunnel-agent");
const { config } = require("../config");

const PROXY_MODES = Object.freeze({
    DIRECT: 'direct',
    ENVIRONMENT: 'environment',
    MANUAL: 'manual',
});

function resolveProxyMode(networkConfig = config) {
    if (Object.values(PROXY_MODES).includes(networkConfig.httpProxyMode)) {
        return networkConfig.httpProxyMode;
    }
    return Number(networkConfig.httpProxyPort) > 0
        ? PROXY_MODES.MANUAL
        : PROXY_MODES.DIRECT;
}

function applyNetworkConfig(requestConfig = {}, networkConfig = config) {
    const result = { ...requestConfig };
    const mode = resolveProxyMode(networkConfig);
    delete result.httpAgent;
    delete result.httpsAgent;

    if (mode === PROXY_MODES.ENVIRONMENT) {
        delete result.proxy;
        return result;
    }

    result.proxy = false;
    if (mode === PROXY_MODES.MANUAL) {
        const port = Number(networkConfig.httpProxyPort);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error('手动代理端口必须是 1 到 65535 之间的整数');
        }
        const tunnelOptions = {
            proxy: {
                host: String(networkConfig.httpProxyHost || '127.0.0.1').trim(),
                port,
            },
        };
        result.httpAgent = httpOverHttp(tunnelOptions);
        result.httpsAgent = httpsOverHttp(tunnelOptions);
    }
    return result;
}

function get(url, requestConfig = {}, networkConfig = config) {
    return axios.get(url, applyNetworkConfig(requestConfig, networkConfig));
}

function getEnvironmentProxyStatus() {
    return {
        http: Boolean(process.env.HTTP_PROXY || process.env.http_proxy),
        https: Boolean(process.env.HTTPS_PROXY || process.env.https_proxy),
        noProxy: Boolean(process.env.NO_PROXY || process.env.no_proxy),
    };
}

module.exports = {
    PROXY_MODES,
    applyNetworkConfig,
    get,
    getEnvironmentProxyStatus,
    resolveProxyMode,
};
