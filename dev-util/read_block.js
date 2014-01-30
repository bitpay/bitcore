#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var assert        = require('assert'),
  config          = require('../config/config'),
  BlockExtractor  = require('../lib/BlockExtractor').class(),
  networks        = require('bitcore/networks'),
  util            = require('bitcore/util/util');

  var be = new BlockExtractor(config.bitcoind.dataDir, config.network);
  var network = config.network === 'testnet' ? networks.testnet: networks.livenet;
//  console.log('[read_block.js.13]', be.nextFile() );

  var c=0;
  while (c++ < 100) {
    be.getNextBlock(function(err, b) {
      console.log('[read_block.js.14]',err, c,  b?util.formatHashAlt(b.hash):''); //TODO
    });
  }




