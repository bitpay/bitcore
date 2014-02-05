#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var assert  = require('assert'),
  Status = require('../../app/models/Status').class();

describe('Status', function(){

  it('getInfo', function(done) {
    var d = new Status();

    d.getInfo(function(err) {
      if (err) done(err);
      assert.equal('number', typeof d.info.difficulty);
      done();
    });
  });

  it('getDifficulty', function(done) {
    var d = new Status();

    d.getDifficulty(function(err) {
      if (err) done(err);
      assert.equal('number', typeof d.difficulty);
      done();
    });
  });

  it('getTxOutSetInfo', function(done) {
    var d = new Status();

    d.getTxOutSetInfo(function(err) {
      if (err) done(err);
      assert.equal('number', typeof d.txoutsetinfo.txouts);
      done();
    });
  });

  it('getLastBlockHash', function(done) {
    var d = new Status();

    d.getLastBlockHash(function(err) {
      if (err) done(err);
      assert.equal('string', typeof d.lastblockhash);
      done();
    });
  });


});

