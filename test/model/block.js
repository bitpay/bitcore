#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';


var TESTING_BLOCK = '000000000185678d3d7ecc9962c96418174431f93fe20bf216d5565272423f74';

var 
  mongoose= require('mongoose'),
  assert  = require('assert'),
  config      = require('../../config/config'),
  Block       = require('../../app/models/Block');


mongoose.connection.on('error', function(err) { console.log(err); });

<<<<<<< HEAD
describe('Block getInfo', function(){
=======
describe('Block fromHashWithInfo', function(){
>>>>>>> fd86e6d074c5aa4642172b221b9e6f69f3fd8634

  before(function(done) {
    mongoose.connect(config.db);
    done();
  });
<<<<<<< HEAD

  after(function(done) {
    mongoose.connection.close();
    done();
  });

  it('should poll block\'s info from mongoose', function(done) {
    var block2 = Block.fromHashWithInfo(TESTING_BLOCK, function(err, b2) {
        if (err) done(err);

        assert.equal(b2.hash, TESTING_BLOCK);
        done();
      });
  });
=======

  after(function(done) {
    mongoose.connection.close();
    done();
  });


  it('should poll block\'s info from mongoose', function(done) {
    var block2 = Block.fromHashWithInfo(TESTING_BLOCK, function(err, b2) {
        if (err) done(err);

        assert.equal(b2.hash, TESTING_BLOCK);
        done();
      });
  });

>>>>>>> fd86e6d074c5aa4642172b221b9e6f69f3fd8634

  it('should poll block\'s info from bitcoind', function(done) {
    var block2 = Block.fromHashWithInfo(TESTING_BLOCK, function(err, b2) {
        if (err) done(err);
        assert.equal(b2.info.hash, TESTING_BLOCK);
<<<<<<< HEAD
        assert.equal(b2.info.chainwork, '00000000000000000000000000000000000000000000000000446af21d50acd3');
=======
        assert.equal(b2.info.chainwork, '000000000000000000000000000000000000000000000000001b6dc969ffe847');
>>>>>>> fd86e6d074c5aa4642172b221b9e6f69f3fd8634
        done();
    });
  });
});

