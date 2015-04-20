'use strict';

var _ = require('lodash');
var levelup = require('mongodb');
var async = require('async');
var $ = require('preconditions').singleton();
var log = require('npmlog');
log.debug = log.verbose;
log.disableColor();
var util = require('util');

var mongodb = require('mongodb');

var Wallet = require('./model/wallet');
var Copayer = require('./model/copayer');
var Address = require('./model/address');
var TxProposal = require('./model/txproposal');
var Notification = require('./model/notification');

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

var zeroPad = function(x, length) {
  return _.padLeft(parseInt(x), length, '0');
};

var walletPrefix = function(id) {
  return 'w!' + id;
};

var opKey = function(key) {
  return key ? '!' + key : '';
};

var MAX_TS = _.repeat('9', 14);


var KEY = {
  WALLET: function(walletId) {
    return walletPrefix(walletId) + '!main';
  },
  COPAYER: function(id) {
    return 'copayer!' + id;
  },
  TXP: function(walletId, txProposalId) {
    return walletPrefix(walletId) + '!txp' + opKey(txProposalId);
  },
  NOTIFICATION: function(walletId, notificationId) {
    return walletPrefix(walletId) + '!not' + opKey(notificationId);
  },
  PENDING_TXP: function(walletId, txProposalId) {
    return walletPrefix(walletId) + '!ptxp' + opKey(txProposalId);
  },
  ADDRESS: function(walletId, address) {
    return walletPrefix(walletId) + '!addr' + opKey(address);
  },
};

Storage.prototype.fetchWallet = function(id, cb) {
  this.db.get(KEY.WALLET(id), function(err, data) {
    if (err) {
      if (err.notFound) return cb();
      return cb(err);
    }
    return cb(null, Wallet.fromObj(data));
  });
};

Storage.prototype.storeWallet = function(wallet, cb) {
  this.db.put(KEY.WALLET(wallet.id), wallet, cb);
};

Storage.prototype.storeWalletAndUpdateCopayersLookup = function(wallet, cb) {
  var ops = [];
  ops.push({
    type: 'put',
    key: KEY.WALLET(wallet.id),
    value: wallet
  });
  _.each(wallet.copayers, function(copayer) {
    var value = {
      walletId: wallet.id,
      requestPubKey: copayer.requestPubKey,
    };
    ops.push({
      type: 'put',
      key: KEY.COPAYER(copayer.id),
      value: value
    });
  });
  this.db.batch(ops, cb);
};

Storage.prototype.fetchCopayerLookup = function(copayerId, cb) {
  this.db.get(KEY.COPAYER(copayerId), function(err, data) {
    if (err) {
      if (err.notFound) return cb();
      return cb(err);
    }
    return cb(null, data);
  });
};

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
  this.db.get(KEY.TXP(walletId, txProposalId), function(err, data) {
    if (err) {
      if (err.notFound) return cb();
      return cb(err);
    }
    return self._completeTxData(walletId, TxProposal.fromObj(data), cb);
  });
};


