#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';



var mongoose      = require('mongoose'),
  assert          = require('assert'),
  fs              = require('fs'),
  util            = require('util'),
  config          = require('../../config/config'),
  Transaction     = require('../../app/models/Transaction').class(),
  TransactionItem = require('../../app/models/TransactionItem');

var txItemsValid = JSON.parse(fs.readFileSync('test/model/txitems.json'));
  

mongoose.connection.on('error', function(err) { console.log(err); });

describe('TransactionItem', function(){

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
    it('test a exploding TX ' + v.txid, function(done) {

      // Remove first
      TransactionItem.remove({txid: v.txid}, function(err) {

        TransactionItem.explodeTransactionItems(v.txid, function(err, tx) {
          if (err) done(err);

          TransactionItem
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

