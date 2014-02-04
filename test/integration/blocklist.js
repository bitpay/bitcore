#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var TESTING_BLOCK = '00000000b7cc12abe8a9a604813aab1f2c4f3a242a021065be52393a147a1a86';
var START_TS = '1391538611';
var END_TS = '1391538638';

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

