#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';



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
    var test_txid = '21798ddc9664ac0ef618f52b151dda82dafaf2e26d2bbef6cdaf55a6957ca237';
    Transaction.fromIdWithInfo(test_txid, function(err, tx) {
      if (err) done(err);
      assert.equal(tx.txid, test_txid);
      done();
    });
  });

  it('should pool tx\'s info from bitcoind', function(done) {
    var test_txid = '21798ddc9664ac0ef618f52b151dda82dafaf2e26d2bbef6cdaf55a6957ca237';
    Transaction.fromIdWithInfo(test_txid, function(err, tx) {
      if (err) done(err);
      assert.equal(tx.info.txid, test_txid);
      assert.equal(tx.info.blockhash, '000000000185678d3d7ecc9962c96418174431f93fe20bf216d5565272423f74');
      assert.equal(tx.info.valueOut, 1.66174);
      assert.equal(tx.info.feeds, 0.0005 );
      assert.equal(tx.info.size, 226 );
      done();
    });
  });

  it('test a coinbase TX', function(done) {
    var test_txid2 = '2a104bab1782e9b6445583296d4a0ecc8af304e4769ceb64b890e8219c562399';
    Transaction.fromIdWithInfo(test_txid2, function(err, tx) {
      if (err) done(err);
      assert(tx.info.isCoinBase);
      assert.equal(tx.info.txid, test_txid2);
      done();
    });
  });
 
});

