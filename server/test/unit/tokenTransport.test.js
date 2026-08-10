"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { AUTH_COOKIE_NAME, getToken, setAuthCookie } = require("../../src/auth/token");

test("bearer authorization remains the migration path for existing clients", () => {
    assert.equal(getToken({ headers: { authorization: "Bearer header-token" } }), "header-token");
});

test("HttpOnly session cookie authenticates browser media requests", () => {
    const request = { headers: { cookie: `theme=dark; ${AUTH_COOKIE_NAME}=cookie-token%2Evalue` } };
    assert.equal(getToken(request), "cookie-token.value");
});

test("authentication cookie persists for the JWT lifetime", () => {
    let cookieOptions;
    const response = {
        cookie: (_name, _token, options) => {
            cookieOptions = options;
        },
    };

    setAuthCookie(response, "cookie-token", { expiresIn: 2592000 });

    assert.equal(cookieOptions.maxAge, 2592000000);
});

test("query-string tokens are not accepted", () => {
    assert.equal(getToken({ headers: {}, query: { token: "leaked-token" } }), null);
});
