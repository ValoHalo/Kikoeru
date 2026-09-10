"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    LOCAL_LISTEN_ADDRESS,
    getHttpListenAddress,
} = require("../../src/utils/listenAddress");

test("local mode always selects the IPv4 loopback address", () => {
    assert.equal(LOCAL_LISTEN_ADDRESS, "127.0.0.1");
    assert.equal(getHttpListenAddress(true, false), "127.0.0.1");
    assert.equal(getHttpListenAddress(true, true), "127.0.0.1");
});

test("remote mode keeps the configured address family", () => {
    assert.equal(getHttpListenAddress(false, false), "0.0.0.0");
    assert.equal(getHttpListenAddress(false, true), "::");
});
