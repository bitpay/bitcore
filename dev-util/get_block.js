#!/usr/bin/env node
'use strict';

var util = require('util');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var RpcClient = require('../node_modules/bitcore/RpcClient').class();

var config = require('../config/config');


// var hash = process.argv[2] || '0000000000b6288775bbd326bedf324ca8717a15191da58391535408205aada4';
var hash = process.argv[2] || 'f6c2901f39fd07f2f2e503183d76f73ecc1aee9ac9216fde58e867bc29ce674e';

hash = 'e2253359458db3e732c82a43fc62f56979ff59928f25a2df34dfa443e9a41160';

var rpc   = new RpcClient(config.bitcoind);

rpc.getRawTransaction( hash, 1, function(err, ret) {

  console.log('Err:');
  console.log(err);


  console.log('Ret:');
  console.log(util.inspect(ret, { depth: 10} ));
});



