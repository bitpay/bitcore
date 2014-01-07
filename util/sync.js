#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

require('buffertools').extend();

var SYNC_VERSION     = '0.1';
var program          = require('commander');
var util             = require('util');
var RpcClient        = require('../node_modules/bitcore/RpcClient').class();
var networks         = require('../node_modules/bitcore/networks');

var Block            = require('../app/models/Block');
var config           = require('../config/config');
var mongoose         = require('mongoose');

program
	.version(SYNC_VERSION)
	.option('-N --network [livenet]', 'Set bitcoin network [livenet]', 'livenet')
	.option('-R --reindex', 'Force reindexing', '0')
	.parse(process.argv);

var networkName      = program.network;
var network          = networkName == 'testnet' ? networks.testnet : networks.livenet;



mongoose.connect(config.db);
var db    = mongoose.connection;
var rpc   = new RpcClient(config.bitcoind);


db.on('error', console.error.bind(console, 'connection error:'));

db.once('open', function callback () {

  syncBlocks(network, program.reindex, function(err) {
    if (err) {
      console.log(err);
    }
    mongoose.connection.close();
  });
});




function getNextBlock(blockHash,cb) {

  if ( !blockHash ) {
    console.log("done");
    return cb();
  }

  rpc.getBlock(blockHash, function(err, blockInfo) {
    if (err) {
      return cb(err); 
    }

    if ( ! ( blockInfo.result.height % 1000) ) {
      var h = blockInfo.result.height,
          d = blockInfo.result.confirmations;
      console.log( util.format("Height: %d/%d [%d%%]", h, d, 100*h/(h+d)));
    }

    Block.create( blockInfo.result, function(err, inBlock) {

      // E11000 => already exists
      if (err && ! err.toString().match(/E11000/)) {
        return cb(err);
      }

      return getNextBlock(blockInfo.result.nextblockhash, cb);

    });
  });

}

function syncBlocks(network, reindex, cb) {

  var genesisHash =  network.genesisBlock.hash.reverse().toString('hex');

  if (reindex) 
    return getNextBlock(genesisHash, cb);


  Block.findOne({}, {}, { sort: { 'confirmations' : 1 } }, function(err, block) {
    if (err) return cb(err);

    var nextHash = 
      block && block.hash 
      ? block.hash
      : genesisHash
      ;

    
    console.log('Starting at hash: ' + nextHash);
    return getNextBlock(nextHash, cb);
  });
}

