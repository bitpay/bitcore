'use strict';

/**
 * Module dependencies.
 */
var mongoose    = require('mongoose'),
    async       = require('async'),
    util        = require('bitcore/util/util'),
    TransactionRpc = require('../../lib/TransactionRpc').class(),
    Schema      = mongoose.Schema;

var CONCURRENCY = 15;
// TODO: use bitcore networks module
var genesisTXID = '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';

var TransactionOutSchema = new Schema({
  txidBuf: {
    type: Buffer,
    index: true,
  },
  index: Number,
  addr: {
    type: String,
    index: true,
  },
  value_sat: Number,
  fromOrphan: Boolean,

  spendTxIdBuf: Buffer,
  spendIndex: Number,
  spendFromOrphan: Boolean,
});


// Compound index

TransactionOutSchema.index({txidBuf: 1, index: 1}, {unique: true, sparse: true});
TransactionOutSchema.index({spendTxIdBuf: 1, spendIndex: 1}, {unique: true, sparse: true});

TransactionOutSchema.virtual('txid').get(function () {
  return this.txidBuf.toString('hex');
});


TransactionOutSchema.virtual('spendTxid').get(function () {
  if (!this.spendTxIdBuf) return (null);
  return this.spendTxIdBuf.toString('hex');
});


TransactionOutSchema.virtual('txid').set(function (txidStr) {
  if (txidStr)
    this.txidBuf = new Buffer(txidStr,'hex');
  else
    this.txidBuf = null;
});

TransactionOutSchema.statics.fromTxId = function(txid, cb) {
  var txidBuf = new Buffer(txid, 'hex');

  this.find({
    txidBuf: txidBuf,
  }).exec(function (err,items) {

      // sort by index
      return cb(err,items.sort(function(a,b){
          return a.index - b.index;
      }));
  });
};

TransactionOutSchema.statics.fromTxIdOne = function(txid, cb) {
  var txidBuf = new Buffer(txid, 'hex');

  this.find({
    txidBuf: txidBuf,
  }).exec(function (err,item) {
    return cb(err, item[0]);
  });
};


TransactionOutSchema.statics.fromTxIdN = function(txid, n, cb) {
  var txidBuf = new Buffer(txid, 'hex');
  this.findOne({
    txidBuf: txidBuf, index: n
  }).exec(cb);
};

TransactionOutSchema.statics.removeFromTxId = function(txid, cb) {
  var txidBuf = new Buffer(txid, 'hex');
  this.remove({ txidBuf: txidBuf }).exec(cb);
};



TransactionOutSchema.statics.storeTransactionOuts = function(txInfo, fromOrphan, cb) {

  var Self = this;
  var addrs  = [];
  var is_new = true;

  if (txInfo.hash) {

    // adapt bitcore TX object to bitcoind JSON response
    txInfo.txid = txInfo.hash;

    var count = 0;
    txInfo.vin = txInfo.in.map(function (txin) {
      var i = {};
     
      if (txin.coinbase) {
        txInfo.isCoinBase = true;
      }
      else {
        i.txid= txin.prev_out.hash;
        i.vout= txin.prev_out.n;
      };
      i.n = count++;
      return i;
    });


    count = 0;
    txInfo.vout = txInfo.out.map(function (txout) {
      var o = {};
     
      o.value = txout.value;
      o.n = count++;

      if (txout.addrStr){
        o.scriptPubKey = {};
        o.scriptPubKey.addresses = [txout.addrStr];
      }
      return o;
    });

  }

  var bTxId = new Buffer(txInfo.txid,'hex');


  async.series([
    // Input Outpoints (mark them as spended)
    function(p_c) {
      if (txInfo.isCoinBase) return p_c();
      async.forEachLimit(txInfo.vin, CONCURRENCY,
        function(i, next_out) {
          var b = new Buffer(i.txid,'hex');
          var data = {
              txidBuf: b,
              index: i.vout,

              spendTxIdBuf: bTxId,
              spendIndex: i.n,
          };
          if (fromOrphan) data.spendFromOrphan = true;
          Self.update({txidBuf: b, index: i.vout}, data, {upsert: true}, next_out);
        },
        function (err) {
          if (err) {
            if (!err.message.match(/E11000/)) {
              console.log('ERR at TX %s: %s', txInfo.txid,  err);
              return cb(err);
            }
          }
          return p_c();
      });
    },
    // Parse Outputs
    function(p_c) {
      async.forEachLimit(txInfo.vout, CONCURRENCY,
        function(o, next_out) {
          if (o.value && o.scriptPubKey &&
            o.scriptPubKey.addresses &&
            o.scriptPubKey.addresses[0] &&
            ! o.scriptPubKey.addresses[1] // TODO : not supported
          ){

            // This is only to broadcast (WIP)
//            if (addrs.indexOf(o.scriptPubKey.addresses[0]) === -1) {
//              addrs.push(o.scriptPubKey.addresses[0]);
//            }

            var data = {
                txidBuf: bTxId,
                index : o.n,

                value_sat : o.value * util.COIN,
                addr  : o.scriptPubKey.addresses[0],
            };
            if (fromOrphan) data.fromOrphan = true;
            Self.update({txidBuf: bTxId, index: o.n}, data, {upsert: true}, next_out);
          }
          else {
            console.log ('WARN in TX: %s could not parse OUTPUT %d', txInfo.txid, o.n);
            return next_out();
          }
        },
        function (err) {
          if (err) {
            if (err.message.match(/E11000/)) {
              is_new = false;
            }
            else {
              console.log('ERR at TX %s: %s', txInfo.txid,  err);
              return cb(err);
            }
          }
          return p_c();
      });
    }], function(err) {
      return cb(err, addrs, is_new);
  });
};


// txs can be a [hashes] or [txObjects]
TransactionOutSchema.statics.createFromTxs = function(txs, fromOrphan, next) {
  var Self = this;

  if (typeof fromOrphan === 'function') {
    next = fromOrphan;
    fromOrphan = false;
  }

  if (!txs) return next();

  var inserted_txs = [];
  var updated_addrs = {};

  async.forEachLimit(txs, CONCURRENCY, function(t, each_cb) {

    var txInfo;

    async.series([
      function(a_cb) {
        if (typeof t !== 'string') {
          txInfo = t;
          return a_cb();
        }

        // Is it from genesis block? (testnet==livenet)
        // TODO: parse it from networks.genesisTX?
        if (t === genesisTXID) return a_cb();

        TransactionRpc.getRpcInfo(t, function(err, inInfo) {
          txInfo =inInfo;
          return a_cb(err);
        });
      },
      function(a_cb) {
        if (!txInfo) return a_cb();

        Self.storeTransactionOuts(txInfo, fromOrphan, function(err, addrs) {
          if (err) return a_cb(err);
          return a_cb();
        });
      }],
      function(err) {
        return each_cb(err);
    });
  },
  function(err) {
    return next(err, inserted_txs, updated_addrs);
  });
};


module.exports = mongoose.model('TransactionOut', TransactionOutSchema);
