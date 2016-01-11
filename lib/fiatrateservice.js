'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var request = require('request');

var Utils = require('./common/utils');
var Storage = require('./storage');

var Model = require('./model');


var DEFAULT_PROVIDER = 'BitPay';
var FETCH_INTERVAL = 15; // In minutes

function FiatRateService() {};

FiatRateService.prototype.start = function(opts, cb) {
  var self = this;

  opts = opts || {};

  if (_.isArray(opts.providers)) {
    self.providers = opts.providers;
  } else {
    self.providers = require('./fiatrateproviders');
  }
  self.request = opts.request || request;
  self.defaultProvider = opts.defaultProvider || DEFAULT_PROVIDER;

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
      return cb(err);
    }

    var interval = opts.fetchInterval || FETCH_INTERVAL;
    if (interval) {
      self._fetch();
      setInterval(function() {
        self._fetch();
      }, interval * 60 * 1000);
    }

    return cb();
  });
};

FiatRateService.prototype._fetch = function(cb) {
  var self = this;

  cb = cb || function() {};

  async.each(_.values(self.providers), function(provider, next) {
    self._retrieve(provider, function(err, res) {
      if (err) {
        log.warn(err);
        return next();
      }
      self.storage.storeFiatRate(provider.name, res, function(err) {
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
      log.warn('Error fetching data for ' + provider.name, err);
      return cb(err);
    }

    log.debug('Data for ' + provider.name + ' fetched successfully');

    if (!provider.parseFn) {
      return cb('No parse function for provider ' + provider.name);
    }
    var rates = provider.parseFn(body);

    return cb(null, rates);
  });
};


FiatRateService.prototype.getRate = function(code, opts, cb) {
  var self = this;

  $.shouldBeFunction(cb);

  opts = opts || {};

  var provider = opts.provider || DEFAULT_PROVIDER;
  var ts = opts.ts || Date.now();

  async.map([].concat(ts), function(ts, cb) {
    self.storage.fetchFiatRate(provider, code, ts, function(err, rate) {
      if (err) return cb(err);
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
