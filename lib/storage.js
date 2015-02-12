'use strict';

var _ = require('lodash');
var levelup = require('levelup');
var async = require('async');
var $ = require('preconditions').singleton();
var log = require('npmlog');
log.debug = log.verbose;

var Wallet = require('./model/wallet');
var Copayer = require('./model/copayer');
var Address = require('./model/address');
var TxProposal = require('./model/txproposal');
var Notification = require('./model/notification');

var Storage = function(opts) {
  opts = opts || {};
  this.db = opts.db || levelup(opts.dbPath || './db/copay.db', {
    valueEncoding: 'json'
  });
};


var walletPrefix = function(id) {
  return 'w!' + id;
};

var opKey = function(key) {
  return key ? '!' + key : '';
};

var MAX_TS = '999999999999';
var opKeyTs = function(key) {
  return key ? '!' + ('000000000000' + key).slice(-12) : '';
};


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
      signingPubKey: copayer.signingPubKey,
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

Storage.prototype.fetchTx = function(walletId, txProposalId, cb) {
  this.db.get(KEY.TXP(walletId, txProposalId), function(err, data) {
    if (err) {
      if (err.notFound) return cb();
      return cb(err);
    }
    return cb(null, TxProposal.fromObj(data));
  });
};


Storage.prototype.fetchNotification = function(walletId, notificationId, cb) {
  this.db.get(KEY.NOTIFICATION(walletId, notificationId), function(err, data) {
    if (err) {
      if (err.notFound) return cb();
      return cb(err);
    }
    return cb(null, Notification.fromObj(data));
  });
};



Storage.prototype.fetchPendingTxs = function(walletId, cb) {
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
      return cb(null, txs);
    });
};

/**
 * fetchTxs
 *
 * @param walletId
 * @param opts.minTs
 * @param opts.maxTs
 * @param opts.limit
 */
Storage.prototype.fetchTxs = function(walletId, opts, cb) {
  var txs = [];
  opts = opts || {};
  opts.limit = _.isNumber(opts.limit) ? parseInt(opts.limit) : -1;
  opts.minTs = _.isNumber(opts.minTs) ? ('000000000000' + parseInt(opts.minTs)).slice(-12) : 0;
  opts.maxTs = _.isNumber(opts.maxTs) ? ('000000000000' + parseInt(opts.maxTs)).slice(-12) : MAX_TS;

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
      return cb(null, txs);
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
  opts.minTs = _.isNumber(opts.minTs) ? ('000000000000' + parseInt(opts.minTs)).slice(-12) : 0;
  opts.maxTs = _.isNumber(opts.maxTs) ? ('000000000000' + parseInt(opts.maxTs)).slice(-12) : MAX_TS;

  var key = KEY.NOTIFICATION(walletId, opts.minTs);
  var endkey = KEY.NOTIFICATION(walletId, opts.maxTs);

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

      console.log('[storage.js.252]'); //TODO
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

Storage.prototype.removeAllPendingTxs = function(walletId, cb) {
  this._delByKey(KEY.PENDING_TXP(walletId), cb);
};

Storage.prototype.removeAllTxs = function(walletId, cb) {
  this._delByKey(KEY.TXP(walletId), cb);
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

Storage.prototype._removeAllNotifications = function(walletId, cb) {
  this._delByKey(KEY.NOTIFICATION(walletId), cb);
};


Storage.prototype._removeAllAddresses = function(walletId, cb) {
  this._delByKey(KEY.ADDRESS(walletId), cb);
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

Storage.prototype.storeAddressAndWallet = function(wallet, address, cb) {
  var ops = [{
    type: 'put',
    key: KEY.WALLET(wallet.id),
    value: wallet,
  }, {
    type: 'put',
    key: KEY.ADDRESS(wallet.id, address.address),
    value: address,
  }, ];
  this.db.batch(ops, cb);
};

Storage.prototype.removeAddress = function(walletId, address, cb) {
  this.db.del(KEY.ADDRESS(walletId, address.address), cb);
};


Storage.prototype._dump = function(cb, fn) {
  fn = fn || console.log;

  this.db.readStream()
    .on('data', fn)
    .on('end', function() {
      if (cb) return cb();
    });
};

module.exports = Storage;
