#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';


var TESTING_BLOCK = '000000000185678d3d7ecc9962c96418174431f93fe20bf216d5565272423f74';

var
  assert  = require('assert'),
  config      = require('../../config/config'),
  BlockDb     = require('../../lib/BlockDb').class();


describe('BlockDb fromHashWithInfo', function(){

  var bdb = new BlockDb();
  it('should poll block\'s info from bitcoind', function(done) {
    bdb.fromHashWithInfo(TESTING_BLOCK, function(err, b2) {
        if (err) done(err);
        assert.equal(b2.hash, TESTING_BLOCK);
        assert.equal(b2.info.hash, TESTING_BLOCK);
        assert.equal(b2.info.chainwork, '000000000000000000000000000000000000000000000000001b6dc969ffe847');
        done();
    });
  });
  it('return true in has', function(done) {
    bdb.has(TESTING_BLOCK, function(err, has) {
      assert.equal(has, true);
console.log('[block.js.29:has:]',has); //TODO
      done();
    });
  });
  it('return false in has', function(done) {
    bdb.has('111', function(err, has) {
      assert.equal(has, false);
      done();
    });
  });



});

