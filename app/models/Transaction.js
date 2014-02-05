'use strict';

require('classtool');


function spec() {
  
  var util            = require('bitcore/util/util'),
      TransactionRpc  = require('../../lib/TransactionRpc').class(),
      TransactionDb   = require('../../lib/TransactionDb').class(),
      async           = require('async');

  var CONCURRENCY = 20;

  function Transaction(tdb) {
    this.txid = null;
    this.tdb = tdb || new TransactionDb();
  }

  Transaction.fromIdWithInfo = function (txid, tdb, cb) {
    if (typeof tdb === 'function') {
      cb = tdb;
      tdb = null;
    }
    var tx = new Transaction(tdb);


console.log('[Transaction.js.27]',tx.tdb); //TODO
    tx.txid = txid;

    tx._fillInfo(function(err) {
      if (err) return cb(err);
      if (! tx.info ) return cb();

      return cb(err,tx);
    });
  };

  Transaction.prototype._fillInfo = function(next) {
    var self  = this;

    TransactionRpc.getRpcInfo(self.txid, function(err, info) {
      if (err) return next(err);
      self._fillOutpoints(info, function() {
        self.info = info;
        return next();
      });
    });
  };

  Transaction.prototype._fillOutpoints = function(info, cb) {
    var self  = this;

    if (!info || info.isCoinBase) return cb();

    var valueIn = 0;
    var incompleteInputs = 0;
    async.eachLimit(info.vin, CONCURRENCY, function(i, c_in) {
      self.tdb.fromTxIdN(i.txid, i.vout, function(err, addr, valueSat) {


        if (err || !addr || !valueSat ) {
          console.log('Could not get TXouts in %s,%d from %s ', i.txid, i.vout, info.txid);
          incompleteInputs = 1;
          return c_in(); // error not scaled
        }
        i.addr     = addr;
        i.valueSat = valueSat;
        i.value    = valueSat / util.COIN;

        valueIn += i.valueSat;
        return c_in();
      });
    },
    function () {
      if (! incompleteInputs ) {
        info.valueIn = valueIn / util.COIN;
        info.fees    = (valueIn - parseInt(info.valueOut * util.COIN))  / util.COIN ;
      }
      else {
        info.incompleteInputs = 1;
      }
      return cb();
    });
  };

  return Transaction;
}
module.defineClass(spec);


