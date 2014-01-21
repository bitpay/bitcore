'use strict';

/**
 * Module dependencies.
 */
    
var mongoose        = require('mongoose'),
    Schema          = mongoose.Schema,
    async           = require('async'),
    RpcClient       = require('bitcore/RpcClient').class(),
    Transaction     = require('bitcore/Transaction').class(),
    Address         = require('bitcore/Address').class(),
    BitcoreBlock    = require('bitcore/Block').class(),
    networks        = require('bitcore/networks'),
    util            = require('bitcore/util/util'),
    bignum          = require('bignum'),
    config          = require('../../config/config'),
    sockets         = require('../controllers/socket.js'),
    TransactionItem = require('./TransactionItem');

var CONCURRENCY = 5;

// TODO: use bitcore networks module
var genesisTXID = '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';

/**
 */
var TransactionSchema = new Schema({
  // For now we keep this as short as possible
  // More fields will be propably added as we move
  // forward with the UX
  txid: {
    type: String,
    index: true,
    unique: true,
  },
/* TODO?
  orphaned: {
    type: Boolean,
    default: false,
  },
 */
  time: Number,
});

/**
 * Statics
 */

TransactionSchema.statics.load = function(id, cb) {
  this.findOne({
    _id: id
  }).exec(cb);
};


TransactionSchema.statics.fromId = function(txid, cb) {
  this.findOne({
    txid: txid,
  }).exec(cb);
};


TransactionSchema.statics.fromIdWithInfo = function(txid, cb) {
  var That = this;

  this.fromId(txid, function(err, tx) {
    if (err) return cb(err);

    if (!tx) {
      // No in mongo...but maybe in bitcoind... lets query it
      tx = new That();

      tx.txid = txid;
      tx.fillInfo(function(err, txInfo) {

        if (err) return cb(err);
        if (!txInfo) return cb();

        tx.save(function(err) {
          return cb(err,tx);
        });
      });
    }
    else {
      tx.fillInfo(function(err) {
        return cb(err,tx);
      });
    }
  });
};


TransactionSchema.statics.createFromArray = function(txs, time, next) {
  var that = this;
  if (!txs) return next();
  var mongo_txs = [];

  async.forEachLimit(txs, CONCURRENCY, function(txid, cb) {

    that.explodeTransactionItems( txid, time, function(err, addrs) {
      if (err) return next(err);
      if (addrs) {
        async.each(addrs, function(addr){
          sockets.broadcast_address_tx(addr, {'txid': txid});
        });

      }

      that.create({txid: txid, time: time}, function(err, new_tx) {
        if (err && ! err.toString().match(/E11000/)) return cb(err);

        if (new_tx) {
          mongo_txs.push(new_tx);
        }

        return cb();
      });
    });
  },
  function(err) {
    return next(err, mongo_txs);
  });
};


