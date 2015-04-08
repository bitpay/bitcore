'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var Lock = require('../lib/locallock');


describe('Local locks', function() {
  var lock;
  beforeEach(function() {
    lock = new Lock();
  });
  it('should lock tasks using the same token', function(done) {
    var a = false,
      b = false;
    lock.locked('123', 0, 0, function(err, release) {
      should.not.exist(err);
      a = true;
      setTimeout(function() {
        release();
      }, 5);
      lock.locked('123', 0, 0, function(err, release) {
        should.not.exist(err);
        b = true;
        release();
      });
    });
    setTimeout(function() {
      a.should.equal(true);
      b.should.equal(false);
    }, 1);
    setTimeout(function() {
      a.should.equal(true);
      b.should.equal(true);
      done();
    }, 8);
  });
  it('should not lock tasks using different tokens', function(done) {
    var i = 0;
    lock.locked('123', 0, 0, function(err, release) {
      should.not.exist(err);
      i++;
      setTimeout(function() {
        release();
      }, 5);
      lock.locked('456', 0, 0, function(err, release) {
        should.not.exist(err);
        i++;
        release();
      });
    });
    setTimeout(function() {
      i.should.equal(2);
      done();
    }, 1);
  });
});
