#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';



var 
  mongoose= require('mongoose'),
  assert  = require('assert'),
  config       = require('../../config/config'),
  Transaction  = require('../../app/models/Transaction'),
  TransactionItem  = require('../../app/models/TransactionItem'),
  fs      = require('fs'),
  util    = require('util');


var txItemsValid = JSON.parse(fs.readFileSync('test/model/txitems.json'));
mongoose.connection.on('error', function(err) { console.log(err); });

describe('Transaction', function(){

  before(function(done) {
    mongoose.connect(config.db);
    done();
  });

  after(function(done) {
    mongoose.connection.close();
    done();
  });



  it('should pool tx\'s object from mongoose', function(done) {
    var txid = '7e621eeb02874ab039a8566fd36f4591e65eca65313875221842c53de6907d6c';
    Transaction.fromIdWithInfo(txid, function(err, tx) {
      if (err) done(err);
      assert.equal(tx.txid, txid);
      assert(!tx.info.isCoinBase);

      for(var i=0; i<20; i++)
        assert(parseFloat(tx.info.vin[i].value) === parseFloat(50));
      assert(tx.info.vin[0].addr === 'msGKGCy2i8wbKS5Fo1LbWUTJnf1GoFFG59');
      assert(tx.info.vin[1].addr === 'mfye7oHsdrHbydtj4coPXCasKad2eYSv5P');
      done();
    });
  });

  it('should pool tx\'s object from mongoose', function(done) {
    var txid = '21798ddc9664ac0ef618f52b151dda82dafaf2e26d2bbef6cdaf55a6957ca237';
    Transaction.fromIdWithInfo(txid, function(err, tx) {
      if (err) done(err);
      assert.equal(tx.txid, txid);
      assert(!tx.info.isCoinBase);
      done();
    });
  });

  it('should pool tx\'s info from bitcoind', function(done) {
    var txid = '21798ddc9664ac0ef618f52b151dda82dafaf2e26d2bbef6cdaf55a6957ca237';
    Transaction.fromIdWithInfo(txid, function(err, tx) {
      if (err) done(err);
      assert.equal(tx.info.txid, txid);
      assert.equal(tx.info.blockhash, '000000000185678d3d7ecc9962c96418174431f93fe20bf216d5565272423f74');
      assert.equal(tx.info.valueOut, 1.66174);
      assert.equal(tx.info.feeds, 0.0005 );
      assert.equal(tx.info.size, 226 );
      assert(!tx.info.isCoinBase);
      done();
    });
  });

  var txid1 = '2a104bab1782e9b6445583296d4a0ecc8af304e4769ceb64b890e8219c562399';
  it('test a coinbase TX ' + txid1, function(done) {
    Transaction.fromIdWithInfo(txid1, function(err, tx) {
      if (err) done(err);
      assert(tx.info.isCoinBase);
      assert.equal(tx.info.txid, txid1);
      assert(!tx.info.feeds);
      done();
    });
  });


  var txid2 = '64496d005faee77ac5a18866f50af6b8dd1f60107d6795df34c402747af98608';
  it('test a broken TX ' + txid2, function(done) {
    Transaction.fromIdWithInfo(txid2, function(err, tx) {
      if (err) done(err);
      assert.equal(tx.info.txid, txid2);
      assert.equal(tx.info.vin[0].addr, 'n1JagbRWBDi6VMvG7HfZmXX74dB9eiHJzU');

      // TODO output -> multisig!
      // https://www.biteasy.com/testnet/transactions/64496d005faee77ac5a18866f50af6b8dd1f60107d6795df34c402747af98608
      done();
    });
  });

  
  txItemsValid.forEach( function(v) {
    it('test a exploding TX ' + v.txid, function(done) {

      // Remove first
      TransactionItem.remove({txid: v.txid}, function(err) {

        Transaction.explodeTransactionItems(v.txid, function(err, tx) {
          if (err) done(err);

          TransactionItem.find({txid: v.txid}).sort({ index:1 }).exec(function(err, readItems) {

            var unmatch={};

            v.items.forEach(function(validItem){ 
              unmatch[validItem.addr] =1;
            });
            v.items.forEach(function(validItem){ 
              readItems.forEach(function(readItem){ 
                if ( readItem.addr === validItem.addr && 
                    parseInt(readItem.index) ==  parseInt(validItem.index) && 
                    parseFloat(readItem.value) == parseFloat(validItem.value) ) 
                  delete unmatch[validItem.addr];
              });
            });
            var valid = util.inspect(v.items, { depth: null });
            assert(!Object.keys(unmatch).length, '\n\tmatched:' + Object.keys(unmatch) + "\n\n" +valid + '\nvs.\n' + readItems);
            done();
          });
        });
      });
    });
  });
});

