#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';


var TESTING_TX = '9f4648538a8fd773029139f7e67cee51586bced78d7ff0388d10cb71096f2289';

var 
  mongoose= require('mongoose'),
  assert  = require('assert'),
  config       = require('../../config/config'),
  Transaction  = require('../../app/models/Transaction');


mongoose.connection.on('error', function(err) { console.log(err); });

describe('Transaction getInfo', function(){

  before(function(done) {
    mongoose.connect(config.db);
    done();
  });

  after(function(done) {
    mongoose.connection.close();
    done();
  });

  it('should pool tx\'s object from mongoose', function(done) {
    Transaction.fromIdWithInfo(TESTING_TX, function(err, tx) {
      if (err) done(err);
      assert.equal(tx.txid, TESTING_TX);
      done();
    });
  });

  it('should pool tx\'s info from bitcoind', function(done) {
    Transaction.fromIdWithInfo(TESTING_TX, function(err, tx) {
      if (err) done(err);
      assert.equal(tx.info.txid, TESTING_TX);
      assert.equal(tx.info.blockhash, '000000007af2a08af7ce4934167dc2afd7a2e6bfd31472332db02a6f38cb7b4d');
      done();
    });
  });
});

