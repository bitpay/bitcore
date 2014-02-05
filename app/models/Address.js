'use strict';

require('classtool');


function spec() {
  var async           = require('async');
  var BitcoreAddress  = require('bitcore/Address').class();
  var BitcoreUtil     = require('bitcore/util/util');
  var TransactionDb   = require('../../lib/TransactionDb').class();

  function Address(addrStr, txDb) {
    this.txDb              = txDb || new TransactionDb();
    this.balanceSat        = 0;
    this.totalReceivedSat  = 0;
    this.totalSentSat      = 0;
    this.txApperances   = 0;

    // TODO store only txids? +index? +all?
    this.transactions   = [];

    var a = new BitcoreAddress(addrStr);
    a.validate();
    this.addrStr        = addrStr;


    Object.defineProperty(this, 'totalSent', {
      get: function() {
        return parseFloat(this.totalSentSat) / parseFloat(BitcoreUtil.COIN);
      },
      set:  function(i) {
        this.totalSentSat =  i * BitcoreUtil.COIN;
      },
      enumerable: 1,
    });

    Object.defineProperty(this, 'balance', {
      get: function() {
        return parseFloat(this.balanceSat) / parseFloat(BitcoreUtil.COIN);
      },
      set:  function(i) {
        this.balance =   i * BitcoreUtil.COIN;
      },
      enumerable: 1,
    });

    Object.defineProperty(this, 'totalReceived', {
      get: function() {
        return parseFloat(this.totalReceivedSat) / parseFloat(BitcoreUtil.COIN);
      },
      set:  function(i) {
        this.totalReceived =  i * BitcoreUtil.COIN;
      },
      enumerable: 1,
    });
  }

  Address.prototype.update = function(next) {
    var self = this;
    async.series([
      function (cb) {
        self.txDb.fromAddr(self.addrStr, function(err,txOut){
          if (err) return cb(err);

          txOut.forEach(function(txItem){
            var v =  parseInt(txItem.value_sat);

            self.totalReceivedSat += v;
            self.transactions.push(txItem.txid);
            if (! txItem.spendTxId) {
              // unspent
              self.balanceSat   += v;
              self.txApperances +=1;
            }
            else {
              // spent
              self.totalSentSat += v;
              self.transactions.push(txItem.spendTxId);
              self.txApperances +=2;
            }
          });
          return cb();
        });
      },
    ], function (err) {
      return next(err);
    });
  };

  return Address;
}
module.defineClass(spec);

