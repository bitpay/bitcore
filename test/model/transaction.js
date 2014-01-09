#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';


var TESTING_TX = '21798ddc9664ac0ef618f52b151dda82dafaf2e26d2bbef6cdaf55a6957ca237';

var 
  mongoose= require('mongoose'),
  assert  = require('assert'),
  config       = require('../../config/config'),
  Transaction  = require('../../app/models/Transaction');


mongoose.connection.on('error', function(err) { console.log(err); });

describe('Transaction fromIdWithInfo', function(){

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
      assert.equal(tx.info.blockhash, '000000000185678d3d7ecc9962c96418174431f93fe20bf216d5565272423f74');
      assert.equal(tx.info.valueOut, 1.66174);
      assert.equal(tx.info.feeds, 0.0005 );
      assert.equal(tx.info.size, 226 );
      done();
    });
  });
});

