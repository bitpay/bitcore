'use strict';

/**
 * Module dependencies.
 */
var mongoose    = require('mongoose'),
    async       = require('async'),
    Transaction = require('./Transaction').class(),
    sockets     = require('../controllers/socket.js'),
    Schema      = mongoose.Schema;

var CONCURRENCY = 15;

var TransactionItemSchema = new Schema({
  txid: String,
  index: Number,
  addr: {
    type: String,
    index: true,
  },
  // OJO: mongoose doesnt accept camelcase for field names
  // <0 is Input >0 is Output
  value_sat: Number,
  ts: Number,
});


// TODO: use bitcore networks module
var genesisTXID = '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';


// Compound index
TransactionItemSchema.index({txid: 1, index: 1, value_sat: 1}, {unique: true, dropDups: true});


TransactionItemSchema.statics.load = function(id, cb) {
  this.findOne({
    _id: id
  }).exec(cb);
};


TransactionItemSchema.statics.fromTxId = function(txid, cb) {
  this.find({
    txid: txid,
  }).exec(function (err,items) {

      // sort by 1) value sign 2) index
      return cb(err,items.sort(function(a,b){
          var sa= a.value_sat < 0 ? -1 : 1;
          var sb= b.value_sat < 0 ? -1 : 1;

          if (sa !== sb) {
            return sa-sb;
          }
          else {
            return a.index - b.index;
          }
      }));
  });
};


TransactionItemSchema.statics.explodeTransactionItems = function(txid, cb) {

  var Self = this;
  var addrs  = [];
  var is_new = true;

  // Is it from genesis block? (testnet==livenet)
  // TODO: parse it from networks.genesisTX
  if (txid === genesisTXID) return cb();

  Transaction.queryInfo(txid, function(err, info) {
    if (err || !info) return cb(err);

    var index = 0;
    info.vin.forEach( function(i){
      i.n = index++;
    });

    async.forEachLimit(info.vin, CONCURRENCY, function(i, next_in) {
      if (i.addr && i.value) {

        Self.create({
            txid  : txid,
            value_sat : -1 * i.valueSat,
            addr  : i.addr,
            index : i.n,
            ts : info.time,
        }, next_in);
        if (addrs.indexOf(i.addr) === -1) {
          addrs.push(i.addr);
        }
      }
      else {
        if ( !i.coinbase ) {
            console.log ('WARN in TX: %s: could not parse INPUT %d', txid, i.n);
        }
        return next_in();
      }
    },
    function (err) {

      if (err) {
        if (err.message.match(/E11000/)) {
          is_new = false;
        }
        else {
          console.log('ERR at TX %s: %s', txid,  err);
          return cb(err);
        }
      }

      // Parse Outputs
      async.forEachLimit(info.vout, CONCURRENCY, function(o, next_out) {

        /*
        * TODO Support multisigs
        */
        if (o.value && o.scriptPubKey && o.scriptPubKey.addresses && o.scriptPubKey.addresses[0]) {
          Self.create({
              txid  : txid,
              value_sat : o.valueSat,
              addr  : o.scriptPubKey.addresses[0], // TODO: only address 0?
              index : o.n,
              ts : info.time,
          }, next_out);
          if (addrs.indexOf(o.scriptPubKey.addresses[0]) === -1) {
            addrs.push(o.scriptPubKey.addresses[0]);
          }
        }
        else {
          console.log ('WARN in TX: %s could not parse OUTPUT %d', txid, o.n);
          return next_out();
        }
      },
      function (err) {
        if (err) {
          if (err.message.match(/E11000/)) {
            is_new = false;
          } 
          else {
            console.log('ERR at TX %s: %s', txid,  err);
            return cb(err);
          }
        }
        return cb(null, addrs, is_new);
      });
    });
  });
};




TransactionItemSchema.statics.createFromArray = function(txs, next) {

  var Self = this;
  if (!txs) return next();

  var inserted_txs = [];

  async.forEachLimit(txs, CONCURRENCY, function(txid, cb, was_new) {

    Self.explodeTransactionItems( txid, function(err, addrs) {
      if (err) return next(err);
      if (addrs) {
        async.each(addrs, function(addr){
          sockets.broadcast_address_tx(addr, {'txid': txid});
        });
      }
      if (was_new) {
        inserted_txs.push(txid);
      }

      return cb();
    });
  },
  function(err) {
    return next(err, inserted_txs);
  });
};


module.exports = mongoose.model('TransactionItem', TransactionItemSchema);
