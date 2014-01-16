#!/usr/bin/env node
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var RpcClient = require('../node_modules/bitcore/RpcClient').class();

var config = require('../config/config');
var util = require('util');


var tx = process.argv[2] || '91800d80bb4c69b238c9bfd94eb5155ab821e6b25cae5c79903d12853bbb4ed5';
var n = process.argv[3] || 0;


var rpc   = new RpcClient(config.bitcoind);


console.log("ARGS:", tx,n);
var block = rpc.getTxOut(tx, n, function(err, block) {

  console.log("Err:");
  console.log(err);


  console.log("TX info:");
  console.log(util.inspect(block,true,10));
});



