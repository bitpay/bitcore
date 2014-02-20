#!/usr/bin/env node

'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var assert = require('assert'),
  fs = require('fs'),
  Address = require('../../app/models/Address').class(),
  TransactionDb = require('../../lib/TransactionDb').class(),
  addrValid = JSON.parse(fs.readFileSync('test/integration/addr.json')),
  utxoValid = JSON.parse(fs.readFileSync('test/integration/utxo.json'));

var txDb;
describe('Address balances', function() {

  before(function(c) {
    txDb = new TransactionDb();
    return c();
  });

  addrValid.forEach(function(v) {
    if (v.disabled) {
      console.log(v.addr + ' => disabled in JSON');
    } else {
      it('Address info for: ' + v.addr, function(done) {
        this.timeout(5000);

        var a = new Address(v.addr, txDb);

        a.update(function(err) {
          if (err) done(err);
          assert.equal(v.addr, a.addrStr);
          assert.equal(a.unconfirmedTxApperances ,0, 'unconfirmedTxApperances: 0');
          assert.equal(a.unconfirmedBalanceSat ,0, 'unconfirmedBalanceSat: 0');
          if (v.txApperances)
            assert.equal(v.txApperances, a.txApperances, 'txApperances: ' + a.txApperances);
          if (v.totalReceived) assert.equal(v.totalReceived, a.totalReceived, 'received: ' + a.totalReceived);
          if (v.totalSent) assert.equal(v.totalSent, a.totalSent, 'send: ' + a.totalSent);

          if (v.balance) assert.equal(v.balance, a.balance, 'balance: ' + a.balance);

          if (v.transactions) {

            v.transactions.forEach(function(tx) {
              assert(a.transactions.indexOf(tx) > -1, 'have tx ' + tx);
            });
          }
          done();
        });
      });
    }
  });

});


describe('Address utxo', function() {
  utxoValid.forEach(function(v) {
    if (v.disabled) {
      console.log(v.addr + ' => disabled in JSON');
    } else {
      it('Address utxo for: ' + v.addr, function(done) {
        this.timeout(50000);

        var a = new Address(v.addr, txDb);
        a.getUtxo(function(err, utxo) {
          if (err) done(err);
          assert.equal(v.addr, a.addrStr);
          if (v.length) assert.equal(v.length, utxo.length, 'length: ' + utxo.length);
          if (v.tx0id) assert.equal(v.tx0id, utxo[0].txid, 'have tx: ' + utxo[0].txid);
          if (v.tx0scriptPubKey)
            assert.equal(v.tx0scriptPubKey, utxo[0].scriptPubKey, 'have tx: ' + utxo[0].scriptPubKey);
          if (v.tx0amount) 
            assert.equal(v.tx0amount, utxo[0].amount, 'amount: ' + utxo[0].amount);
          done();
        });
      });
    }
  });
});
