'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var Lock = require('../lib/lock');

describe('Lock', function() {
  it('should lock tasks using the same token', function(done) {
    var i = 0;
    Lock.get('123', function(lock) {
      i++;
      setTimeout(function() {
        lock.free();
      }, 2);
      Lock.get('123', function(lock) {
        i++;
        lock.free();
      });
    });
    setTimeout(function() {
      i.should.equal(1);
    }, 1);
    setTimeout(function() {
      i.should.equal(2);
      done();
    }, 3);
  });
  it('should not lock tasks using different tokens', function(done) {
    var i = 0;
    Lock.get('123', function(lock) {
      i++;
      setTimeout(function() {
        lock.free();
      }, 2);
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
