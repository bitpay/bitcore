#!/usr/bin/env node

'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
log.disableColor();
var mongodb = require('mongodb');
var moment = require('moment');

var config = require('../config');
var storage = require('./storage');

function Stats(opts) {
  opts = opts || {};

  this.network = opts.network || 'livenet';
  this.from = moment(opts.from || '2015-01-01');
  this.to = moment(opts.to);
  this.fromTs = Math.floor(this.from.startOf('day').valueOf() / 1000);
  this.toTs = Math.floor(this.to.endOf('day').valueOf() / 1000);
};

Stats.prototype.run = function(cb) {
  var self = this;

  var uri = config.storageOpts.mongoDb.uri;
  mongodb.MongoClient.connect(uri, function(err, db) {
    if (err) {
      log.error('Unable to connect to the mongoDB', err);
      return cb(err, null);
    }
    log.info('Connection established to ' + uri);
    self.db = db;
    self._getStats(function(err, stats) {
      if (err) return cb(err);
      return cb(null, stats);
    });
  });
};

Stats.prototype._getStats = function(cb) {
  var self = this;
  var result = {};
  async.parallel([

    function(next) {
      self._getNewWallets(next);
    },
    function(next) {
      self._getTxProposals(next);
    },
  ], function(err, results) {
    if (err) return cb(err);

    result.newWallets = results[0];
    return cb(null, result);
  });
};

Stats.prototype._countBy = function(data, key) {
  return _.map(_.groupBy(data, key), function(v, k) {
    var item = {};
    item[key] = k;
    item['count'] = v.length;
    return item;
  });
};

Stats.prototype._sumBy = function(data, key, attr) {
  return _.map(_.groupBy(data, key), function(v, k) {
    var item = {};
    item[key] = k;
    item[attr] = _.reduce(v, function(memo, x) {
      return memo + x[attr];
    }, 0);
    return item;
  });
};

Stats.prototype._getNewWallets = function(cb) {
  var self = this;

  self.db.collection(storage.collections.WALLETS)
    .find({
      network: self.network,
      createdOn: {
        $gte: self.fromTs,
        $lte: self.toTs,
      },
    })
    .toArray(function(err, wallets) {
      if (err) return cb(err);

      var data = _.map(wallets, function(wallet) {
        return {
          day: moment(wallet.createdOn * 1000).format('YYYYMMDD'),
          type: wallet.m + '-of-' + wallet.n,
        };
      });

      var stats = {
        byDay: self._countBy(data, 'day'),
        byType: self._countBy(data, 'type'),
      };

      return cb(null, stats);
    });
};

Stats.prototype._getTxProposals = function(cb) {
  var self = this;

  self.db.collection(storage.collections.TXS)
    .find({
      network: self.network,
      status: 'broadcasted',
      createdOn: {
        $gte: self.fromTs,
        $lte: self.toTs,
      },
    })
    .toArray(function(err, txps) {
      if (err) return cb(err);

      var data = _.map(txps, function(txp) {
        return {
          day: moment(txp.createdOn * 1000).format('YYYYMMDD'),
          amount: txp.amount,
        };
      });

      var stats = {
        nbByDay: self._countBy(data, 'day'),
        amountByDay: self._sumBy(data, 'day', 'amount'),
      };

      return cb(null, stats);
    });
};

module.exports = Stats;
