#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';



var 
  assert          = require('assert'),
  fs              = require('fs'),
  util            = require('util'),
  async           = require('async'),
  config          = require('../../config/config'),
  TransactionDb   = require('../../lib/TransactionDb').class();

var spentValid   = JSON.parse(fs.readFileSync('test/integration/spent.json'));

var txDb;

describe('TransactionDb Expenses', function(){

  before(function(c) {
    txDb = new TransactionDb();

    // lets spend!
    async.each(Object.keys(spentValid), 
      function(txid,c_out) {
        async.each(spentValid[txid], 
                  function(i,c_in) {
                    txDb.createFromArray([i.txid], null, function(err) {
                      return c_in();
                    });
                  }, 
                  function(err) {
                    return c_out();
                  }
        );
      },
      function(err) {
        return c();
      }
    );
  });

  Object.keys(spentValid).forEach( function(txid) {
    it('test result of spending tx ' + txid, function(done) {
      var s = spentValid[txid];
      var c=0;
      txDb.fromTxId( txid, function(err, readItems) {
        s.forEach( function(v) {
          assert.equal(readItems[c].spendTxId,v.txid);
          assert.equal(readItems[c].spendIndex,v.n);
          c++;
        });
        done();
      });
    });
  });
});
