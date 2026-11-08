'use strict';
const { makeClient } = require('./client');
const { createServer } = require('../../src/mockAdminServer');
module.exports = makeClient({ factory: createServer, baseEnv: 'ADMIN_BASE_URL' });
