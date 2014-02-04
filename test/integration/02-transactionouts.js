#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';



var 
  assert          = require('assert'),
  fs              = require('fs'),
  util            = require('util'),
  async           = require('async'),
  config          = require('../../config/config'),
  TransactionDb = require('../../lib/TransactionDb').class();

var spentValid   = JSON.parse(fs.readFileSync('test/integration/spent.json'));

describe('TransactionDb Expenses', function(){
  var tdb = new TransactionDb();

  before(function(done) {

    // lets spend!
    async.each(Object.keys(spentValid), 
      function(txid,c_out) {
        async.each(spentValid[txid], 
                  function(i,c_in) {
                    tdb.createFromArray([i.txid], null, function(err) {
                      return c_in();
                    });
                  }, 
                  function(err) {
                    console.log('Done spending ', txid); //TODO
                    return c_out();
                  }
        );
      },
      function(err) {
        return done();
      }
    );
  });

  Object.keys(spentValid).forEach( function(txid) {
    it('test result of spending tx ' + txid, function(done) {
      var s = spentValid[txid];
      var c=0;
      tdb.fromTxId( txid, function(err, readItems) {
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
