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

describe('Fiat rate service', function() {
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
  describe.only('#getRate', function() {
    it('should get current rate', function(done) {
      service.storage.storeFiatRate('BitPay', [{
        code: 'USD',
        value: 123.45,
      }], function(err) {
        should.not.exist(err);
        service.getRate('USD', {}, function(err, res) {
          should.not.exist(err);
          res.rate.value.should.equal(123.45);
          done();
        });
      });
    });
  });
});
