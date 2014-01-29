#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';



var mongoose      = require('mongoose'),
  assert          = require('assert'),
  fs              = require('fs'),
  util            = require('util'),
  async           = require('async'),
  config          = require('../../config/config'),
  TransactionOut = require('../../app/models/TransactionOut');

var spentValid   = JSON.parse(fs.readFileSync('test/model/spent.json'));

mongoose.connection.on('error', function(err) { console.log(err); });



describe('TransactionOut Expenses', function(){

  before(function(done) {
    mongoose.connect(config.db);

    // lets spend!
    async.each(Object.keys(spentValid), 
      function(txid,c_out) {
        async.each(spentValid[txid], 
                  function(i,c_in) {
                    TransactionOut._explodeTransactionOuts(i.txid, function(err) {
                      return c_in();
                    });
                  }, 
                  function(err) {
                    return c_out();
                  }
        );
      },
      function(err) {
        console.log('[transactionouts.js.88]'); //TODO
        return done();
      }
    );
  });

  after(function(done) {
    mongoose.connection.close();
    done();
  });

  Object.keys(spentValid).forEach( function(txid) {
    it('test result of spending tx ' + txid, function(done) {
      var s = spentValid[txid];
      var c=0;
      TransactionOut.fromTxId( txid, function(err, readItems) {
        s.forEach( function(v) {
          assert.equal(readItems[c].spendTxIdBuf.toString('hex'),v.txid);
          assert.equal(readItems[c].spendIndex,v.n);
          c++;
        });
        done();
      });
    });
  });
});
