#!/usr/bin/env node



var RpcClient = require('../node_modules/bitcore/RpcClient').class();


var block_hash = process.argv[2] || '0000000000b6288775bbd326bedf324ca8717a15191da58391535408205aada4';

var rpc = new RpcClient({
  user: 'mystery',
  pass: 'real_mystery',
  protocol: 'http',
});

var block = rpc.getBlock(block_hash, function(err, block) {

  console.log("Err:");
  console.log(err);


  console.log("Block info:");
  console.log(block);
});



