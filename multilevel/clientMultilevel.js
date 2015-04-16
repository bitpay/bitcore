#!/usr/bin/env node

var multilevel = require('multilevel');
var net = require('net');
var moment = require('moment');

var PORT = 3230;

var otherDate;

//trying to parse optional parameter to get stats on any given date
try {
  otherDate = process.argv[2] && moment(process.argv[2]).isValid() ? moment(process.argv[2]) : null;
} catch (e) {
  console.log('Enter the date in the format YYYY-MM-DD.');
}

var db = multilevel.client();
var con = net.connect(PORT);
con.pipe(db.createRpcStream()).pipe(con);


var Today = otherDate || moment();
var TotalTx = 0;
var TotalAmount = 0;
var TotalNewWallets = 0;

var IsToday = function(date) {
  if (!date) return false;
  var date = moment(date * 1000);
  return (date >= Today.startOf('day') && date <= Today.endOf('day'));
}

var TotalTxpForToday = function(data) {
  if (!data) return;
  if (data.key.indexOf('!txp!') < 0) return;
  if (!data.value || !IsToday(data.value.createdOn)) return;
  TotalTx++;
  TotalAmount = TotalAmount + data.value.amount;
};

var TotalNewWalletForToday = function(data) {
  if (!data) return;
  if (data.key.indexOf('!main') < 0) return;
  if (!data.value || !IsToday(data.value.createdOn)) return;
  TotalNewWallets++;
};

var PrintStats = function() {
  console.log('Stats for date : ', Today.format("YYYY-MM-DD"));
  console.log('New wallets : ', TotalNewWallets);
  console.log('Total tx  : ', TotalTx);
  console.log('Total amount in tx (satoshis) : ', TotalAmount);
};

var ProcessData = function(data) {
  TotalTxpForToday(data);
  TotalNewWalletForToday(data);
};

// streams 
db.createReadStream().on('data', function(data) {
  ProcessData(data);
}).on('error', function(err) {
  console.log('Error : ', err);
  process.exit(code = 1);
}).on('close', function() {
  PrintStats();
  process.exit(code = 0);
});
