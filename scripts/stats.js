#!/usr/bin/env node

'use strict';

var _ = require('lodash');
var mongodb = require('mongodb');
var moment = require('moment');
var async = require('async');
var config = require('../config');


var c = config.storageOpts.mongoDb;
var url = 'mongodb://' + (c.host || 'localhost') + ':' + (c.port ||  27017) + '/bws';

var startDate = moment();
var endDate = moment();

var stats = {};

var wallets = {};

var bwsStats = {};

bwsStats.cleanUp = function() {
  stats = {
    'livenet': {},
    'testnet': {}
  };
}


bwsStats.AddingWalletToCache = function(data) {
  if (!data) return;
  wallets[data.id] = data.network;
};

bwsStats.TotalNewWalletForToday = function(data) {
  if (!data) return;
  var day = moment(data.createdOn * 1000).format('YYYYMMDD');
  if (!stats[data.network][day]) {
    stats[data.network][day] = {
      totalTx: 0,
      totalAmount: 0,
      totalNewWallets: 0
    };
  }
  stats[data.network][day].totalNewWallets++;
};

bwsStats.TotalTxpForToday = function(data) {
  if (!data) return;
  var day = moment(data.createdOn * 1000).format('YYYYMMDD');
  var network = wallets[data.walletId];
  if (!stats[network][day]) {
    stats[network][day] = {
      totalTx: 0,
      totalAmount: 0,
      totalNewWallets: 0
    };
  }
  stats[network][day].totalTx++;
  stats[network][day].totalAmount += data.amount;
};


bwsStats.ProcessData = function(DB, cb) {
  bwsStats.ProccesWallets(DB, function() {
    bwsStats.ProccesNewWallets(DB, function() {
      bwsStats.ProccesTxs(DB, cb);
    });
  });
};


bwsStats.ProccesWallets = function(DB, cb) {
  var collection = DB.collection('wallets');
  collection.find({}).toArray(function(err, items) {
    if (err) {
      console.log('Error.', err);
    }

    items.forEach(function(it) {
      bwsStats.AddingWalletToCache(it);
    });
    cb();
  });
};

bwsStats.ProccesNewWallets = function(DB, cb) {
  var collection = DB.collection('wallets');
  var start = Math.floor(startDate.startOf('day').valueOf() / 1000);
  var end = Math.floor(endDate.endOf('day').valueOf() / 1000);

  collection.find({
    createdOn: {
      $gt: start,
      $lt: end
    }
  }).toArray(function(err, items) {
    if (err) {
      console.log('Error.', err);
    }
    items.forEach(function(it) {
      bwsStats.TotalNewWalletForToday(it);
    });
    cb();
  });
};

bwsStats.ProccesTxs = function(DB, cb) {
  var collection = DB.collection('txs');
  var start = Math.floor(startDate.startOf('day').valueOf() / 1000);
  var end = Math.floor(endDate.endOf('day').valueOf() / 1000);

  collection.find({
      createdOn: {
        $gt: start,
        $lt: end
      }
    },
    function(err, items) {
      if (err || !items) {
        console.log("No items found.");
      } else {
        items.forEach(function(it) {
          bwsStats.TotalTxpForToday(it);
        });
      }
      cb();
    });
};

bwsStats.getStats = function(opts, cb) {
  if (opts) {
    startDate = moment(opts.from);
    endDate = moment(opts.to);
  }
  bwsStats.cleanUp();

  mongodb.MongoClient.connect(url, function(err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
      return;
    }
    console.log('Connection established to ', url);
    bwsStats.ProcessData(db, function(err) {
      if (err) {
        console.log('Error.', err);
        cb(err, null);
        return;
      }
      cb(null, stats);
    });
  });
}

module.exports = bwsStats;
