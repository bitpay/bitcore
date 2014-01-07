#!/usr/bin/env node
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var RpcClient = require('../node_modules/bitcore/RpcClient').class();

var config = require('../config/config');


var block_hash = process.argv[2] || '0000000000b6288775bbd326bedf324ca8717a15191da58391535408205aada4';


var rpc   = new RpcClient(config.bitcoind);

var block = rpc.getBlock(block_hash, function(err, block) {

  console.log("Err:");
  console.log(err);


  console.log("Block info:");
  console.log(block);
});



