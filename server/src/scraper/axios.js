"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryGet = retryGet;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
const httpClient = require("../network/httpClient");
async function retryGet(url, config) {
    let defaultLimit = config_1.config.retry || 5;
    let defaultRetryDelay = config_1.config.retryDelay || 2000;
    let defaultTimeout = 10000;
    if (url.indexOf('dlsite') !== -1) {
        defaultTimeout = config_1.config.dlsiteTimeout || defaultTimeout;
    }
    else if (url.indexOf('hvdb') !== -1) {
        defaultTimeout = config_1.config.hvdbTimeout || defaultTimeout;
    }
    config.retry = {
        limit: (config.retry && config.retry.limit) ? config.retry.limit : defaultLimit,
        retryCount: (config.retry && config.retry.retryCount) ? config.retry.retryCount : 0,
        retryDelay: (config.retry && config.retry.retryDelay) ? config.retry.retryDelay : defaultRetryDelay,
        timeout: (config.retry && config.retry.timeout) ? config.retry.timeout : defaultTimeout
    };
    const abort = axios_1.default.CancelToken.source();
    const timeoutId = setTimeout(() => abort.cancel(`Timeout of ${config.retry.timeout}ms.`), config.retry.timeout);
    config.cancelToken = abort.token;
    try {
        const response = await httpClient.get(url, config);
        clearTimeout(timeoutId);
        return response;
    }
    catch (error) {
        clearTimeout(timeoutId);
        const backoff = new Promise((resolve) => {
            setTimeout(() => resolve(), config.retry.retryDelay);
        });
        if (config.retry.retryCount < config.retry.limit && !error.response) {
            config.retry.retryCount += 1;
            await backoff;
            console.log(`${url} 第 ${config.retry.retryCount} 次重试请求`);
            return retryGet(url, config);
        }
        else {
            throw error;
        }
    }
}
;
