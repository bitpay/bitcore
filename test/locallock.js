'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var Lock = require('../lib/locallock');


describe('Local locks', function() {
  var lock;
  beforeEach(function() {
    this.clock = sinon.useFakeTimers();
    lock = new Lock();
  });
  afterEach(function() {
    this.clock.restore();
  });
  it('should lock tasks using the same token', function() {
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
    a.should.equal(true);
    b.should.equal(false);
    this.clock.tick(10);
    a.should.equal(true);
    b.should.equal(true);
  });
  it('should not lock tasks using different tokens', function() {
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
    i.should.equal(2);
  });
  it('should return error if unable to acquire lock', function() {
    lock.locked('123', 0, 0, function(err, release) {
      should.not.exist(err);
      setTimeout(function() {
        release();
      }, 5);
      lock.locked('123', 1, 0, function(err, release) {
        should.exist(err);
        err.toString().should.contain('Could not acquire lock 123');
      });
    });
    this.clock.tick(2);
  });
  it('should release lock if acquired for a long time', function() {
    var i = 0;
    lock.locked('123', 0, 3, function(err, release) {
      should.not.exist(err);
      i++;
      lock.locked('123', 20, 0, function(err, release) {
        should.not.exist(err);
        i++;
        release();
      });
    });
    i.should.equal(1);
    this.clock.tick(1);
    i.should.equal(1);
    this.clock.tick(10);
    i.should.equal(2);
  });
  it('should only release one pending task on lock timeout', function() {
    var i = 0;
    lock.locked('123', 0, 3, function(err, release) {
      should.not.exist(err);
      i++;
      lock.locked('123', 5, 0, function(err, release) {
        should.not.exist(err);
        i++;
        setTimeout(function() {
          release();
        }, 5);
      });
      lock.locked('123', 20, 0, function(err, release) {
        should.not.exist(err);
        i++;
        release();
      });
    });
    i.should.equal(1);
    this.clock.tick(4);
    i.should.equal(2)
    this.clock.tick(7);
    i.should.equal(3)
  });

});
