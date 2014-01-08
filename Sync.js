require('classtool');

function spec(b) {
  var mongoose  = require('mongoose');
  var util      = require('util');

  var RpcClient = require('bitcore/RpcClient').class();
  var networks  = require('bitcore/networks');
  var async     = require('async');

  var config    = require('./config/config');
  var Block     = require('./app/models/Block');
  var Transaction=require('./app/models/Transaction');

  function Sync(config) {
    this.network = config.networkName == 'testnet' ? networks.testnet : networks.livenet;
  }

  Sync.prototype.getNextBlock = function (blockHash,cb) {
    var that = this;

    if ( !blockHash ) {
      return cb();
    }

    this.rpc.getBlock(blockHash, function(err, blockInfo) {
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

        if (inBlock) {
          inBlock.explodeTransactions(function (err) {
            return that.getNextBlock(blockInfo.result.nextblockhash, cb);
          });
        }
        else  
          return that.getNextBlock(blockInfo.result.nextblockhash, cb);
      });
    });
  }

  Sync.prototype.syncBlocks = function (reindex, cb)  {

    var that        = this;
    var genesisHash = this.network.genesisBlock.hash.reverse().toString('hex');

    if (reindex) 
      return this.getNextBlock(genesisHash, cb);


    Block.findOne({}, {}, { sort: { 'confirmations' : 1 } }, function(err, block) {
      if (err) return cb(err);

      var nextHash = 
        block && block.hash 
        ? block.hash
        : genesisHash
        ;

      
      console.log('Starting at hash: ' + nextHash);
      return that.getNextBlock(nextHash, cb);
    });
  }


  Sync.prototype.start = function (opts, next)  {


    mongoose.connect(config.db);
    var db    = mongoose.connection;
    this.rpc   = new RpcClient(config.bitcoind);
    var that  = this;


    db.on('error', console.error.bind(console, 'connection error:'));

    db.once('open', function (){

      async.series([ 
        function(cb){
          if (opts.destroy) {
            console.log("Deleting Blocks...");
            return Block.remove().exec(cb);
          }
          return cb();
        },
        function(cb){
          if (opts.destroy) {
            console.log("Deleting TXs...");
            return Transaction.remove().exec(cb);
          }
          return cb();
        },
        function(cb) {
          that.syncBlocks(opts.reindex, function(err) {
            if (err) {
              return cb(err);

            }
            db.close();
            return cb();
          });
        }
      ],
      function(err) {
        if (err) return next(er);
        return next();
      });
    });
  }
  return Sync;
};
module.defineClass(spec);
 
