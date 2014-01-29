#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';



var mongoose      = require('mongoose'),
  assert          = require('assert'),
  fs              = require('fs'),
  util            = require('util'),
  config          = require('../../config/config'),
  TransactionOut = require('../../app/models/TransactionOut');

var txItemsValid = JSON.parse(fs.readFileSync('test/model/txitems.json'));

mongoose.connection.on('error', function(err) { console.log(err); });

describe('TransactionOut', function(){

  before(function(done) {
    mongoose.connect(config.db);
    done();
  });

  after(function(done) {
    mongoose.connection.close();
    done();
  });

  txItemsValid.forEach( function(v) {
    if (v.disabled) return;
    it('test a exploding tx ' + v.txid, function(done) {

      // Remove first
      TransactionOut.removeFromTxId(v.txid, function(err) {
        TransactionOut._explodeTransactionOuts(v.txid, function(err, tx) {
          if (err) done(err);

          TransactionOut
            .fromTxId( v.txid, function(err, readItems) {

            var unmatch={};

            v.items.forEach(function(validItem){ 
              unmatch[validItem.addr] =1;
            });
            v.items.forEach(function(validItem){ 
              var readItem = readItems.shift();
              assert.equal(readItem.addr,validItem.addr);
              assert.equal(readItem.value_sat,validItem.value_sat);
              assert.equal(readItem.index,validItem.index);
              assert.equal(readItem.spendIndex, null);
              assert.equal(readItem.spendTxIdBuf, null);
              delete unmatch[validItem.addr];
            });

            var valid = util.inspect(v.items, { depth: null });
            assert(!Object.keys(unmatch).length,'\n\tUnmatchs:' + Object.keys(unmatch) + "\n\n" +valid + '\nvs.\n' + readItems);
            done();

          });
        });
      });
    });
  });
});



