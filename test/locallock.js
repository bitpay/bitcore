'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var Lock = require('../lib/locallock');

describe('Local lock', function() {
  it('should lock tasks using the same token', function(done) {
    var a = false,
      b = false;
    Lock.get('123', function(lock) {
      a = true;
      setTimeout(function() {
        lock.free();
      }, 5);
      Lock.get('123', function(lock) {
        b = true;
        lock.free();
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
    Lock.get('123', function(lock) {
      i++;
      setTimeout(function() {
        lock.free();
      }, 5);
      Lock.get('456', function(lock) {
        i++;
        lock.free();
      });
    });
    setTimeout(function() {
      i.should.equal(2);
      done();
    }, 1);
  });
});
