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

    it('should get historical rates from ts to now', function(done) {
      const coins = ['btc', 'bch', 'eth', 'xrp'];
      var clock = sinon.useFakeTimers({toFake: ['Date']});
      async.each([1.00, 2.00, 3.00, 4.00], function(value, next) {
        clock.tick(100);
        async.map(
          coins,
          (coin, cb) => {
            service.storage.storeFiatRate(coin, [{
              code: 'USD',
              value: value,
            }, {
              code: 'EUR',
              value: value,
            }], cb)
          },
          () => {
            return next();
          }
        );
      }, function(err) {
        should.not.exist(err);
        service.getHistoricalRates({
          code: 'USD',
          ts: 100,
        }, function(err, res) {
          should.not.exist(err);
          should.exist(res);

          for (const coin of coins) {
            res[coin].length.should.equal(4);

            res[coin][3].ts.should.equal(100);
            res[coin][3].rate.should.equal(1.00);
  
            res[coin][2].ts.should.equal(200);
            res[coin][2].rate.should.equal(2.00);
  
            res[coin][1].ts.should.equal(300);
            res[coin][1].rate.should.equal(3.00);
  
            res[coin][0].ts.should.equal(400);
            res[coin][0].rate.should.equal(4.00);
          }
          clock.restore();
          done();
        });
      });
    });

    it('should not throw if missing historical rates for a coin', function(done) {
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
        service.getHistoricalRates({
          code: 'USD',
          ts: 100,
        }, function(err, res) {
          should.not.exist(err);
          should.exist(res);
          res['btc'].length.should.equal(4);
          should.not.exist(res['bch']);
          should.not.exist(res['eth']);
          should.not.exist(res['xrp']);

          res['btc'][3].ts.should.equal(100);
          res['btc'][3].rate.should.equal(1.00);

          res['btc'][2].ts.should.equal(200);
          res['btc'][2].rate.should.equal(2.00);

          res['btc'][1].ts.should.equal(300);
          res['btc'][1].rate.should.equal(3.00);

          res['btc'][0].ts.should.equal(400);
          res['btc'][0].rate.should.equal(4.00);
          clock.restore();
          done();
        });
      });
    });

    it('should return current rates if missing opts.ts when fetching historical rates', function(done) {
      const coins = ['btc', 'bch', 'eth', 'xrp'];
      var clock = sinon.useFakeTimers({toFake: ['Date']});
      async.each([1.00, 2.00, 3.00, 4.00], function(value, next) {
        clock.tick(11 * 60 * 1000);
        async.map(
          coins,
          (coin, cb) => {
            service.storage.storeFiatRate(coin, [{
              code: 'USD',
              value: value,
            }, {
              code: 'EUR',
              value: value,
            }], cb)
          },
          () => {
            return next();
          }
        );
      }, function(err) {
        should.not.exist(err);
        service.getHistoricalRates({
          code: 'USD'
        }, function(err, res) {
          should.not.exist(err);
          for (const coin of coins) {
            res[coin].length.should.equal(1);
            res[coin][0].ts.should.equal(2640000);
            res[coin][0].rate.should.equal(4.00);
          }
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
      var xrp = [{
        code: 'USD',
        rate: 0.222222,
      }, {
        code: 'EUR',
        rate: 0.211111,
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
      request.get.withArgs({
        url: 'https://bitpay.com/api/rates/XRP',
        json: true
      }).yields(null, null, xrp);

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
              res.rate.should.equal(121);
              service.getRate({
                code: 'USD',
                coin: 'xrp',
              }, function(err, res) {
                should.not.exist(err);
                res.fetchedOn.should.equal(100);
                res.rate.should.equal(0.222222);
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

  describe('#getRates', function() {
    const bchRates = [
      { code: "USD", value: 268.94 },
      { code: "INR", value: 19680.35 },
      { code: "EUR", value: 226.37 },
      { code: "CAD", value: 352.33 },
      { code: "COP", value: 1026617.26 },
      { code: "NGN", value: 104201.93 },
      { code: "GBP", value: 201.62 },
      { code: "ARS", value: 19900.21 },
      { code: "AUD", value: 365.8 },
      { code: "BRL", value: 1456.93 },
      { code: "JPY", value: 1124900.43 },
      { code: "NZD", value: 16119.66 }
    ]
    it('should get rates for all the supported fiat currencies of the specified coin', function(done) {
      service.storage.storeFiatRate('bch', bchRates, function(err) {
        should.not.exist(err);
        service.getRates({
          coin: 'bch'
        }, function(err, res) {
          should.not.exist(err);
          res.length.should.equal(bchRates.length);
          done();
        });
      });
    });
    it('should get rate for the specified coin and currency if they are supported', function(done) {
      service.storage.storeFiatRate('bch', bchRates, function(err) {
        should.not.exist(err);
        service.getRates({
          coin: 'bch',
          code: 'EUR'
        }, function(err, res) {
          should.not.exist(err);
          res[0].rate.should.equal(226.37);
          done();
        });
      });
    });
    it('should throw error if the specified currency code is not supported', function(done) {
      service.storage.storeFiatRate('bch', bchRates, function(err) {
        should.not.exist(err);
        service.getRates({
          coin: 'bch',
          code: 'AOA'
        }, function(err) {
          should.exist(err);
          err.should.equal('AOA is not supported');
          done();
        });
      });
    });
    it('should get rate for specific ts', function(done) {
      var clock = sinon.useFakeTimers({ toFake: ['Date'] });
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
          service.getRates({
            coin: 'btc',
            code: 'USD',
            ts: 50,
          }, function(err, res) {
            should.not.exist(err);
            res[0].ts.should.equal(50);
            res[0].rate.should.equal(123.45);
            res[0].fetchedOn.should.equal(20);
            clock.restore();
            done();
          });
        });
      });
    });
  });
});
