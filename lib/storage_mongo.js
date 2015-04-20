'use strict';

var _ = require('lodash');
var async = require('async');
var $ = require('preconditions').singleton();
var log = require('npmlog');
log.debug = log.verbose;
log.disableColor();
var util = require('util');

var mongodb = require('mongodb');

var Model = require('./model');

var Storage = function(opts) {
  opts = opts || {};
  this.db = opts.db;

  if (!this.db) {
    var url = 'mongodb://localhost:27017/bws';
    mongodb.MongoClient.connect(url, function(err, db) {
      if (err) {
        log.error('Unable to connect to the mongoDB server. Error:', err);
        return;
      }
      this.db = db;
      console.log('Connection established to ', url);
    });
  }
};

Storage.prototype.fetchWallet = function(id, cb) {
  this.db.collection('wallets').findOne({
    id: id
  }, function(err, result) {
    if (err) return cb(err);
    if (!result) return cb();
    return cb(null, Model.Wallet.fromObj(result));
  });
};

Storage.prototype.storeWallet = function(wallet, cb) {
  this.db.collection('wallets').update({
    id: wallet.id
  }, wallet, {
    w: 1,
    upsert: true,
  }, cb);
};

Storage.prototype.storeWalletAndUpdateCopayersLookup = function(wallet, cb) {
  return this.storeWallet(wallet, cb);
};

Storage.prototype.fetchCopayerLookup = function(copayerId, cb) {
  this.db.collection('wallets').findOne({
    'copayers.id': copayerId
  }, {
    fields: {
      id: 1,
      copayers: 1,
    },
  }, function(err, result) {
    if (err) return cb(err);
    if (!result) return cb();
    var copayer = _.find(result.copayers, {
      id: copayerId
    });
    return cb(null, {
      walletId: result.id,
      requestPubKey: copayer.requestPubKey,
    });
  });
};

// TODO: should be done client-side
Storage.prototype._completeTxData = function(walletId, txs, cb) {
  var txList = [].concat(txs);
  this.fetchWallet(walletId, function(err, wallet) {
    if (err) return cb(err);
    _.each(txList, function(tx) {
      tx.creatorName = wallet.getCopayer(tx.creatorId).name;
      _.each(tx.actions, function(action) {
        action.copayerName = wallet.getCopayer(action.copayerId).name;
      });
    });
    return cb(null, txs);
  });
};

Storage.prototype.fetchTx = function(walletId, txProposalId, cb) {
  var self = this;

  this.db.collection('txs').findOne({
    id: txProposalId,
    walletId: walletId
  }, function(err, result) {
    if (err) return cb(err);
    if (!result) return cb();
    return self._completeTxData(walletId, Model.TxProposal.fromObj(result), cb);
  });
};


Storage.prototype.fetchPendingTxs = function(walletId, cb) {
  var self = this;

  this.db.collection('txs').find({
    walletId: walletId,
    isPending: true
  }).sort({
    createdOn: 1
  }).toArray(function(err, result) {
    if (err) return cb(err);
    if (!result) return cb();
    var txs = _.map(result, function(tx) {
      return Model.TxProposal.fromObj(tx);
    });
    return self._completeTxData(walletId, txs, cb);
  });
};

/**
 * fetchTxs. Times are in UNIX EPOCH (seconds)
 *
 * @param walletId
 * @param opts.minTs
 * @param opts.maxTs
 * @param opts.limit
 */
Storage.prototype.fetchTxs = function(walletId, opts, cb) {
  var self = this;

  opts = opts || {};

  var tsFilter = {};
  if (_.isNumber(opts.minTs)) tsFilter.$gte = opts.minTs;
  if (_.isNumber(opts.maxTs)) tsFilter.$lte = opts.maxTs;

  var filter = {
    walletId: walletId
  };
  if (!_.isEmpty(tsFilter)) filter.createdOn = tsFilter;

  var mods = {};
  if (_.isNumber(opts.limit)) mods.limit = opts.limit;

  this.db.collection('txs').find(filter, mods).sort({
    createdOn: 1
  }).toArray(function(err, result) {
    if (err) return cb(err);
    if (!result) return cb();
    var txs = _.map(result, function(tx) {
      return Model.TxProposal.fromObj(tx);
    });
    return self._completeTxData(walletId, txs, cb);
  });
};


