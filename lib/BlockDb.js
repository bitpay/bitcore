'use strict';

require('classtool');


function spec() {

  var TIMESTAMP_ROOT   = 'b-ts-';
  var ORPHAN_FLAG_ROOT = 'b-orphan-';


  /**
  * Module dependencies.
  */
  var RpcClient   = require('bitcore/RpcClient').class(),
      util        = require('bitcore/util/util'),
      levelup     = require('levelup'),
      BitcoreBlock= require('bitcore/Block').class(),
      TransactionDb = require('.//TransactionDb'),
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
      .put(ORPHAN_FLAG_ROOT + b.hash, b.isOrphan || 0)
      .write(cb);
  };

  BlockDb.prototype.countNotOrphan = function(hash, cb) {
    var c = 0;
    this.db.createReadStream({start: ORPHAN_FLAG_ROOT})
      .on('data', function (data) {
        if (data === false) c++;
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

    var k = ORPHAN_FLAG_ROOT + hash;
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


