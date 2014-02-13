'use strict';

require('classtool');


function spec() {
  var async           = require('async');
  var BitcoreAddress  = require('bitcore/Address').class();
  var BitcoreUtil     = require('bitcore/util/util');
  var TransactionDb   = require('../../lib/TransactionDb').class();

  function Address(addrStr) {
    this.balanceSat        = 0;
    this.totalReceivedSat  = 0;
    this.totalSentSat      = 0;

    this.unconfirmedBalanceSat  = 0;

    this.txApperances           = 0;
    this.unconfirmedTxApperances= 0;

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


    Object.defineProperty(this, 'unconfirmedBalance', {
      get: function() {
        return parseFloat(this.unconfirmedBalanceSat) / parseFloat(BitcoreUtil.COIN);
      },
      set:  function(i) {
        this.unconfirmedBalanceSat =  i * BitcoreUtil.COIN;
      },
      enumerable: 1,
    });

  }

  Address.prototype.update = function(next) {
    var self = this;
    if (!self.addrStr) return next();

    var txs  = [];
    var db   = new TransactionDb();
    async.series([
      function (cb) {
        db.fromAddr(self.addrStr, function(err,txOut){
          if (err) return cb(err);
          txOut.forEach(function(txItem){

            var v = txItem.value_sat;

            txs.push({txid: txItem.txid, ts: txItem.ts});

            if (txItem.spendTxId) {
              txs.push({txid: txItem.spendTxId, ts: txItem.spendTs});
            }

            if (txItem.isConfirmed) {
              self.txApperances += 1;
              self.totalReceivedSat += v;
              if (! txItem.spendTxId ) {
                //unspend
                self.balanceSat   += v;
              }
              else if(!txItem.spendIsConfirmed) {
                // unspent
                self.balanceSat   += v;
                self.unconfirmedBalanceSat -= v;
                self.unconfirmedTxApperances += 1;
              }
              else {
                // spent
                self.totalSentSat += v;
                self.txApperances += 1;
              }
            }
            else {
              self.unconfirmedBalanceSat += v;
              self.unconfirmedTxApperances += 1;
            }
          });
          return cb();
        });
      },
    ], function (err) {

      // sort input and outputs togheter
      txs.sort(
        function compare(a,b) {
          if (a.ts < b.ts) return 1;
          if (a.ts > b.ts) return -1;
          return 0;
        });

      self.transactions = txs.map(function(i) { return i.txid; } );
      return next(err);
    });
  };

  return Address;
}
module.defineClass(spec);

