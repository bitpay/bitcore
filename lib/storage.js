'use strict';

var _ = require('lodash');
var levelup = require('levelup');
var $ = require('preconditions').singleton();
var log = require('npmlog');
log.debug = log.verbose;

var Wallet = require('./model/wallet');
var Copayer = require('./model/copayer');
var Address = require('./model/address');
var TxProposal = require('./model/txproposal');

var Storage = function(opts) {
  opts = opts || {};
  this.db = opts.db || levelup(opts.dbPath || './db/copay.db', {
    valueEncoding: 'json'
  });
};


var opKey = function(key) {
  return key ? '!' + key : '';
};

var MAX_TS = '999999999999';
var opKeyTs = function(key) {
  return key ? '!' + ('000000000000' + key).slice(-12) : '';
};


var KEY = {
  WALLET: function(id) {
    return 'wallet!' + id;
  },
  COPAYER: function(id) {
    return 'copayer!' + id;
  },
  TXP: function(walletId, txProposalId) {
    return 'txp!' + walletId + opKey(txProposalId);
  },
  PENDING_TXP: function(walletId, txProposalId) {
    return 'pending-txp-ts!' + walletId + opKey(txProposalId);
  },
  ADDRESS: function(walletId, address) {
    return 'address!' + walletId + opKey(address);
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


Storage.prototype._dump = function(cb) {
  this.db.readStream()
    .on('data', console.log)
    .on('end', function() {
      if (cb) return cb();
    });
};

module.exports = Storage;
