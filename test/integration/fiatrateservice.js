'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var log = require('npmlog');
log.debug = log.verbose;
log.level = 'info';

var helpers = require('./helpers');

var FiatRateService = require('../../lib/fiatrateservice');

describe.only('Fiat rate service', function() {
  var service, request;

  before(function(done) {
    helpers.before(done);
  });
  after(function(done) {
    helpers.after(done);
  });
  beforeEach(function(done) {
    helpers.beforeEach(function() {
      service = new FiatRateService();
      request = sinon.stub();
      request.get = sinon.stub();
      service.start({
        storage: helpers.getStorage(),
        request: request,
      }, done);
    });
  });
  describe('#getRate', function() {
    it('should get current rate', function(done) {
      service.storage.storeFiatRate('BitPay', [{
        code: 'USD',
        value: 123.45,
      }], function(err) {
        should.not.exist(err);
        service.getRate('USD', {}, function(err, res) {
          should.not.exist(err);
          res.rate.should.equal(123.45);
          done();
        });
      });
    });
    it('should get current for different currency', function(done) {
      service.storage.storeFiatRate('BitPay', [{
        code: 'USD',
        value: 123.45,
      }], function(err) {
        should.not.exist(err);
        service.storage.storeFiatRate('BitPay', [{
          code: 'EUR',
          value: 345.67,
        }], function(err) {
          should.not.exist(err);
          service.getRate('EUR', {}, function(err, res) {
            should.not.exist(err);
            res.rate.should.equal(345.67);
            done();
          });
        });
      });
    });
    it('should get rate for specific ts', function(done) {
      var clock = sinon.useFakeTimers(0, 'Date');
      service.storage.storeFiatRate('BitPay', [{
        code: 'USD',
        value: 123.45,
      }], function(err) {
        should.not.exist(err);
        clock.tick(100);
        service.storage.storeFiatRate('BitPay', [{
          code: 'USD',
          value: 345.67,
        }], function(err) {
          should.not.exist(err);
          service.getRate('USD', {
            ts: 50,
          }, function(err, res) {
            should.not.exist(err);
            res.rate.should.equal(123.45);
            clock.restore();
            done();
          });
        });
      });
    });

    it('should get rates for a series of ts', function(done) {
      var clock = sinon.useFakeTimers(0, 'Date');
      async.each([1.00, 2.00, 3.00, 4.00], function(value, next) {
        clock.tick(100);
        service.storage.storeFiatRate('BitPay', [{
          code: 'USD',
          value: value,
        }, {
          code: 'EUR',
          value: value,
        }], next);
      }, function(err) {
        should.not.exist(err);
        service.getRate('USD', {
          ts: [50, 100, 500],
        }, function(err, res) {
          should.not.exist(err);
          res.length.should.equal(3);

          res[0].ts.should.equal(50);
          should.not.exist(res[0].rate);
          res[1].ts.should.equal(100);
          res[1].rate.should.equal(1.00);
          res[2].ts.should.equal(500);
          res[2].rate.should.equal(4.00);
          clock.restore();
          done();
        });
      });
    });
  });
});
