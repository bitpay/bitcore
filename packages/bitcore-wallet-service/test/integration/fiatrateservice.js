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

var { FiatRateService } = require('../../ts_build/lib/fiatrateservice');

describe('Fiat rate service', function() {
  var service, request;

  before(function(done) {
    helpers.before((res) => {
      done();
    });
  });

  after(function(done) {
    helpers.after(done);
  });

  beforeEach(function(done) {
    helpers.beforeEach(function() {
      service = new FiatRateService();
      request = sinon.stub();
      request.get = sinon.stub();
      service.init({
        storage: helpers.getStorage(),
        request: request,
      }, function(err) {
        should.not.exist(err);
        service.startCron({}, done);
      });
    });
  });

  describe('#getRate', function() {
    it('should get current rate', function(done) {
      service.storage.storeFiatRate('bch', [{
        code: 'USD',
        value: 123.45,
      }], function(err) {
        should.not.exist(err);
        service.getRate({
          coin: 'bch',
          code: 'USD',
        }, function(err, res) {
          should.not.exist(err);
          res.rate.should.equal(123.45);
          done();
        });
      });
    });
    it('should get current rate for different currency', function(done) {
      service.storage.storeFiatRate('btc', [{
        code: 'USD',
        value: 123.45,
      }], function(err) {
        should.not.exist(err);
        service.storage.storeFiatRate('btc', [{
          code: 'EUR',
          value: 345.67,
        }], function(err) {
          should.not.exist(err);
          service.getRate({
            code: 'EUR'
          }, function(err, res) {
            should.not.exist(err);
            res.rate.should.equal(345.67);
            done();
          });
        });
      });
    });

    it('should get current rate for different coin', function(done) {
      service.storage.storeFiatRate('btc', [{
        code: 'USD',
        value: 100.00,
      }], function(err) {
        should.not.exist(err);
        service.storage.storeFiatRate('bch', [{
          code: 'USD',
          value: 200.00,
        }], function(err) {
          should.not.exist(err);
          service.getRate({
            code: 'USD',
          }, function(err, res) {
            should.not.exist(err);
            res.rate.should.equal(100.00, 'Should use default coin');
            service.getRate({
              code: 'USD',
              coin: 'bch',
            }, function(err, res) {
              should.not.exist(err);
              res.rate.should.equal(200.00);
              done();
            });
          });
        });
      });
    });

    it('should get rate for specific ts', function(done) {
      var clock = sinon.useFakeTimers({toFake: ['Date']});
      clock.tick(20);
      service.storage.storeFiatRate('btc', [{
        code: 'USD',
        value: 123.45,
      }], function(err) {
        should.not.exist(err);
        clock.tick(100);
        service.storage.storeFiatRate('btc', [{
          code: 'USD',
          value: 345.67,
        }], function(err) {
          should.not.exist(err);
          service.getRate({
            code: 'USD',
            ts: 50,
          }, function(err, res) {
            should.not.exist(err);
            res.ts.should.equal(50);
            res.rate.should.equal(123.45);
            res.fetchedOn.should.equal(20);
            clock.restore();
            done();
          });
        });
      });
    });

    it('should get rates for a series of ts', function(done) {
      var clock = sinon.useFakeTimers({toFake: ['Date']});
      async.each([1.00, 2.00, 3.00, 4.00], function(value, next) {
        clock.tick(100);
        service.storage.storeFiatRate('btc', [{
          code: 'USD',
          value: value,
        }, {
          code: 'EUR',
          value: value,
        }], next);
      }, function(err) {
        should.not.exist(err);
        service.getRate({
          code: 'USD',
          ts: [50, 100, 199, 500],
        }, function(err, res) {
          should.not.exist(err);
          res.length.should.equal(4);

          res[0].ts.should.equal(50);
          should.not.exist(res[0].rate);
          should.not.exist(res[0].fetchedOn);

          res[1].ts.should.equal(100);
          res[1].rate.should.equal(1.00);
          res[1].fetchedOn.should.equal(100);

          res[2].ts.should.equal(199);
          res[2].rate.should.equal(1.00);
          res[2].fetchedOn.should.equal(100);

          res[3].ts.should.equal(500);
          res[3].rate.should.equal(4.00);
          res[3].fetchedOn.should.equal(400);

          clock.restore();
          done();
        });
      });
    });

    it('should not get rate older than 2hs', function(done) {
      var clock = sinon.useFakeTimers({toFake: ['Date']});
      service.storage.storeFiatRate('btc', [{
        code: 'USD',
        value: 123.45,
      }], function(err) {
        should.not.exist(err);
        clock.tick(24 * 3600 * 1000); // Some time in the future
        service.getRate({
          ts: 2 * 3600 * 1000 - 1, // almost 2 hours
          code: 'USD',
        }, function(err, res) {
          should.not.exist(err);
          res.rate.should.equal(123.45);
          res.fetchedOn.should.equal(0);
          service.getRate({
            ts: 2 * 3600 * 1000 + 1, // just past 2 hours
            code: 'USD',
          }, function(err, res) {
            should.not.exist(err);
            should.not.exist(res.rate);
            clock.restore();
            done();
          });
        });
      });
    });

  });

  describe('#fetch', function() {
    it('should fetch rates from all coins', function(done) {
      var clock = sinon.useFakeTimers({now:100, toFake: ['Date']});
      var btc = [{
        code: 'USD',
        rate: 123.45,
      }, {
        code: 'EUR',
        rate: 234.56,
      }];
      var bch = [{
          code: 'USD',
          rate: 120,
      }, {
        code: 'EUR',
        rate: 120,
      }];
      var eth = [{
        code: 'USD',
        rate: 121,
      }, {
        code: 'EUR',
        rate: 121,
      }];

      request.get.withArgs({
        url: 'https://bitpay.com/api/rates/BTC',
        json: true
      }).yields(null, null, btc);
      request.get.withArgs({
        url: 'https://bitpay.com/api/rates/BCH',
        json: true
      }).yields(null, null, bch);
      request.get.withArgs({
        url: 'https://bitpay.com/api/rates/ETH',
        json: true
      }).yields(null, null, eth);

      service._fetch(function(err) {
        should.not.exist(err);
        service.getRate({
          code: 'USD'
        }, function(err, res) {
          should.not.exist(err);
          res.fetchedOn.should.equal(100);
          res.rate.should.equal(123.45);
          service.getRate({
            code: 'USD',
            coin: 'bch',
          }, function(err, res) {
            should.not.exist(err);
            res.fetchedOn.should.equal(100);
            res.rate.should.equal(120.00);
            service.getRate({
              code: 'USD',
              coin: 'eth',
            }, function(err, res) {
              should.not.exist(err);
              res.fetchedOn.should.equal(100);
              res.rate.should.equal(121.00);
              service.getRate({
                code: 'EUR'
              }, function(err, res) {
                should.not.exist(err);
                res.fetchedOn.should.equal(100);
                res.rate.should.equal(234.56);
                clock.restore();
                done();
              });
            });
          });
        });
      });
    });
  });
});
