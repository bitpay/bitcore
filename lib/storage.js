'use strict';

var _ = require('lodash');
var levelup = require('levelup');
var $ = require('preconditions').singleton();
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;

var Wallet = require('./model/wallet');
var Copayer = require('./model/copayer');
var Address = require('./model/address');
var TxProposal = require('./model/txproposal');

var Storage = function (opts) {
  opts = opts || {};
  this.db = opts.db || levelup(opts.dbPath || './db/copay.db', { valueEncoding: 'json' });
};


Storage.prototype.fetchWallet = function (id, cb) {
  this.db.get('wallet-' + id, function (err, data) {
    if (err) {
      if (err.notFound) return cb();
      return cb(err);
    }
    return cb(null, Wallet.fromObj(data));
  });
};

Storage.prototype.storeWallet = function (wallet, cb) {
  this.db.put('wallet-' + wallet.id, wallet, cb);
};

Storage.prototype.fetchTx = function (walletId, txProposalId, cb) {
  this.db.get('wallet-' + walletId + '-txp-' + txProposalId, function (err, data) {
    if (err) {
      if (err.notFound) return cb();
      return cb(err);
    }
    return cb(null, TxProposal.fromObj(data));
  });
};

Storage.prototype.fetchTxs = function (walletId, cb) {
  var txs = [];
  var key = 'wallet-' + walletId + '-txp-';
  this.db.createReadStream({ gte: key, lt: key + '~' })
    .on('data', function (data) {
      txs.push(TxProposal.fromObj(data.value));
    })
    .on('error', function (err) {
      if (err.notFound) return cb();
      return cb(err);
    })
    .on('end', function () {
      return cb(null, txs);
    });
};

Storage.prototype.storeTx = function (walletId, txp, cb) {
  this.db.put('wallet-' + walletId + '-txp-' + txp.id, txp, cb);
};

Storage.prototype.fetchAddresses = function (walletId, cb) {
  var addresses = [];
  var key = 'wallet-' + walletId + '-address-';
  this.db.createReadStream({ gte: key, lt: key + '~' })
    .on('data', function (data) {
      addresses.push(Address.fromObj(data.value));
    })
    .on('error', function (err) {
      if (err.notFound) return cb();
      return cb(err);
    })
    .on('end', function () {
      return cb(null, addresses);
    });
};

Storage.prototype.storeAddress = function (walletId, address, cb) {
  this.db.put('wallet-' + walletId + '-address-' + address.address, address, cb);
};

Storage.prototype.removeAddress = function (walletId, address, cb) {
  this.db.del('wallet-' + walletId + '-address-' + address.address, cb);
};


Storage.prototype._dump = function (cb) {
  this.db.readStream()
    .on('data', console.log)
    .on('end', function () { if (cb) return cb(); });
};

module.exports = Storage;
