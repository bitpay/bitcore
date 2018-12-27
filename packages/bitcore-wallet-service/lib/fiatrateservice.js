'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var request = require('request');

var Common = require('./common');
var Defaults = Common.Defaults;

var Storage = require('./storage');
var Model = require('./model');

function FiatRateService() {};

FiatRateService.prototype.init = function(opts, cb) {
  var self = this;

  opts = opts || {};

  self.request = opts.request || request;
  self.defaultProvider = opts.defaultProvider || Defaults.FIAT_RATE_PROVIDER;

  async.parallel([

    function(done) {
      if (opts.storage) {
        self.storage = opts.storage;
        done();
      } else {
        self.storage = new Storage();
        self.storage.connect(opts.storageOpts, done);
      }
    },
  ], function(err) {
    if (err) {
      log.error(err);
    }
    return cb(err);
  });
};

FiatRateService.prototype.startCron = function(opts, cb) {
  var self = this;

  opts = opts || {};

  self.providers = _.values(require('./fiatrateproviders'));

  var interval = opts.fetchInterval || Defaults.FIAT_RATE_FETCH_INTERVAL;
  if (interval) {
    self._fetch();
    setInterval(function() {
      self._fetch();
    }, interval * 60 * 1000);
  }

  return cb();
};

FiatRateService.prototype._fetch = function(cb) {
  var self = this;

  cb = cb || function() {};

  async.each(self.providers, function(provider, next) {
    self._retrieve(provider, function(err, res) {
      if (err) {
        log.warn('Error retrieving data for ' + provider.name, err);
        return next();
      }
      self.storage.storeFiatRate(provider.name, res, function(err) {
        if (err) {
          log.warn('Error storing data for ' + provider.name, err);
        }
        return next();
      });
    });
  }, cb);
};

FiatRateService.prototype._retrieve = function(provider, cb) {
  var self = this;

  log.debug('Fetching data for ' + provider.name);
  self.request.get({
    url: provider.url,
    json: true,
  }, function(err, res, body) {
    if (err || !body) {
      return cb(err);
    }

    log.debug('Data for ' + provider.name + ' fetched successfully');

    if (!provider.parseFn) {
      return cb(new Error('No parse function for provider ' + provider.name));
    }
    var rates = provider.parseFn(body);

    return cb(null, rates);
  });
};


FiatRateService.prototype.getRate = function(opts, cb) {
  var self = this;

  $.shouldBeFunction(cb);

  opts = opts || {};

  var now = Date.now();
  var provider = opts.provider || self.defaultProvider;
  var ts = (_.isNumber(opts.ts) || _.isArray(opts.ts)) ? opts.ts : now;

  async.map([].concat(ts), function(ts, cb) {
    self.storage.fetchFiatRate(provider, opts.code, ts, function(err, rate) {
      if (err) return cb(err);
      if (rate && (ts - rate.ts) > Defaults.FIAT_RATE_MAX_LOOK_BACK_TIME * 60 * 1000) rate = null;

      return cb(null, {
        ts: +ts,
        rate: rate ? rate.value : undefined,
        fetchedOn: rate ? rate.ts : undefined,
      });
    });
  }, function(err, res) {
    if (err) return cb(err);
    if (!_.isArray(ts)) res = res[0];
    return cb(null, res);
  });
};


module.exports = FiatRateService;
