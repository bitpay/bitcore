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

var Storage = function(opts) {
  opts = opts || {};
  this.db = opts.db || levelup(opts.dbPath || './db/copay.db', {
    valueEncoding: 'json'
  });
};


// WARN: Ts is supposed to have fixed with. Y33 problem :)

var opKey = function(key) {
  return key ? '!' + key : '';
};

var KEY = {
  WALLET: function(id) {
    return 'wallet::' + id;
  },
  COPAYER: function(id) {
    return 'copayer::' + id;
  },
  TXP: function(walletId, txProposalId) {
    return 'txp!' + walletId  + opKey(txProposalId);
  },
  TXP_BY_TS: function(walletId, ts, txProposalId) {
    return 'txp-ts!' + walletId + opKey(ts) + opKey(txProposalId);
  },
  PENDING_TXP_BY_TS: function(walletId, ts, txProposalId) {
    return 'pending-txp-ts!' + walletId + opKey(ts) +  opKey(txProposalId);
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
  var key = KEY.PENDING_TXP_BY_TS(walletId);
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

Storage.prototype.fetchTxs = function(walletId, cb) {
  var txs = [];
  var key = KEY.TXP(walletId);
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

// TODO should we store only txp.id on keys for indexing
// or the whole txp? For now, the entire record makes sense
// (faster + easier to access)
Storage.prototype.storeTx = function(walletId, txp, cb) {
  var self = this;

  async.series([

    function(next) {
      self.db.put(KEY.TXP(walletId, txp.id), txp, next);
    },
    function(next) {
      self.db.put(KEY.TXP_BY_TS(walletId, txp.createdOn, txp.id), txp, next);
    },
    function(next) {
      if (txp.isPending())
        self.db.put(KEY.PENDING_TXP_BY_TS(walletId, txp.createdOn, txp.id), txp, next);
      else
        self.db.del(KEY.PENDING_TXP_BY_TS(walletId, txp.createdOn, txp.id), next);
    }
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

Storage.prototype.storeAddress = function(walletId, address, cb) {
  this.db.put(KEY.ADDRESS(walletId,address.address), address, cb);
};

Storage.prototype.removeAddress = function(walletId, address, cb) {
  this.db.del(KEY.ADDRESS(walletId,address.address), cb);
};


Storage.prototype._dump = function(cb) {
  this.db.readStream()
    .on('data', console.log)
    .on('end', function() {
      if (cb) return cb();
    });
};

module.exports = Storage;
