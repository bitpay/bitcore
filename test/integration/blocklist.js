#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var TESTING_BLOCK = '000000001f56660def9b5898ea8411d7b028854e78502e521f9ebd53e673751c';
var START_TS = '1391607675';
var END_TS = '1391607709';

var
  assert  = require('assert'),
  config      = require('../../config/config'),
  BlockDb     = require('../../lib/BlockDb').class();

describe('BlockDb getHashes', function(){

  var bdb = new BlockDb();
  it('Get Hash by Date', function(done) {

    bdb.getBlocksByDate(START_TS, END_TS, function(err, list) {
      if (err) done(err);
      assert.equal(list[0].ts, START_TS);
      assert.equal(list[0].hash, TESTING_BLOCK);
      done();
    });
  });
});

