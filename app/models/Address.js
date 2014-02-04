'use strict';

require('classtool');


function spec() {
  var async           = require('async');
  var TransactionOut = require('./TransactionOut');
  var BitcoreAddress  = require('bitcore/Address').class();
  var BitcoreUtil     = require('bitcore/util/util');

  function Address(addrStr) {
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
/*      function (cb) {
        TransactionIn.find({addr:self.addrStr}).exec(function(err,txIn){
          if (err) return cb(err);

          txIn.forEach(function(txItem){

            self.balanceSat       += txItem.value_sat;
            self.totalReceivedSat += txItem.value_sat;
          });
          return cb();
        });
      },
*/
      function (cb) {
        TransactionOut.find({addr:self.addrStr}).exec(function(err,txOut){
          if (err) return cb(err);

          txOut.forEach(function(txItem){

            self.totalReceivedSat += txItem.value_sat;
            self.transactions.push(txItem.txid);
            if (! txItem.spendTxIdBuf) {
              // unspent
              self.balanceSat   += txItem.value_sat;
              self.txApperances +=1;
            }
            else {
              // spent
              self.totalSentSat += txItem.value_sat;
              self.transactions.push(txItem.spendTxid);
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

