#!/usr/bin/env node

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
var TotalTxLivenet = 0;
var TotalAmountLivenet = 0;
var TotalNewWalletsLivenet = 0;

var TotalTxTestnet = 0;
var TotalAmountTestnet = 0;
var TotalNewWalletsTestnet = 0;

var wallets = {};


var IsToday = function(date) {
  if (!date) return false;
  var date = moment(date * 1000);
  return (date >= Today.startOf('day') && date <= Today.endOf('day'));
}

var TotalTxpForToday = function(data) {
  if (!data) return;

  if (!wallets[data.walletId]) {
    console.log('Walletid not found! ', data.walletId);
    return;
  }

  if (!IsToday(data.createdOn)) return;

  if (wallets[data.walletId] == 'livenet') {
    TotalTxLivenet++;
    TotalAmountLivenet = TotalAmountLivenet + data.amount;
  } else if (wallets[data.walletId] == 'testnet') {
    TotalTxTestnet++;
    TotalAmountTestnet = TotalAmountTestnet + data.amount;
  } else {
    console.log('Invalid network ', wallets[data.walletId]);
  }
};

var TotalNewWalletForToday = function(data) {
  if (!data) return;

  if (!wallets[data.id]) {
    wallets[data.id] = data.network;
  }
  if (!IsToday(data.createdOn)) return;

  if (data.network == 'livenet') {
    TotalNewWalletsLivenet++;
  } else if (data.network == 'testnet') {
    TotalNewWalletsTestnet++;
  } else {
    console.log('Invalid data ', data);
    console.log('Invalid network ', data.network);
  }
};

var PrintStats = function() {
  console.log('Stats for date : ', Today.format("YYYY-MM-DD"));
  console.log(' ');
  console.log('Livenet stats--------------------------------- ')
  console.log('New wallets : ', TotalNewWalletsLivenet);
  console.log('Total tx  : ', TotalTxLivenet);
  console.log('Total amount in tx (BTC) : ', TotalAmountLivenet * 1 / 1e8);
  console.log(' ');
  console.log('Testnet stats--------------------------------- ')
  console.log('New wallets : ', TotalNewWalletsTestnet);
  console.log('Total tx  : ', TotalTxTestnet);
  console.log('Total amount in tx (BTC) : ', TotalAmountTestnet * 1 / 1e8);
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
    process.exit(code = 1);
  }
  console.log('Connection established to ', url);
  ProcessData(db, function(err) {
    if (err) {
      console.log('error ', err);
      process.exit(code = 1);
    }
    PrintStats();
    db.close();
    process.exit(code = 0);
  });
});
