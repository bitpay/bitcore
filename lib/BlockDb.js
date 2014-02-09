'use strict';

require('classtool');


function spec(b) {

  var TIMESTAMP_PREFIX  = 'b-ts-'; // b-ts-<ts> => <hash>
  var PREV_PREFIX       = 'b-prev-';     // b-prev-<hash> => <prev_hash> 
  var NEXT_PREFIX       = 'b-next-';     // b-next-<hash> => <next_hash> 
  var MAIN_PREFIX       = 'b-main-';     // b-main-<hash> => 1/0
  var TIP               = 'b-tip-';      // last block on the chain


  /**
  * Module dependencies.
  */
  var RpcClient   = require('bitcore/RpcClient').class(),
      util        = require('bitcore/util/util'),
      levelup     = require('levelup'),
      BitcoreBlock= require('bitcore/Block').class(),
      config      = require('../config/config');
  var db   = b.db || levelup(config.leveldb + '/blocks');
  var rpc  = b.rpc || new RpcClient(config.bitcoind);

  var BlockDb = function() {
  };

  BlockDb.prototype.close = function(cb) {
    db.close(cb);
  };

  BlockDb.prototype.drop = function(cb) {
    var path = config.leveldb + '/blocks';
    db.close(function() {
      require('leveldown').destroy(path, function () {
        db = levelup(path);
        return cb();
      });
    });
  };

  // adds a block TIP block. Does not update Next pointer in 
  // the block prev to the new block.
  //
  BlockDb.prototype.add = function(b, cb) {
    var time_key = TIMESTAMP_PREFIX +
      ( b.time || Math.round(new Date().getTime() / 1000) );

    return db.batch()
      .put(time_key, b.hash)
      .put(TIP, b.hash)
      .put(MAIN_PREFIX + b.hash, 1)
      .put(PREV_PREFIX + b.hash, b.previousblockhash)
      .write(cb);
  };

  BlockDb.prototype.getTip = function(cb) {
    db.get(TIP, function(err, val) {
      return cb(err,val);
    });
  };

  //mainly for testing
  BlockDb.prototype.setPrev = function(hash, prevHash, cb) {
    db.put(PREV_PREFIX + hash, prevHash, function(err) {
      return cb(err);
    });
  };

  BlockDb.prototype.getPrev = function(hash, cb) {
    db.get(PREV_PREFIX + hash, function(err,val) {
      if (err && err.notFound) { err = null; val = null;}
      return cb(err,val);
    });
  };

  BlockDb.prototype.getNext = function(hash, cb) {
    db.get(NEXT_PREFIX + hash, function(err,val) {
      if (err && err.notFound) { err = null; val = null;}
      return cb(err,val);
    });
  };

  BlockDb.prototype.isMain = function(hash, cb) {
    db.get(MAIN_PREFIX + hash, function(err, val) {
      if (err && err.notFound) { err = null; val = 0;}
      return cb(err,parseInt(val));
    });
  };

  BlockDb.prototype.setMain = function(hash, isMain, cb) {
    if (!isMain) console.log('\tNew orphan: %s',hash);
    db.put(MAIN_PREFIX + hash, isMain?1:0, function(err) {
      return cb(err);
    });
  };
  BlockDb.prototype.setNext = function(hash, nextHash, cb) {
    db.put(NEXT_PREFIX + hash, nextHash, function(err) {
      return cb(err);
    });
  };

  BlockDb.prototype.countNotOrphan = function(cb) {
    var c = 0;
    console.log('Counting connected blocks. This could take some minutes');
    db.createReadStream({start: MAIN_PREFIX, end: MAIN_PREFIX + '~' })
      .on('data', function (data) {
        if (data.value !== 0) c++;
      })
      .on('error', function (err) {
        return cb(err);
      })
      .on('end', function () {
        return cb(null, c);
      });
  };

  // .has() return true orphans also
  BlockDb.prototype.has = function(hash, cb) {
    var k = PREV_PREFIX + hash;
    db.get(k, function (err,val) {
      var ret;
      if (err && err.notFound) {
        err = null;
        ret = false;
      }
      if (typeof val !== 'undefined') {
        ret = true;
      }
      return cb(err, ret);
    });
  };


  BlockDb.prototype.fromHashWithInfo = function(hash, cb) {
    rpc.getBlock(hash, function(err, info) {
      // Not found?
      if (err && err.code === -5) return cb();
      if (err) return cb(err);

      if (info.result.height)
        info.result.reward =  BitcoreBlock.getBlockValue(info.result.height) / util.COIN ;
      return cb(null, {
        hash: hash,
        info: info.result,
      });
    });
  };

  BlockDb.prototype.getBlocksByDate = function(start_ts, end_ts, limit, cb) {
    var list = [];
    db.createReadStream({
      start: TIMESTAMP_PREFIX + start_ts,
      end: TIMESTAMP_PREFIX + end_ts,
      fillCache: true,
      limit: parseInt(limit) // force to int
      })
      .on('data', function (data) {
        list.push({
          ts: data.key.replace(TIMESTAMP_PREFIX, ''),
          hash: data.value,
        });
      })
      .on('error', function (err) {
        return cb(err);
      })
      .on('end', function () {
        return cb(null, list);
      });
  };

  BlockDb.prototype.blockIndex = function(height, cb) {
    var rpc  = new RpcClient(config.bitcoind);
    rpc.getBlockHash(height, function(err, bh){
      if (err) return cb(err);

      cb(null, { blockHash: bh.result });
    });
  };

  return BlockDb;
}
module.defineClass(spec);


