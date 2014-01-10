#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';


var TESTING_BLOCK = '000000000185678d3d7ecc9962c96418174431f93fe20bf216d5565272423f74';

var 
  mongoose= require('mongoose'),
  assert  = require('assert'),
  config      = require('../../config/config'),
  Block       = require('../../app/models/Block');


mongoose.connection.on('error', function(err) { console.log(err); });

describe('Block fromHashWithInfo', function(){

  before(function(done) {
    mongoose.connect(config.db);
    done();
  });

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


  it('should poll block\'s info from bitcoind', function(done) {
    var block2 = Block.fromHashWithInfo(TESTING_BLOCK, function(err, b2) {
        if (err) done(err);
        assert.equal(b2.info.hash, TESTING_BLOCK);
        assert.equal(b2.info.chainwork, '000000000000000000000000000000000000000000000000001b6dc969ffe847');
        done();
    });
  });
});

