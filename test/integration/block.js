#!/usr/bin/env node
'use strict';

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
    Block.fromHashWithInfo(TESTING_BLOCK, function(err, b2) {
        if (err) done(err);


        var h = new Buffer(TESTING_BLOCK,'hex');
        assert(b2.hashStr === TESTING_BLOCK);
        assert.equal(b2.hashStr, TESTING_BLOCK);
        done();
      });
  });

  it('should poll block\'s info from bitcoind', function(done) {
    Block.fromHashWithInfo(TESTING_BLOCK, function(err, b2) {
        if (err) done(err);
        assert.equal(b2.info.hash, TESTING_BLOCK);
        assert.equal(b2.info.chainwork, '000000000000000000000000000000000000000000000000001b6dc969ffe847');
        done();
    });
  });


  it('hash Virtuals SET', function(done) {
    var b = new Block();
    b.hashStr = 'a1a2';
    assert.equal(b.hash.toString('hex'),'a1a2');
    b.nextBlockHashStr = 'a1a3';
    assert.equal(b.nextBlockHash.toString('hex'),'a1a3');
    done();
  });


  it('hash Virtuals GET', function(done) {
    var b = new Block();
    b.hash = new Buffer('a1a2','hex');
    assert.equal(b.hashStr,'a1a2');


    b.nextBlockHash = new Buffer('b2b1','hex');
    assert.equal(b.nextBlockHashStr,'b2b1');
    done();
  });
});

