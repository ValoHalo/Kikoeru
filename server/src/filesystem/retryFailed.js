"use strict";
process.env.KIKOERU_RETRY_COVERS = '1';

const { performRetryFailed } = require("./scannerModules");

performRetryFailed();
