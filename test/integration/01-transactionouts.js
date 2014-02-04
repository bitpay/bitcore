#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';



var 
  assert          = require('assert'),
  fs              = require('fs'),
  util            = require('util'),
  config          = require('../../config/config'),
  TransactionDb = require('../../lib/TransactionDb').class();

var txItemsValid = JSON.parse(fs.readFileSync('test/integration/txitems.json'));

describe('TransactionDb', function(){

  var tdb = new TransactionDb();

  txItemsValid.forEach( function(v) {
    if (v.disabled) return;
    it('test a processing tx ' + v.txid, function(done) {
      this.timeout(60000);

      // Remove first
      tdb.removeFromTxId(v.txid, v.toRm, function() {

        tdb.fromTxId( v.txid, function(err, readItems) {
          assert.equal(readItems.length,0);

          var unmatch=[];
          tdb.createFromArray([v.txid], null, function(err) {
            if (err) return done(err);

            tdb.fromTxId( v.txid, function(err, readItems) {

              v.items.forEach(function(validItem){ 
                unmatch[validItem.addr] =1;
              });
              assert.equal(readItems.length,v.items.length);

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
              return done();

            });
          });
        });
      });
    });
  });
});



