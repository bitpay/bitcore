#! /usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var PeerSync = require('../lib/PeerSync').class();

var PROGRAM_VERSION = '0.1';
var program = require('commander');

program
  .version(PROGRAM_VERSION)
  .option('-N --network [testnet]', 'Set bitcoin network [testnet]', 'testnet')
  .parse(process.argv);

var ps = new PeerSync();
ps.init(program);
ps.run();


