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

var collections = {
  WALLETS: 'wallets',
  TXS: 'txs',
  ADDRESSES: 'addresses',
  NOTIFICATIONS: 'notifications',
};

var Storage = function(opts) {
  opts = opts || {};
  this.db = opts.db;
};

Storage.prototype.connect = function(opts, cb) {
  var self = this;

  opts = opts || {};

  if (this.db) return cb(null);

  var config = opts.mongoDb || {};
  var url = 'mongodb://' + (config.host || 'localhost') + ':' + (config.port ||  27017) + '/bws';
  mongodb.MongoClient.connect(url, function(err, db) {
    if (err) {
      log.error('Unable to connect to the mongoDB server.');
      return cb(err);
    }
    self.db = db;
    console.log('Connection established to ', url);
    return cb(null);
  });
};


Storage.prototype.disconnect = function(cb) {
  var self = this;
  this.db.close(true, function(err) {
    if (err) return cb(err);
    self.db = null;
    return cb();
  });
};

Storage.prototype.fetchWallet = function(id, cb) {
  this.db.collection(collections.WALLETS).findOne({
    id: id
  }, function(err, result) {
    if (err) return cb(err);
    if (!result) return cb();
    return cb(null, Model.Wallet.fromObj(result));
  });
};

Storage.prototype.storeWallet = function(wallet, cb) {
  this.db.collection(collections.WALLETS).update({
    id: wallet.id
  }, wallet, {
    w: 1,
    upsert: true,
  }, cb);
};

Storage.prototype.storeWalletAndUpdateCopayersLookup = function(wallet, cb) {
  return this.storeWallet(wallet, cb);
};

Storage.prototype.fetchCopayerLookup2 = function(copayerId, cb) {
  this.db.collection(collections.WALLETS).findOne({
    'copayers.id': copayerId
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

Storage.prototype.fetchCopayerLookup = function(copayerId, cb) {
  this.db.collection(collections.WALLETS).find({}).toArray(function(err, result) {
    if (err) return cb(err);

    result = _.find(result, function(w) {
      return _.any(w.copayers, {
        id: copayerId
      });
    });


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

  this.db.collection(collections.TXS).findOne({
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

  this.db.collection(collections.TXS).find({
    walletId: walletId,
    isPending: true
  }).sort({
    createdOn: -1
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

  this.db.collection(collections.TXS).find(filter, mods).sort({
    createdOn: -1
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
 * @param opts.reverse
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

  this.db.collection(collections.NOTIFICATIONS).find(filter, mods).sort({
    id: opts.reverse ? -1 : 1,
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
  this.db.collection(collections.NOTIFICATIONS).insert(notification, {
    w: 1
  }, cb);
};

// TODO: remove walletId from signature
Storage.prototype.storeTx = function(walletId, txp, cb) {
  txp.isPending = txp.isPending(); // Persist attribute to use when querying
  this.db.collection(collections.TXS).update({
    id: txp.id,
    walletId: walletId
  }, txp, {
    w: 1,
    upsert: true,
  }, cb);
};

Storage.prototype.removeTx = function(walletId, txProposalId, cb) {
  this.db.collection(collections.TXS).findAndRemove({
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
      self.db.collection(collections.WALLETS).findAndRemove({
        id: walletId
      }, next);
    },
    function(next) {
      self.db.collection(collections.ADDRESSES).remove({
        walletId: walletId
      }, next);
    },
    function(next) {
      self.db.collection(collections.TXS).remove({
        walletId: walletId
      }, next);
    },
    function(next) {
      self.db.collection(collections.NOTIFICATIONS).remove({
        walletId: walletId
      }, next);
    },
  ], cb);
};


Storage.prototype.fetchAddresses = function(walletId, cb) {
  var self = this;

  this.db.collection(collections.ADDRESSES).find({
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
  var addresses = [].concat(addresses);
  if (addresses.length == 0) return cb();
  this.db.collection(collections.ADDRESSES).insert(addresses, {
    w: 1
  }, function(err) {
    if (err) return cb(err);
    self.storeWallet(wallet, cb);
  });
};

Storage.prototype._dump = function(cb, fn) {
  fn = fn || console.log;
  cb = cb || function() {};

  var self = this;
  this.db.collections(function(err, collections) {
    if (err) return cb(err);
    async.eachSeries(collections, function(col, next) {
      col.find().toArray(function(err, items) {
        fn('--------', col.s.name);
        fn(items);
        fn('------------------------------------------------------------------\n\n');
        next(err);
      });
    }, cb);
  });
};

module.exports = Storage;
