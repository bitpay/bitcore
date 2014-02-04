'use strict';

require('classtool');


function spec() {

  var TIMESTAMP_ROOT   = 'b-ts-';
  var PREV_ROOT = 'b-prev-';      // b-prev-<hash> => <prev_hash> (0 if orphan)


  /**
  * Module dependencies.
  */
  var RpcClient   = require('bitcore/RpcClient').class(),
      util        = require('bitcore/util/util'),
      levelup     = require('levelup'),
      BitcoreBlock= require('bitcore/Block').class(),
      config      = require('../config/config'),
      fs          = require('fs');

  var BlockDb = function() {
    this.db = levelup(config.leveldb + '/blocks');
  };

  BlockDb.prototype.drop = function(cb) {
    var self = this;
    var path = config.leveldb + '/blocks';
    require('leveldown').destroy(path, function () {
      fs.mkdirSync(config.leveldb);
      fs.mkdirSync(path);
      self.db = levelup(path);
      return cb();
    });
  };

  BlockDb.prototype.add = function(b, cb) {
    var self = this;

    if (!b.hash) return cb(new Error('no Hash at Block.save'));


    var time_key = TIMESTAMP_ROOT +
      ( b.timestamp || Math.round(new Date().getTime() / 1000) );

    self.db.batch()
      .put(time_key, b.hash)
      .put(PREV_ROOT + b.hash, b.prev_block)
      .write(cb);
  };


  BlockDb.prototype.setOrphan = function(hash, cb) {
    var self = this;

    
    var k = PREV_ROOT + hash;
    self.db.get(k, function (err,oldPrevHash) {
      if (err || !oldPrevHash) return cb(err);
     
      self.db.put(PREV_ROOT + hash, 0, function() {
        return cb(err, oldPrevHash);
      });
    });

    // We keep the block in TIMESTAMP_ROOT
  };

  BlockDb.prototype.countNotOrphan = function(hash, cb) {
    var c = 0;
    this.db.createReadStream({start: PREV_ROOT})
      .on('data', function (data) {
        if (data.value !== 0) c++;
      })
      .on('error', function (err) {
        return cb(err);
      })
      .on('close', function () {
        return cb(null);
      })
      .on('end', function () {
        return cb(null);
      });
  };

  BlockDb.prototype.has = function(hash, cb) {
    var self = this;

    var k = PREV_ROOT + hash;
    self.db.get(k, function (err,val) {
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

  BlockDb.blockIndex = function(height, cb) {
    var rpc  = new RpcClient(config.bitcoind);
    rpc.getBlockHash(height, function(err, bh){
      if (err) return cb(err);

      cb(null, { blockHash: bh.result });
    });
  };



 return BlockDb;
}
module.defineClass(spec);


