#!/usr/bin/env node

'use strict';

var _ = require('lodash');
var mongodb = require('mongodb');
var moment = require('moment');
var async = require('async');
var config = require('../config');

var otherDate;

//trying to parse optional parameter to get stats on any given date
try {
  otherDate = process.argv[2] && moment(process.argv[2]).isValid() ? moment(process.argv[2]) : null;
} catch (e) {
  console.log('Enter the date in the format YYYY-MM-DD.');
}

var c = config.storageOpts.mongoDb;
var url = 'mongodb://' + (c.host || 'localhost') + ':' + (c.port ||  27017) + '/bws';

var Today = otherDate || moment();

var stats = {
  'livenet': {
    totalTx: 0,
    totalAmount: 0,
    totalNewWallets: 0
  },
  'testnet': {
    totalTx: 0,
    totalAmount: 0,
    totalNewWallets: 0
  }
}

var wallets = {};

var bwsStats = {};

bwsStats.IsToday = function(date) {
  if (!date) return false;
  var date = moment(date * 1000);
  return (date >= Today.startOf('day') && date <= Today.endOf('day'));
}

bwsStats.TotalTxpForToday = function(data) {
  if (!data) return;

  if (!bwsStats.IsToday(data.createdOn)) return;

  var network = wallets[data.walletId];
  stats[network].totalTx++;
  stats[network].totalAmount += data.amount;
};


bwsStats.AddingWalletToCache = function(data) {
  if (!data) return;
  wallets[data.id] = data.network;
};

bwsStats.TotalNewWalletForToday = function(data) {
  if (!data) return;

  if (!bwsStats.IsToday(data.createdOn)) return;
  stats[data.network].totalNewWallets++;

};

bwsStats.PrintStats = function() {
  console.log('Stats for date : ', Today.format("YYYY-MM-DD"));
  console.log(' ');

  for (var s in stats) {
    console.log(' ');
    console.log(s + ' stats--------------------------------- ')
    console.log('New wallets : ', stats[s].totalNewWallets);
    console.log('Total tx  : ', stats[s].totalTx);
    console.log('Total amount in tx (BTC) : ', stats[s].totalAmount * 1 / 1e8);
  }
};

bwsStats.ProcessData = function(DB, cb) {
  bwsStats.ProccesWallets(DB, function() {
    bwsStats.ProccesTxs(DB, cb);
  });
};

bwsStats.ProccesWallets = function(DB, cb) {
  var collection = DB.collection('wallets');

  collection.find({}).toArray(function(err, items) {
    for (var i = 0; i < items.length; i++) {
      bwsStats.AddingWalletToCache(items[i]);
      bwsStats.TotalNewWalletForToday(items[i]);
    };
    cb();
  });
};

bwsStats.ProccesTxs = function(DB, cb) {
  var collection = DB.collection('txs');

  collection.find({}).toArray(function(err, items) {
    for (var i = 0; i < items.length; i++) {
      bwsStats.TotalTxpForToday(items[i]);
    };
    cb();
  });
};

bwsStats.getStats = function(cb) {
  mongodb.MongoClient.connect(url, function(err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
      return;
    }
    console.log('Connection established to ', url);
    bwsStats.ProcessData(db, function(err) {
      db.close();
      if (err) {
        cb(err, null);
        return;
      }
      cb(null, stats)
    });
  });
}

module.exports = bwsStats;
