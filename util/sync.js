#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('buffertools').extend();

var RpcClient        = require('../node_modules/bitcore/RpcClient').class();
var networks         = require('../node_modules/bitcore/networks');

var Block            = require('../app/models/Block');
var config           = require('../config/config');
var mongoose         = require('mongoose');

var networkName      = process.argv[2] || 'testnet';
var network          = networkName == 'testnet' ? networks.testnet : networks.livenet;


function getNextBlock(blockHash,cb) {

  if ( !blockHash ) {
    console.log("done");
    return cb();
  }

  rpc.getBlock(blockHash, function(err, blockInfo) {
    if (err) {
      return cb(err); 
    }

    if ( ! ( blockInfo.result.height % 1000) ) 
      console.log("Height:" + blockInfo.result.height);

    Block.create( blockInfo.result, function(err, inBlock) {

      // E11000 => already exists
      if (err && ! err.toString().match(/E11000/)) {
        return cb(err);
      }

      return getNextBlock(blockInfo.result.nextblockhash);

    });
  });

}

function syncBlocks(network, cb) {

  Block.findOne({}, {}, { sort: { 'height' : -1 } }, function(err, block) {
    if (err) {
      return cb(err);
    }



    var nextHash = 
      block && block.hash 
      ? block.hash
      : network.genesisBlock.hash.reverse().toString('hex')
      ;

    
    console.log('Starting at hash' + nextHash);
    getNextBlock(nextHash, cb);
  });
}


mongoose.connect(config.db);

var db    = mongoose.connection;
var rpc   = new RpcClient(config.bitcoind);


db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
  syncBlocks(network, function(err) {
    if (err) {
      console.log(err);
    }
    mongoose.connection.close();
  });
});



