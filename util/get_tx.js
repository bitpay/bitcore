#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var GET_TX_VERSION = 1;
var program        = require('commander');
var RpcClient      = require('../node_modules/bitcore/RpcClient').class();
var config         = require('../config/config');
var Transaction    = require('../node_modules/bitcore/Transaction').class();
var rpc            = new RpcClient(config.bitcoind);
var buffertools    = require('buffertools');


program
	.version(GET_TX_VERSION)
	.option('-D --dummy', 'dummy', '0')
	.parse(process.argv);



var tx_hash = process.argv[2] 
  || 'f6c2901f39fd07f2f2e503183d76f73ecc1aee9ac9216fde58e867bc29ce674e';

// PARSING!


rpc.getRawTransaction(tx_hash, 1, function(err, tx) {

  if (err) 
    console.log(err);
  else 
    showTX(tx.result);
    parseTX(tx.result.hex);
});


var showTX = function(txInfo) {
  console.log("## Bitcoind Info");
  console.log(require('util').inspect(txInfo, true, 10)); // 10 levels deep
  console.log("########################################################################");
}


var parseTX = function(data) {
  var b = new Buffer(data,'hex');

  var tx = new Transaction();
  tx.parse(b);


console.log(tx);


  console.log("## INPUTS");
  tx.inputs().forEach( function(i) {
    console.log("\t", typeof i);
    console.log("\t", buffertools.toHex(i));
  });


}

