'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var Lock = require('../lib/lock');
var helpers = require('./integration/helpers');


describe('Locks', function() {
  var lock, clock, order = [];

  before(function(done) {
    helpers.before(function(res) {
      done();
    });
  });
  beforeEach(function(done) {
    var self = this;
    helpers.beforeEach(function(res) {
      let storage = res.storage;
      lock = new Lock(storage);
      order = [];
      done();
    });
  });
  afterEach(function() {
  });


  function pushEvent(i) {
    order.push(i);
  }


  it('should lock tasks using the same token', function(done) {
    var a = false,
      b = false, 
      step = 100;


    pushEvent(0);

    lock.acquire('123', {}, function(err, release) {
      should.not.exist(err);
      pushEvent(1);
      setTimeout(function() {
        release();
      }, step);
      lock.acquire('123', {}, function(err, release) {
        should.not.exist(err);
        pushEvent(2);
        setTimeout(function() {
          release();
        }, step);
        lock.acquire('123', {}, function(err, release) {
          should.not.exist(err);
          pushEvent(3);
          setTimeout(function() {
            release();
            order.should.be.deep.equal([0,4,1,5,2,6,3]);
            done();
          },step);
        });
        pushEvent(6);
      });
      pushEvent(5);
    });
    pushEvent(4);

  });

  it('should call waiting tasks', function(done) {
    var a = false,
      b = false, 
      step = 100;


    pushEvent(0);

    lock.acquire('123', {}, function(err, release) {
      should.not.exist(err);
      pushEvent(1);
      setTimeout(function() {
        release();
      }, step);
    }, 1);
    lock.acquire('123', {}, function(err, release) {
      should.not.exist(err);
      pushEvent(2);
      setTimeout(function() {
        release();
      }, step);
    }, 2);
    lock.acquire('123', {}, function(err, release) {
      should.not.exist(err);
      pushEvent(3);
      setTimeout(function() {
        release();
      }, step);
    }, 3);
    pushEvent(4);

    setTimeout(function() {
      order[1].should.equal(4);

      //order is not assured
      _.difference([0,4,1,2,3], order).should.be.empty();

      done();
    }, 3*step);

  });
 
  it('should not lock tasks using different tokens', function(done) {
    var step=100;

    pushEvent(0);

    lock.acquire('123', {}, function(err, release) {
      should.not.exist(err);
      pushEvent(1);
      setTimeout(function() {
        release();
      }, step);
      lock.acquire('123', {}, function(err, release) {
        should.not.exist(err);
        pushEvent(2);
        setTimeout(function() {
          release();
          order.indexOf(3).should.be.below(order.indexOf(2));
          done();
        }, step);
      });

    });

    lock.acquire('123', {}, function(err, release) {
      should.not.exist(err);
      pushEvent(3);
      setTimeout(function() {
        release();
      }, step);
    });
  });
  it('should return error if unable to acquire lock', function(done) {

    var step=100, err1;

    pushEvent(0);

    lock.acquire('123', {}, function(err, release) {
      should.not.exist(err);
      pushEvent(1);
      setTimeout(function() {
        release();
        err1.should.contain('Could not acquire');
        done();
      }, step);
      lock.acquire('123', {waitTime:1}, function(err, release) {
        err1 = err;
      },2);
    }, 1);
  });
  it('should release lock if acquired for a long time', function(done) {

    var step=100;

    lock.acquire('123', {lockTime:10}, function(err, release) {
      should.not.exist(err);
      lock.acquire('123', {waitTime:1000}, function(err, release) {
        should.not.exist(err);
        done();
      },2);
    }, 1);
  });


  it('should support runLocked', function(done) {
    var step=100;

    lock.acquire('123', {lockTime:10}, function(err, release) {
      should.not.exist(err);
      lock.acquire('123', {waitTime:1000}, function(err, release) {
        should.not.exist(err);
        done();
      },2);
    }, 1);
 
  });

});