Storage.prototype.fetchPendingTxs = function(walletId, cb) {
  var self = this;

  var txs = [];
  var key = KEY.PENDING_TXP(walletId);
  this.db.createReadStream({
    gte: key,
    lt: key + '~'
  })
    .on('data', function(data) {
      txs.push(TxProposal.fromObj(data.value));
    })
    .on('error', function(err) {
      if (err.notFound) return cb();
      return cb(err);
    })
    .on('end', function() {
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

  var txs = [];
  opts = opts || {};
  opts.limit = _.isNumber(opts.limit) ? parseInt(opts.limit) : -1;
  opts.minTs = _.isNumber(opts.minTs) ? zeroPad(opts.minTs, 11) : 0;
  opts.maxTs = _.isNumber(opts.maxTs) ? zeroPad(opts.maxTs, 11) : MAX_TS;

  var key = KEY.TXP(walletId, opts.minTs);
  var endkey = KEY.TXP(walletId, opts.maxTs);

  this.db.createReadStream({
    gt: key,
    lt: endkey + '~',
    reverse: true,
    limit: opts.limit,
  })
    .on('data', function(data) {
      txs.push(TxProposal.fromObj(data.value));
    })
    .on('error', function(err) {
      if (err.notFound) return cb();
      return cb(err);
    })
    .on('end', function() {
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
  var txs = [];
  opts = opts || {};
  opts.limit = _.isNumber(opts.limit) ? parseInt(opts.limit) : -1;
  opts.minTs = _.isNumber(opts.minTs) ? zeroPad(opts.minTs, 11) : 0;
  opts.maxTs = _.isNumber(opts.maxTs) ? zeroPad(opts.maxTs, 11) : MAX_TS;

  var key = KEY.NOTIFICATION(walletId, opts.minTs);
  var endkey = KEY.NOTIFICATION(walletId, opts.maxTs);

  this.db.createReadStream({
    gt: key,
    lt: endkey + '~',
    reverse: opts.reverse,
    limit: opts.limit,
  })
    .on('data', function(data) {
      txs.push(Notification.fromObj(data.value));
    })
    .on('error', function(err) {
      if (err.notFound) return cb();
      return cb(err);
    })
    .on('end', function() {
      return cb(null, txs);
    });
};


Storage.prototype.storeNotification = function(walletId, notification, cb) {
  this.db.put(KEY.NOTIFICATION(walletId, notification.id), notification, cb);
};


// TODO should we store only txp.id on keys for indexing
// or the whole txp? For now, the entire record makes sense
// (faster + easier to access)
Storage.prototype.storeTx = function(walletId, txp, cb) {
  var ops = [{
    type: 'put',
    key: KEY.TXP(walletId, txp.id),
    value: txp,
  }];

  if (txp.isPending()) {
    ops.push({
      type: 'put',
      key: KEY.PENDING_TXP(walletId, txp.id),
      value: txp,
    });
  } else {
    ops.push({
      type: 'del',
      key: KEY.PENDING_TXP(walletId, txp.id),
    });
  }
  this.db.batch(ops, cb);
};

Storage.prototype.removeTx = function(walletId, txProposalId, cb) {
  var ops = [{
    type: 'del',
    key: KEY.TXP(walletId, txProposalId),
  }, {
    type: 'del',
    key: KEY.PENDING_TXP(walletId, txProposalId),
  }];

  this.db.batch(ops, cb);
};

Storage.prototype._delByKey = function(key, cb) {
  var self = this;
  var keys = [];
  this.db.createKeyStream({
    gte: key,
    lt: key + '~',
  })
    .on('data', function(key) {
      keys.push(key);
    })
    .on('error', function(err) {
      if (err.notFound) return cb();
      return cb(err);
    })
    .on('end', function(err) {
      self.db.batch(_.map(keys, function(k) {
        return {
          key: k,
          type: 'del'
        };
      }), function(err) {
        return cb(err);
      });
    });
};

Storage.prototype._removeCopayers = function(walletId, cb) {
  var self = this;

  this.fetchWallet(walletId, function(err, w) {
    if (err || !w) return cb(err);

    self.db.batch(_.map(w.copayers, function(c) {
      return {
        type: 'del',
        key: KEY.COPAYER(c.id),
      };
    }), cb);
  });
};

Storage.prototype.removeWallet = function(walletId, cb) {
  var self = this;

  async.series([

    function(next) {
      // This should be the first step. Will check the wallet exists
      self._removeCopayers(walletId, next);
    },
    function(next) {
      self._delByKey(walletPrefix(walletId), cb);
    },
  ], cb);
};


Storage.prototype.fetchAddresses = function(walletId, cb) {
  var addresses = [];
  var key = KEY.ADDRESS(walletId);
  this.db.createReadStream({
    gte: key,
    lt: key + '~'
  })
    .on('data', function(data) {
      addresses.push(Address.fromObj(data.value));
    })
    .on('error', function(err) {
      if (err.notFound) return cb();
      return cb(err);
    })
    .on('end', function() {
      return cb(null, addresses);
    });
};

Storage.prototype.storeAddressAndWallet = function(wallet, addresses, cb) {
  var ops = _.map([].concat(addresses), function(address) {
    return {
      type: 'put',
      key: KEY.ADDRESS(wallet.id, address.address),
      value: address,
    };
  });
  ops.unshift({
    type: 'put',
    key: KEY.WALLET(wallet.id),
    value: wallet,
  });

  this.db.batch(ops, cb);
};

Storage.prototype._dump = function(cb, fn) {
  fn = fn || console.log;

  this.db.readStream()
    .on('data', function(data) {
      fn(util.inspect(data, {
        depth: 10
      }));
    })
    .on('end', function() {
      if (cb) return cb();
    });
};

module.exports = Storage;
