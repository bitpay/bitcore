'use strict';

require('classtool');


function spec(b) {

  var superclass = b.superclass || require('events').EventEmitter;
  var TIMESTAMP_PREFIX  = 'bts-';     // b-ts-<ts> => <hash>
  var PREV_PREFIX       = 'bpr-';     // b-prev-<hash> => <prev_hash> 
  var NEXT_PREFIX       = 'bne-';     // b-next-<hash> => <next_hash> 
  var MAIN_PREFIX       = 'bma-';     // b-main-<hash> => 1/0
  var TIP               = 'bti-';     // last block on the chain
  var LAST_FILE_INDEX   = 'file-';     // last processed file index

  var MAX_OPEN_FILES    = 500;


  /**
  * Module dependencies.
  */
  var levelup     = require('levelup'),
      config      = require('../config/config');
  var db  = b.db || levelup(config.leveldb + '/blocks',{maxOpenFiles: MAX_OPEN_FILES} );
  var Rpc = b.rpc || require('./Rpc').class();

  var BlockDb = function() {
    BlockDb.super(this, arguments);
  };
  BlockDb.superclass = superclass;

  BlockDb.prototype.close = function(cb) {
    db.close(cb);
  };

  BlockDb.prototype.drop = function(cb) {
    var path = config.leveldb + '/blocks';
    db.close(function() {
      require('leveldown').destroy(path, function () {
        db = levelup(path,{maxOpenFiles: MAX_OPEN_FILES} );
        return cb();
      });
    });
  };

  // adds a block. Does not update Next pointer in 
  // the block prev to the new block, nor TIP pointer
  //
  BlockDb.prototype.add = function(b, cb) {
    var self = this;
    var time_key = TIMESTAMP_PREFIX +
      ( b.time || Math.round(new Date().getTime() / 1000) );

    return db.batch()
      .put(time_key, b.hash)
      .put(MAIN_PREFIX + b.hash, 1)
      .put(PREV_PREFIX + b.hash, b.previousblockhash)
      .write(function(err){
        if (!err) {
          self.emit('new_block', {blockid: b.hash});
        }
        cb(err);
      });
  };

  BlockDb.prototype.getTip = function(cb) {
    db.get(TIP, function(err, val) {
      return cb(err,val);
    });
  };

  BlockDb.prototype.setTip = function(hash, cb) {
    db.put(TIP, hash, function(err) {
      return cb(err);
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


  BlockDb.prototype.setLastFileIndex = function(idx, cb) {
    var self = this;
    if (this.lastFileIndexSaved === idx) return cb();

    db.put(LAST_FILE_INDEX, idx, function(err) {
      self.lastFileIndexSaved = idx;
      return cb(err);
    });
  };

  BlockDb.prototype.getLastFileIndex = function(cb) {
    db.get(LAST_FILE_INDEX, function(err,val) {
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
    db.get(k, function (err) {
      var ret = true;
      if (err && err.notFound) {
        err = null;
        ret = false;
      }
      return cb(err, ret);
    });
  };


  BlockDb.prototype.fromHashWithInfo = function(hash, cb) {
    var self = this;

    Rpc.getBlock(hash, function(err, info) {
      if (err || !info) return cb(err);

      self.isMain(hash, function(err, val) {
        if (err) return cb(err);

        info.result.isMainChain = val ? true : false;

        return cb(null, {
          hash: hash,
          info: info.result,
        });
      });
    });
  };

  BlockDb.prototype.getBlocksByDate = function(start_ts, end_ts, cb) {
    var list = [];
    db.createReadStream({
      start: TIMESTAMP_PREFIX + start_ts,
      end: TIMESTAMP_PREFIX + end_ts,
      fillCache: true
      })
      .on('data', function (data) {
        var k = data.key.split('-');
        list.push({
          ts: k[1],
          hash: data.value,
        });
      })
      .on('error', function (err) {
        return cb(err);
      })
      .on('end', function () {
        return cb(null, list.reverse());
      });
  };

  BlockDb.prototype.blockIndex = function(height, cb) {
    return Rpc.blockIndex(height,cb);
  };

  return BlockDb;
}
module.defineClass(spec);


