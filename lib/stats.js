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


var INITIAL_DATE = '2015-01-01';

function Stats(opts) {
  opts = opts || {};

  this.network = opts.network || 'livenet';
  this.from = moment(opts.from || INITIAL_DATE);
  this.to = moment(opts.to);
  this.fromTs = this.from.startOf('day').valueOf();
  this.toTs = this.to.endOf('day').valueOf();
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
    result.txProposals = results[1];
    return cb(null, result);
  });
};

Stats.prototype._getNewWallets = function(cb) {
  var self = this;

  function getLastDate(cb) {
    self.db.collection('stats_wallets')
      .find({})
      .sort({
        '_id.day': -1
      })
      .limit(1)
      .toArray(function(err, lastRecord) {
        if (_.isEmpty(lastRecord)) return cb(null, moment(INITIAL_DATE));
        return cb(null, moment(lastRecord[0]._id.day));
      });
  };

  function updateStats(from, cb) {
    var to = moment().subtract(1, 'day').endOf('day');
    var map = function() {
      var day = new Date(this.createdOn * 1000);
      day.setHours(0);
      day.setMinutes(0);
      day.setSeconds(0);
      var key = {
        day: +day,
        network: this.network,
      };
      var value = {
        count: 1
      };
      emit(key, value);
    };
    var reduce = function(k, v) {
      var count = 0;
      for (var i = 0; i < v.length; i++) {
        count += v[i].count;
      }
      return {
        count: count,
      };
    };
    var opts = {
      query: {
        createdOn: {
          $gt: from.unix(),
          $lte: to.unix(),
        },
      },
      out: {
        merge: 'stats_wallets',
      }
    };
    self.db.collection(storage.collections.WALLETS)
      .mapReduce(map, reduce, opts, function(err, collection, stats) {
        return cb(err);
      });
  };

  function queryStats(cb) {
    self.db.collection('stats_wallets')
      .find({
        '_id.network': self.network,
        '_id.day': {
          $gte: self.fromTs,
          $lte: self.toTs,
        },
      })
      .sort({
        '_id.day': 1
      })
      .toArray(function(err, results) {
        if (err) return cb(err);
        var stats = {};
        stats.byDay = _.map(results, function(record) {
          var day = moment(record._id.day).format('YYYYMMDD');
          return {
            day: day,
            count: record.value.count,
          };
        });
        return cb(null, stats);
      });
  };

  async.series([

      function(next) {
        getLastDate(function(err, lastDate) {
          if (err) return next(err);

          lastDate = lastDate.startOf('day');
          var yesterday = moment().subtract(1, 'day').startOf('day');
          if (lastDate.isBefore(yesterday)) {
            // Needs update
            return updateStats(lastDate, next);
          }
          next();
        });
      },
      function(next) {
        queryStats(next);
      },
    ],
    function(err, res) {
      if (err) {
        log.error(err);
      }
      return cb(err, res[1]);
    });
};

Stats.prototype._getTxProposals = function(cb) {
  var self = this;

  function getLastDate(cb) {
    self.db.collection('stats_txps')
      .find({})
      .sort({
        '_id.day': -1
      })
      .limit(1)
      .toArray(function(err, lastRecord) {
        if (_.isEmpty(lastRecord)) return cb(null, moment(INITIAL_DATE));
        return cb(null, moment(lastRecord[0]._id.day));
      });
  };

  function updateStats(from, cb) {
    var to = moment().subtract(1, 'day').endOf('day');
    var map = function() {
      var day = new Date(this.broadcastedOn * 1000);
      day.setHours(0);
      day.setMinutes(0);
      day.setSeconds(0);
      var key = {
        day: +day,
        network: this.network,
      };
      var value = {
        count: 1,
        amount: this.amount
      };
      emit(key, value);
    };
    var reduce = function(k, v) {
      var count = 0,
        amount = 0;
      for (var i = 0; i < v.length; i++) {
        count += v[i].count;
        amount += v[i].amount;
      }
      return {
        count: count,
        amount: amount,
      };
    };
    var opts = {
      query: {
        status: 'broadcasted',
        broadcastedOn: {
          $gt: from.unix(),
          $lte: to.unix(),
        },
      },
      out: {
        merge: 'stats_txps',
      }
    };
    self.db.collection(storage.collections.TXS)
      .mapReduce(map, reduce, opts, function(err, collection, stats) {
        return cb(err);
      });
  };

  function queryStats(cb) {
    self.db.collection('stats_txps')
      .find({
        '_id.network': self.network,
        '_id.day': {
          $gte: self.fromTs,
          $lte: self.toTs,
        },
      })
      .sort({
        '_id.day': 1
      })
      .toArray(function(err, results) {
        if (err) return cb(err);

        var stats = {
          nbByDay: [],
          amountByDay: []
        };
        _.each(results, function(record) {
          var day = moment(record._id.day).format('YYYYMMDD');
          stats.nbByDay.push({
            day: day,
            count: record.value.count,
          });
          stats.amountByDay.push({
            day: day,
            amount: record.value.amount,
          });
        });
        return cb(null, stats);
      });
  };

  async.series([

      function(next) {
        getLastDate(function(err, lastDate) {
          if (err) return next(err);

          lastDate = lastDate.startOf('day');
          var yesterday = moment().subtract(1, 'day').startOf('day');
          if (lastDate.isBefore(yesterday)) {
            // Needs update
            return updateStats(lastDate, next);
          }
          next();
        });
      },
      function(next) {
        queryStats(next);
      },
    ],
    function(err, res) {
      if (err) {
        log.error(err);
      }
      return cb(err, res[1]);
    });
};

module.exports = Stats;
