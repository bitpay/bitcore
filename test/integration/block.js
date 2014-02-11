#!/usr/bin/env node

'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';


var TESTING_BLOCK = '000000000185678d3d7ecc9962c96418174431f93fe20bf216d5565272423f74';

var
assert = require('assert'),
  //  config      = require('../../config/config'),
  BlockDb = require('../../lib/BlockDb').class();

var bDb;

describe('BlockDb fromHashWithInfo', function() {

  before(function(c) {
    bDb = new BlockDb();
    return c();
  });

  it('should poll block\'s info from bitcoind', function(done) {
    bDb.fromHashWithInfo(TESTING_BLOCK, function(err, b2) {
      if (err) done(err);
      assert.equal(b2.hash, TESTING_BLOCK, 'hash');
      assert.equal(b2.info.hash, TESTING_BLOCK, 'info.hash');
      assert.equal(b2.info.height, 71619);
      assert.equal(b2.info.nonce, 3960980741);
      assert.equal(b2.info.bits, '1c018c14');
      assert.equal(b2.info.merkleroot, '9a326cb524aa2e5bc926b8c1f6de5b01257929ee02158054b55aae93a55ec9dd');
      assert.equal(b2.info.nextblockhash, '000000000121941b3b10d76fbe67b35993df91eb3398e9153e140b4f6213cb84');
      done();
    });
  });
  it('return true in has', function(done) {
    bDb.has(TESTING_BLOCK, function(err, has) {
      assert.equal(has, true);
      done();
    });
  });
});
