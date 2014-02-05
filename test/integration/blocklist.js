#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var TESTING_BLOCK0 = '000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943';
var TESTING_BLOCK1 = '00000000b873e79784647a6c82962c70d228557d24a747ea4d1b8bbe878e1206';
var START_TS  = 1; 
var END_TS    = '1296688928~'; // 2/2/2011 23:23PM

var assert  = require('assert'),
  BlockDb     = require('../../lib/BlockDb').class();

var bDb;

describe('BlockDb getBlocksByDate', function(){


  before(function(c) {
    bDb = new BlockDb();
    return c();
  });

  it('Get Hash by Date', function(done) {

    bDb.getBlocksByDate(START_TS, END_TS, function(err, list) {
      if (err) done(err);
      assert(list, 'returns list');
      assert.equal(list.length,2, 'list has 2 items');
      assert.equal(list[0].hash, TESTING_BLOCK0);
      assert.equal(list[1].hash, TESTING_BLOCK1);
      done();
    });
  });
});

