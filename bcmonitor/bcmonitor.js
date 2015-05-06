#!/usr/bin/env node

'use strict';

var log = require('npmlog');
log.debug = log.verbose;

var config = require('../config');
var BlockchainExplorer = require('../lib/blockchainmonitor');

BlockchainExplorer.start(config, function(err) {
  if (err) throw err;

  console.log('Blockchain monitor started');
});