/**
 * fetchNotifications
 *
 * @param walletId
 * @param opts.minTs
 * @param opts.maxTs
 * @param opts.limit
 */
Storage.prototype.fetchNotifications = function(walletId, opts, cb) {
  var self = this;

  opts = opts || {};

  var tsFilter = {};
  if (_.isNumber(opts.minTs)) tsFilter.$gte = opts.minTs;
  if (_.isNumber(opts.maxTs)) tsFilter.$lte = opts.maxTs;

  var filter = {
    walletId: walletId
  };
  if (!_.isEmpty(tsFilter)) filter.createdOn = tsFilter;

  var mods = {};
  if (_.isNumber(opts.limit)) mods.limit = opts.limit;

  this.db.collection('notifications').find(filter, mods).sort({
    createdOn: 1
  }).toArray(function(err, result) {
    if (err) return cb(err);
    if (!result) return cb();
    var notifications = _.map(result, function(notification) {
      return Model.Notification.fromObj(notification);
    });
    return cb(null, notifications);
  });
};


// TODO: remove walletId from signature
Storage.prototype.storeNotification = function(walletId, notification, cb) {
  this.db.collection('notifications').insert(notification, {
    w: 1
  }, cb);
};

// TODO: remove walletId from signature
Storage.prototype.storeTx = function(walletId, txp, cb) {
  txp.isPending = txp.isPending(); // Persist attribute to use when querying
  this.db.collection('txs').update({
    id: txp.id,
    walletId: walletId
  }, txp, {
    w: 1,
    upsert: true,
  }, cb);
};

Storage.prototype.removeTx = function(walletId, txProposalId, cb) {
  this.db.collection('txs').findAndRemove({
    id: txProposalId,
    walletId: walletId
  }, {
    w: 1
  }, cb);
};

Storage.prototype.removeWallet = function(walletId, cb) {
  var self = this;

  async.parallel([

    function(next) {
      this.db.collections('wallets').findAndRemove({
        id: walletId
      }, next);
    },
    function(next) {
      this.db.collections('addresses').findAndRemove({
        walletId: walletId
      }, next);
    },
    function(next) {
      this.db.collections('txs').findAndRemove({
        walletId: walletId
      }, next);
    },
    function(next) {
      this.db.collections('notifications').findAndRemove({
        walletId: walletId
      }, next);
    },
  ], cb);
};


Storage.prototype.fetchAddresses = function(walletId, cb) {
  var self = this;

  this.db.collection('addresses').find({
    walletId: walletId,
  }).sort({
    createdOn: 1
  }).toArray(function(err, result) {
    if (err) return cb(err);
    if (!result) return cb();
    var addresses = _.map(result, function(address) {
      return Model.Address.fromObj(address);
    });
    return cb(null, addresses);
  });
};

Storage.prototype.storeAddressAndWallet = function(wallet, addresses, cb) {
  var self = this;
  this.db.collection('addresses').insert([].concat(addresses), {
    w: 1
  }, function(err) {
    if (err) return cb(err);
    self.storeWallet(wallet, cb);
  });
};

Storage.prototype._dump = function(cb, fn) {
  fn = fn || console.log;

  var self = this;
  this.db.collections(function(err, collections) {
    if (err) return cb(err);
    async.eachSeries(collections, function(col, next) {
      fn('--------' + col);
      col.find().toArray(function(err, item) {
        fn(item);
        next(err);
      });
    }, cb);
  });
};

module.exports = Storage;
