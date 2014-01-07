#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('buffertools').extend();

var RpcClient        = require('../node_modules/bitcore/RpcClient').class();
var networks         = require('../node_modules/bitcore/networks');

var Block            = require('../app/models/Block');
var config           = require('../config/config');
var mongoose         = require('mongoose');

var networkName      = process.argv[2] || 'testnet';
var genesisBlockHash = networks.testnet.genesisBlock.hash.reverse().toString('hex');


function syncBlocks(blockHash) {

  rpc.getBlock(blockHash, function(err, blockInfo) {
    if (err) {
      console.log(err);
      throw(err); 
    }

    if ( ! ( blockInfo.result.height % 1000) ) 
      console.log("Height:" + blockInfo.result.height);

    Block.create( blockInfo.result, function(err, inBlock) {

      if (err && err.toString().match(/E11000/)) {
//        console.log("\twas there. Skipping");
        return syncBlocks(blockInfo.result.nextblockhash);
      }

      if (err) throw(err);

      if (inBlock.nextblockhash && ! inBlock.nextblockhash.match(/^0+$/)  ) {
        syncBlocks(inBlock.nextblockhash)
      }
      else {
        mongoose.connection.close();
      }

    });
  });

}


mongoose.connect(config.db);

var db    = mongoose.connection;
var rpc   = new RpcClient(config.bitcoind);


db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {

  syncBlocks(genesisBlockHash);

});



