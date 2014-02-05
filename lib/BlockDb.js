'use strict';

require('classtool');


function spec(b) {

  var TIMESTAMP_ROOT  = 'b-ts-'; // b-ts-<ts> => <hash>
  var PREV_ROOT       = 'b-prev-';      // b-prev-<hash> => <prev_hash> (0 if orphan)


  /**
  * Module dependencies.
  */
  var RpcClient   = require('bitcore/RpcClient').class(),
      util        = require('bitcore/util/util'),
      levelup     = require('levelup'),
      BitcoreBlock= require('bitcore/Block').class(),
      config      = require('../config/config');
  var db = b.db || levelup(config.leveldb + '/blocks');


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

  BlockDb.prototype.add = function(b, cb) {
    if (!b.hash) return cb(new Error('no Hash at Block.save'));


    var time_key = TIMESTAMP_ROOT +
      ( b.time || Math.round(new Date().getTime() / 1000) );

    db.batch()
      .put(time_key, b.hash)
      .put(PREV_ROOT + b.hash, b.previousblockhash)
      .write(cb);
  };



  BlockDb.prototype.setOrphan = function(hash, cb) {
    var k = PREV_ROOT + hash;

    db.get(k, function (err,oldPrevHash) {
      if (err || !oldPrevHash) return cb(err);
      db.put(PREV_ROOT + hash, 0, function() {
        return cb(err, oldPrevHash);
      });
    });
    // We keep the block in TIMESTAMP_ROOT
  };

  //mainly for testing
  BlockDb.prototype.setPrev = function(hash, prevHash, cb) {
    db.put(PREV_ROOT + hash, prevHash, function(err) {
      return cb(err);
    });
  };

  //mainly for testing
  BlockDb.prototype.getPrev = function(hash, cb) {
    db.get(PREV_ROOT + hash, function(err,val) {
      return cb(err,val);
    });
  };



  BlockDb.prototype.countNotOrphan = function(cb) {
    var c = 0;
    console.log('Counting connected blocks. This could take some minutes');
    db.createReadStream({start: PREV_ROOT, end: PREV_ROOT + '~' })
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

  BlockDb.prototype.has = function(hash, cb) {
    var k = PREV_ROOT + hash;
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
    var rpc  = new RpcClient(config.bitcoind);

    rpc.getBlock(hash, function(err, info) {
      // Not found?
      if (err && err.code === -5) return cb();
      if (err) return cb(err);

      info.reward =  BitcoreBlock.getBlockValue(info.height) / util.COIN ;

      return cb(null, {
        hash: hash,
        info: info.result,
      });
    });
  };

  BlockDb.prototype.getBlocksByDate = function(start_ts, end_ts, limit, cb) {
    var list = [];
    db.createReadStream({
      start: TIMESTAMP_ROOT + start_ts,
      end: TIMESTAMP_ROOT + end_ts,
      fillCache: true,
      limit: parseInt(limit) // force to int
      })
      .on('data', function (data) {
console.log('[BlockDb.js.137:data:]',data); //TODO
        list.push({
          ts: data.key.replace(TIMESTAMP_ROOT, ''),
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


