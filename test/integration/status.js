#!/usr/bin/env node

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var 
  assert  = require('assert'),
  config  = require('../../config/config'),
  Status = require('../../app/models/Status').class(),
  mongoose= require('mongoose');

describe('Status', function(){

  before(function(done) {
    mongoose.connect(config.db);
    done();
  });

  after(function(done) {
    mongoose.connection.close();
    done();
  });

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

