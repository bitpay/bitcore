'use strict';

/**
 * Module dependencies.
 */
    
var mongoose    = require('mongoose'),
    Schema      = mongoose.Schema,
    async       = require('async'),
    RpcClient   = require('bitcore/RpcClient').class(),
    Transaction = require('bitcore/Transaction').class(),
    Address     = require('bitcore/Address').class(),
    networks    = require('bitcore/networks'),
    util        = require('bitcore/util/util'),
    bignum      = require('bignum'),
    config      = require('../../config/config'),
    TransactionItem = require('./TransactionItem');


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
  processed: {
    type: Boolean,
    default: false,
    index: true,
  },
  orphaned: {
    type: Boolean,
    default: false,
  },
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

  // TODO Should we go to mongoDB first? Now, no extra information is stored at mongo.
  this.fromId(txid, function(err, tx) {
    if (err) return cb(err);

    if (!tx) { return cb(new Error('TX not found')); }

    tx.queryInfo(function(err) { return cb(err,tx); } );
  });
};



TransactionSchema.statics.createFromArray = function(txs, next) {
  var that = this;
  if (!txs) return next();

  async.forEach( txs,
    function(tx, callback) {
      that.create({ txid: tx }, function(err) {
        if (err && ! err.toString().match(/E11000/)) {
          return callback(err);
        }
        return callback();
      });
    },
    function(err) {
      return next(err);
    }
  );
};


TransactionSchema.statics.explodeTransactionItems = function(txid,  cb) {

  this.fromIdWithInfo(txid, function(err, t) {
    if (err || !t) return cb(err);

    var index=0;
    async.each(t.info.vin, function(i, next_in) {

      /*
       * TODO Support multisigs???
       */

      if (i.addr && i.value) {
        TransactionItem.create({
            txid  : t.txid,
            value : -1 * i.value,
            addr  : i.addr,
            index : index++,
        }, next_in);
      }
      else {
        if ( !i.coinbase )
            console.log ("TX: %s seems to be multisig IN. Skipping... ", t.txid);
        return next_in(); 
      }
    },
    function (err) {
      if (err) console.log (err);
      async.each(t.info.vout, function(o, next_out) {

        /*
         * TODO Support multisigs
         */
        if (o.value &&  o.scriptPubKey 
            && o.scriptPubKey.addresses 
            && o.scriptPubKey.addresses[0]
            ) {
          TransactionItem.create({
              txid  : t.txid,
              value : o.value,
              addr  : o.scriptPubKey.addresses[0],
              index : o.n,
          }, next_out);
        }
        else {
          console.log ("TX: %s,%d seems to be multisig OUT. Skipping... ", t.txid, o.n);
          return next_out(); 
        }
      },
      function (err) {
        return cb(err);
      });
    });
  });
};



TransactionSchema.methods.fillInputValues = function (tx, next) {

  if (tx.isCoinBase()) return next();

  if (! this.rpc) this.rpc = new RpcClient(config.bitcoind);

  var that = this;
  async.each(tx.ins, function(i, cb) {

      var outHash       = i.getOutpointHash();
      var outIndex      = i.getOutpointIndex();
      var outHashBase64 = outHash.reverse().toString('hex');

      var c=0;
      that.rpc.getRawTransaction(outHashBase64, function(err, txdata) {
        var txin = new Transaction();

        if (err || ! txdata.result) return cb( new Error('Input TX '+outHashBase64+' not found'));

        var b = new Buffer(txdata.result,'hex');
        txin.parse(b);


        if ( txin.isCoinBase() ) {
          return cb();
        }

        txin.outs.forEach( function(j) {
          // console.log( c + ': ' + util.formatValue(j.v) );
          if (c === outIndex) {
            i.value = j.v;
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

TransactionSchema.methods.queryInfo = function (next) {

  var that      = this;
  var network   = ( config.network === 'testnet') ? networks.testnet : networks.livenet ;
  this.rpc      = new RpcClient(config.bitcoind);


  this.rpc.getRawTransaction(this.txid, 1, function(err, txInfo) {
    if (err) return next(err);

    that.info = txInfo.result;

    // Transaction parsing
    var b  = new Buffer(txInfo.result.hex,'hex');
    var tx = new Transaction();
    tx.parse(b);

    that.fillInputValues(tx, function(err) {

      // Copy TX relevant values to .info

      var c = 0;


      var valueIn  = bignum(0);
      var valueOut = bignum(0);

      if ( tx.isCoinBase() ) {
        that.info.isCoinBase = true;
      }
      else {
        tx.ins.forEach(function(i) {
  
          if (i.value) {
            that.info.vin[c].value = util.formatValue(i.value);
            var n = util.valueToBigInt(i.value).toNumber();
            valueIn           = valueIn.add( n );

            var scriptSig     = i.getScript();
            var pubKey        = scriptSig.simpleInPubKey();

            // We check for pubKey in case a broken / strange TX.
            if (pubKey) {
              var pubKeyHash    = util.sha256ripe160(pubKey);
              var addr          = new Address(network.addressPubkey, pubKeyHash);
              var addrStr       = addr.toString();
              that.info.vin[c].addr  = addrStr;
            }
          }
          else {
            console.log("TX could not be parsed: %s,%d",txInfo.result.txid, c); 
          }
          c++;
        });
      }

      tx.outs.forEach( function(i) {
        var n =  util.valueToBigInt(i.v).toNumber();
        valueOut = valueOut.add(n);
      });

      that.info.valueOut = valueOut / util.COIN;

      if ( !tx.isCoinBase() ) {
        that.info.valueIn  = valueIn / util.COIN;
        that.info.feeds    = (valueIn - valueOut) / util.COIN;
      }

      that.info.size     = b.length;

      return next(err, that.info);
    });
  });
};




module.exports = mongoose.model('Transaction', TransactionSchema);
