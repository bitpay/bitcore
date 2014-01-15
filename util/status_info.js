#!/usr/bin/env node
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var RpcClient = require('../node_modules/bitcore/RpcClient').class();

var config = require('../config/config');

var rpc   = new RpcClient(config.bitcoind);

var block = rpc.getInfo(function(err, block) {
  if (err) {
    console.log("Err:");
    console.log(err);
  }

  console.log("Block info:");
  console.log(block);
});