TransactionSchema.statics.explodeTransactionItems = function(txid, time,  cb) {
  var addrs = [];

  // Is it from genesis block? (testnet==livenet)
  // TODO: parse it from networks.genesisTX
  if (txid === genesisTXID) return cb();

  this.queryInfo(txid, function(err, info) {
    if (err || !info) return cb(err);

    var index = 0;
    info.vin.forEach( function(i){
      i.n = index++;
    });

    async.forEachLimit(info.vin, CONCURRENCY, function(i, next_in) {
      if (i.addr && i.value) {

        TransactionItem.create({
            txid  : txid,
            value_sat : -1 * i.valueSat,
            addr  : i.addr,
            index : i.n,
            ts : time,
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
      if (err && !err.message.match(/E11000/) ) console.log (err);
      async.forEachLimit(info.vout, CONCURRENCY, function(o, next_out) {

        /*
         * TODO Support multisigs
         */
        if (o.value && o.scriptPubKey && o.scriptPubKey.addresses && o.scriptPubKey.addresses[0]) {
          TransactionItem.create({
              txid  : txid,
              value_sat : o.valueSat,
              addr  : o.scriptPubKey.addresses[0],
              index : o.n,
              ts : time,
          }, next_out);
        }
        else {
          console.log ('WARN in TX: %s could not parse OUTPUT %d', txid, o.n);
          return next_out();
        }
      },
      function (err) {
        if (err && ! err.toString().match(/E11000/)) return cb(err);
        return cb(null, addrs);
      });
    });
  });
};



TransactionSchema.statics.getOutpoints = function (tx, next) {

  if (tx.isCoinBase()) return next();

  var rpc = new RpcClient(config.bitcoind);
  var network   = ( config.network === 'testnet') ? networks.testnet : networks.livenet ;

  async.forEachLimit(tx.ins, CONCURRENCY, function(i, cb) {

      var outHash       = i.getOutpointHash();
      var outIndex      = i.getOutpointIndex();
      var outHashBase64 = outHash.reverse().toString('hex');

      var c=0;
      rpc.getRawTransaction(outHashBase64, function(err, txdata) {
        var txin = new Transaction();
        if (err || ! txdata.result) return cb( new Error('Input TX '+outHashBase64+' not found'));

        var b = new Buffer(txdata.result,'hex');
        txin.parse(b);

        /*
         *We have to parse it anyways. It will have outputs even it is a coinbase tx
          if ( txin.isCoinBase() ) {
           return cb();
          }
       */

        txin.outs.forEach( function(j) {
          // console.log( c + ': ' + util.formatValue(j.v) );
          if (c === outIndex) {
            i.value = j.v;

            // This is used for pay-to-pubkey transaction in which
            // the pubkey is not provided on the input
            var scriptPubKey = j.getScript();
            var hash         = scriptPubKey.simpleOutHash();
            if (hash) {
              var addr          = new Address(network.addressPubkey, hash);
              i.addrFromOutput  = addr.toString();
            }
          }
          c++;
        });
        return cb();
      });
    },
    function(err) {
      return next(err);
    }
  );
};


TransactionSchema.statics.queryInfo = function(txid,  cb) {
  var that = this;
  var network   = ( config.network === 'testnet') ? networks.testnet : networks.livenet ;
  var rpc      = new RpcClient(config.bitcoind);

  rpc.getRawTransaction(txid, 1, function(err, txInfo) {

    // Not found?
    if (err && err.code === -5) return cb();

    if (err) return cb(err);

    var info = txInfo.result;

    // Transaction parsing
    var b  = new Buffer(txInfo.result.hex,'hex');
    var tx = new Transaction();
    tx.parse(b);

    that.getOutpoints(tx, function(err) {
      if (err) return cb(err);

      // Copy TX relevant values to .info

      var c = 0;
      var valueIn  = bignum(0);
      var valueOut = bignum(0);

      if ( tx.isCoinBase() ) {
        info.isCoinBase = true;
      }
      else {
        tx.ins.forEach(function(i) {
          if (i.value) {
            info.vin[c].value = parseFloat(util.formatValue(i.value));
            var n = util.valueToBigInt(i.value).toNumber();
            info.vin[c].valueSat = n;
            valueIn           = valueIn.add( n );

            var scriptSig     = i.getScript();
            var pubKey        = scriptSig.simpleInPubKey();

            // We check for pubKey in case a broken / strange TX.
            if (pubKey) {
              var pubKeyHash    = util.sha256ripe160(pubKey);
              var addr          = new Address(network.addressPubkey, pubKeyHash);
              var addrStr       = addr.toString();
              info.vin[c].addr  = addrStr;
            }
            else {
              if (i.addrFromOutput)
                info.vin[c].addr  = i.addrFromOutput;
            }
          }
          else {
            console.log('TX could not be parsed: %s,%d' ,txInfo.result.txid, c);
          }
          c++;
        });
      }

      c=0;
      tx.outs.forEach( function(i) {
        var n =  util.valueToBigInt(i.v).toNumber();
        valueOut = valueOut.add(n);

        info.vout[c].valueSat = n;
        c++;
      });

      info.valueOut = valueOut / util.COIN;

      if ( !tx.isCoinBase() ) {
        info.valueIn  = valueIn / util.COIN;
        info.feeds    = (valueIn - valueOut) / util.COIN;
      }
      else  {
        var reward =  BitcoreBlock.getBlockValue(info.height) / util.COIN;
        info.vin[0].reward = reward;
        info.valueIn = reward;
      }

      info.size     = b.length;

      return cb(null, info);
    });
  });
};



TransactionSchema.methods.fillInfo = function(next) {
  var that      = this;

  mongoose.model('Transaction', TransactionSchema).queryInfo(that.txid, function(err, info) {
    if (err) return next(err);

    that.info = info;
    that.info.time = that.time;
    return next();
  });
};



module.exports = mongoose.model('Transaction', TransactionSchema);
