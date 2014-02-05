#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';


var TESTING_BLOCK = '000000000185678d3d7ecc9962c96418174431f93fe20bf216d5565272423f74';

var
  assert  = require('assert'),
  config      = require('../../config/config'),
  BlockDb     = require('../../lib/BlockDb').class();

var bDb;

describe('BlockDb fromHashWithInfo', function(){


  before(function(c) {
    bDb = new BlockDb();
    return c();
  });

  it('should poll block\'s info from bitcoind', function(done) {
    bDb.fromHashWithInfo(TESTING_BLOCK, function(err, b2) {
        if (err) done(err);
        assert.equal(b2.hash, TESTING_BLOCK);
        assert.equal(b2.info.hash, TESTING_BLOCK);
        assert.equal(b2.info.chainwork, '000000000000000000000000000000000000000000000000001b6dc969ffe847');
        done();
    });
  });
  it('return true in has', function(done) {
    bDb.has(TESTING_BLOCK, function(err, has) {
      assert.equal(has, true);
      done();
    });
  });
  it('setOrphan', function(done) {
    var b16 = '00000000c4cbd75af741f3a2b2ff72d9ed4d83a048462c1efe331be31ccf006b';
    var b17 = '00000000fe198cce4c8abf9dca0fee1182cb130df966cc428ad2a230df8da743';

    bDb.has(b17, function(err, has) {
      assert(has);
      bDb.setOrphan(b17, function(err, oldPrev) {
        assert.equal(oldPrev, b16);
        bDb.setPrev(b17, b16, function(err, oldPrev) {
          bDb.getPrev(b17, function(err, p) {
            assert.equal(p, b16);
            done();
          });
        });
      });
    });
  });
});

