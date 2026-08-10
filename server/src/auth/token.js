"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_COOKIE_NAME = void 0;
exports.getToken = getToken;
exports.setAuthCookie = setAuthCookie;
exports.clearAuthCookie = clearAuthCookie;

const AUTH_COOKIE_NAME = 'kikoeru_access_token';
exports.AUTH_COOKIE_NAME = AUTH_COOKIE_NAME;

function getCookieValue(req, name) {
    const header = req && req.headers && req.headers.cookie;
    if (typeof header !== 'string') {
        return null;
    }
    for (const part of header.split(';')) {
        const separator = part.indexOf('=');
        if (separator === -1) {
            continue;
        }
        const key = part.slice(0, separator).trim();
        if (key !== name) {
            continue;
        }
        try {
            return decodeURIComponent(part.slice(separator + 1));
        }
        catch (_err) {
            return null;
        }
    }
    return null;
}

function getToken(req) {
    const authorization = req && req.headers && req.headers.authorization;
    if (typeof authorization === 'string') {
        const [scheme, token] = authorization.trim().split(/\s+/, 2);
        if (scheme === 'Bearer' && token) {
            return token;
        }
    }
    return getCookieValue(req, AUTH_COOKIE_NAME);
}

function getCookieOptions(config) {
    return {
        httpOnly: true,
        sameSite: 'strict',
        secure: Boolean(config && config.httpsEnabled),
        path: '/',
    };
}

function setAuthCookie(res, token, config) {
    if (typeof token === 'string' && token) {
        const expiresInSeconds = Number(config && config.expiresIn);
        const options = getCookieOptions(config);
        if (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0) {
            options.maxAge = expiresInSeconds * 1000;
        }
        res.cookie(AUTH_COOKIE_NAME, token, options);
    }
}

function clearAuthCookie(res, config) {
    res.clearCookie(AUTH_COOKIE_NAME, getCookieOptions(config));
}
