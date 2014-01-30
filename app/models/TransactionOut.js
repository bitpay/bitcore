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

  spendTxIdBuf: Buffer,
  spendIndex: Number,
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



TransactionOutSchema.statics.storeTransactionOuts = function(txInfo, cb) {

  var Self = this;
  var addrs  = [];
  var is_new = true;


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

            // This is only to broadcast
            if (addrs.indexOf(o.scriptPubKey.addresses[0]) === -1) {
              addrs.push(o.scriptPubKey.addresses[0]);
            }

            var data = {
                txidBuf: bTxId,
                index : o.n,

                value_sat : o.value * util.COIN,
                addr  : o.scriptPubKey.addresses[0],
            };
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
TransactionOutSchema.statics.createFromTxs = function(txs, next) {

  var Self = this;
  if (!txs) return next();

  var inserted_txs = [];
  var updated_addrs = {};

  async.forEachLimit(txs, CONCURRENCY, function(txid, cb, was_new) {

    var txInfo;
    async.series([
      function(a_cb) {
        // Is it from genesis block? (testnet==livenet)
        // TODO: parse it from networks.genesisTX?
        if (txid === genesisTXID) return a_cb();
        TransactionRpc.getRpcInfo(txid, function(err, inInfo) {
          txInfo =inInfo;
          return a_cb(err);
        });
      },
      function(a_cb) {
        Self.storeTransactionOuts(txInfo, function(err, addrs) {
          if (err) return a_cb(err);

          if (was_new) {
            inserted_txs.push(txid);
            addrs.each(function(a) {
              if ( !updated_addrs[a]) updated_addrs[a] = [];
              updated_addrs[a].push(txid);
            });
          }
          return a_cb();
        });
      }],
      function(err) {
        return cb(err);
      });
    },
    function(err) {
      return next(err, inserted_txs, updated_addrs);
    });
};


module.exports = mongoose.model('TransactionOut', TransactionOutSchema);
