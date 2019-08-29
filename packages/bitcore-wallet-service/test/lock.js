'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var expect = require('chai').expect;
var { Lock } = require('../ts_build/lib/lock');
var helpers = require('./integration/helpers');

    var step=50;

describe('Locks', function() {
  var lock, clock, order = [], storage;

  before(function(done) {
    helpers.before(function(res) {
      storage = res.storage;
      done();
    });
  });


  beforeEach(function(done) {
    var self = this;
    helpers.beforeEach(function() {
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
            expect(order).to.deep.equal([0,4,1,5,2,6,3]);
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
    pushEvent(0);

    function testDone() {
      if ( _.isEmpty(_.difference([0,4,1,2,3], order)) ) {
        pushEvent('done');
        done();
      }
    }

    lock.acquire('123', {}, function(err, release) {
      should.not.exist(err);
      pushEvent(1);
      setTimeout(function() {
        release();
        testDone();
      }, step);
    }, 1);
    lock.acquire('123', {}, function(err, release) {
      should.not.exist(err);
      pushEvent(2);
      setTimeout(function() {
        release();
        testDone();
      }, step);
    }, 2);
    lock.acquire('123', {}, function(err, release) {
      should.not.exist(err);
      pushEvent(3);
      setTimeout(function() {
        release();
        testDone();
      }, step);
    }, 3);
    pushEvent(4);

  });

  it('should not lock tasks using different tokens', function(done) {

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
          expect(order.indexOf(3)).to.be.below(order.indexOf(2));
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

    var err1;

    pushEvent(0);

    lock.acquire('123', {}, function(err, release) {
      should.not.exist(err);
      pushEvent(1);
      lock.acquire('123', {waitTime:1}, function(err, release2) {
        release();
        expect(err).to.contain('LOCKED');
        done();
      });
    });
  });
  it('should release lock if acquired for a long time', function(done) {

    lock.acquire('123', {lockTime:10}, function(err, release) {
      should.not.exist(err);
      lock.acquire('123', {waitTime:1000}, function(err, release) {
        should.not.exist(err);
        done();
      });
    });
  });
  it('should release lock if acquired for a long time (case 2)', function(done) {

    // no releases
    lock.acquire('123', {lockTime:10}, function(err, release) {
      should.not.exist(err);
    });

    lock.acquire('123', {lockTime:20}, function(err, release) {
      should.not.exist(err);
    });
    lock.acquire('123', {lockTime:30}, function(err, release) {
      should.not.exist(err);
      lock.acquire('123', {lockTime:30}, function(err, release) {
        should.not.exist(err);
        lock.acquire('123', {waitTime:1000}, function(err, release) {
          should.not.exist(err);
          done();
        });
      });
    });
  });



  describe("#runLocked", () => {
    it('should run a locked function', function(done) {
      var called =0;

      function end() {
        called++;
      }

      function task() {
        setTimeout(() => {
          expect(called).to.equal(0);
          done();
        },200);
      }

      lock.runLocked('123', {}, end, task);
    });


    it('should lock locked functions', function(done) {
      var called =0;

      function end() {
        called++;
        expect(called).to.equal(1);
        done();
      }

      function task() {
        lock.runLocked('123', {waitTime:100}, end, () => {
          setTimeout(() => {
          },200);
        });
     }

      lock.runLocked('123', {}, end, task);
    });

  });


});
