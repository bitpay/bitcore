#!/usr/bin/env node

'use strict';

var _ = require('lodash');
var mongodb = require('mongodb');
var moment = require('moment');
var async = require('async');

var otherDate;

//trying to parse optional parameter to get stats on any given date
try {
  otherDate = process.argv[2] && moment(process.argv[2]).isValid() ? moment(process.argv[2]) : null;
} catch (e) {
  console.log('Enter the date in the format YYYY-MM-DD.');
}

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

var IsToday = function(date) {
  if (!date) return false;
  var date = moment(date * 1000);
  return (date >= Today.startOf('day') && date <= Today.endOf('day'));
}

var TotalTxpForToday = function(data) {
  if (!data) return;

  if (!IsToday(data.createdOn)) return;

  var network = wallets[data.walletId];
  stats[network].totalTx++;
  stats[network].totalAmount += data.amount;
};


var AddingWalletToCache = function(data) {
  if (!data) return;
  wallets[data.id] = data.network;
};

var TotalNewWalletForToday = function(data) {
  if (!data) return;

  if (!IsToday(data.createdOn)) return;
  stats[data.network].totalNewWallets++;

};

var PrintStats = function() {
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

var ProcessData = function(DB, cb) {
  ProccesWallets(DB, function() {
    ProccesTxs(DB, cb);
  });
};

var ProccesWallets = function(DB, cb) {
  var collection = DB.collection('wallets');

  collection.find({}).toArray(function(err, items) {
    for (var i = 0; i < items.length; i++) {
      AddingWalletToCache(items[i]);
      TotalNewWalletForToday(items[i]);
    };
    cb();
  });
};

var ProccesTxs = function(DB, cb) {
  var collection = DB.collection('txs');

  collection.find({}).toArray(function(err, items) {
    for (var i = 0; i < items.length; i++) {
      TotalTxpForToday(items[i]);
    };
    cb();
  });
};


var url = 'mongodb://localhost:27017/bws';
mongodb.MongoClient.connect(url, function(err, db) {
  if (err) {
    console.log('Unable to connect to the mongoDB server. Error:', err);
    process.exit(1);
  }
  console.log('Connection established to ', url);
  ProcessData(db, function(err) {
    if (err) {
      console.log('error ', err);
      process.exit(1);
    }
    PrintStats();
    db.close();
    process.exit(0);
  });
});
