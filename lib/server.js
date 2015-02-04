'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var inherits = require('inherits');
var events = require('events');

var Bitcore = require('bitcore');
var PublicKey = Bitcore.PublicKey;
var HDPublicKey = Bitcore.HDPublicKey;
var Explorers = require('bitcore-explorers');

var ClientError = require('./clienterror');
var Utils = require('./utils');
var Storage = require('./storage');
var SignUtils = require('./signutils');

var Wallet = require('./model/wallet');
var Copayer = require('./model/copayer');
var Address = require('./model/address');
var TxProposal = require('./model/txproposal');


/**
 * Creates an instance of the Copay server.
 * @constructor
 * @param {Object} opts
 * @param {Storage} [opts.storage] - The storage provider.
 */
function CopayServer(opts) {
  opts = opts || {};
  this.storage = opts.storage ||  new Storage();
};

inherits(CopayServer, events.EventEmitter);

CopayServer._emit = function(event) {
  var args = Array.prototype.slice.call(arguments);
  log.debug('Emitting: ', args);
  this.emit.apply(this, arguments);
};

/**
 * Creates a new wallet.
 * @param {Object} opts
 * @param {string} opts.id - The wallet id.
 * @param {string} opts.name - The wallet name.
 * @param {number} opts.m - Required copayers.
 * @param {number} opts.n - Total copayers.
 * @param {string} opts.pubKey - Public key to verify copayers joining have access to the wallet secret.
 * @param {string} [opts.network = 'livenet'] - The Bitcoin network for this wallet.
 */
CopayServer.prototype.createWallet = function(opts, cb) {
  var self = this,
    pubKey;

  Utils.checkRequired(opts, ['id', 'name', 'm', 'n', 'pubKey']);
  if (!Wallet.verifyCopayerLimits(opts.m, opts.n)) return cb(new ClientError('Invalid combination of required copayers / total copayers'));
  var network = opts.network || 'livenet';
  if (network != 'livenet' && network != 'testnet') return cb(new ClientError('Invalid network'));

  try {
    pubKey = new PublicKey.fromString(opts.pubKey);
  } catch (e) {
    return cb(e.toString());
  };

  self.storage.fetchWallet(opts.id, function(err, wallet) {
    if (err) return cb(err);
    if (wallet) return cb(new ClientError('WEXISTS', 'Wallet already exists'));

    var wallet = new Wallet({
      id: opts.id,
      name: opts.name,
      m: opts.m,
      n: opts.n,
      network: opts.network || 'livenet',
      pubKey: pubKey,
    });

    self.storage.storeWallet(wallet, cb);
  });
};

/**
 * Retrieves a wallet from storage.
 * @param {Object} opts
 * @param {string} opts.id - The wallet id.
 * @returns {Object} wallet
 */
CopayServer.prototype.getWallet = function(opts, cb) {
  var self = this;

  self.storage.fetchWallet(opts.id, function(err, wallet) {
    if (err) return cb(err);
    if (!wallet) return cb(new ClientError('Wallet not found'));
    return cb(null, wallet);
  });
};


/**
 * Verifies a signature
 * @param text
 * @param signature
 * @param pubKey
 */
CopayServer.prototype._verifySignature = function(text, signature, pubKey) {
  return SignUtils.verify(text, signature, pubKey);
};

/**
 * Joins a wallet in creation.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {string} opts.id - The copayer id.
 * @param {string} opts.name - The copayer name.
 * @param {number} opts.xPubKey - Extended Public Key for this copayer.
 * @param {number} opts.xPubKeySignature - Signature of xPubKey using the wallet pubKey.
 */
CopayServer.prototype.joinWallet = function(opts, cb) {
  var self = this;

  Utils.checkRequired(opts, ['walletId', 'id', 'name', 'xPubKey', 'xPubKeySignature']);

  Utils.runLocked(opts.walletId, cb, function(cb) {
    self.getWallet({
      id: opts.walletId
    }, function(err, wallet) {
      if (err) return cb(err);

      if (!self._verifySignature(opts.xPubKey, opts.xPubKeySignature, wallet.pubKey)) {
        return cb(new ClientError());
      }

      if (_.find(wallet.copayers, {
        xPubKey: opts.xPubKey
      })) return cb(new ClientError('CINWALLET', 'Copayer already in wallet'));
      if (wallet.copayers.length == wallet.n) return cb(new ClientError('WFULL', 'Wallet full'));

      var copayer = new Copayer({
        id: opts.id,
        name: opts.name,
        xPubKey: opts.xPubKey,
        xPubKeySignature: opts.xPubKeySignature,
        copayerIndex: wallet.copayers.length,
      });

      wallet.addCopayer(copayer);

      self.storage.storeWallet(wallet, function(err) {
        return cb(err);
      });
    });
  });
};

/**
 *
 * TODO: How this is going to be authenticated?
 *
 * Creates a new address.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {truthy} opts.isChange - Indicates whether this is a regular address or a change address.
 * @returns {Address} address
 */
CopayServer.prototype.createAddress = function(opts, cb) {
  var self = this;
  var isChange = opts.isChange || false;

  Utils.checkRequired(opts, ['walletId', 'isChange']);

  Utils.runLocked(opts.walletId, cb, function(cb) {
    self.getWallet({
      id: opts.walletId
    }, function(err, wallet) {
      if (err) return cb(err);

      var address = wallet.createAddress(opts.isChange);

      self.storage.storeAddress(wallet.id, address, function(err) {
        if (err) return cb(err);
  
        self.storage.storeWallet(wallet, function(err) {
          if (err) {
            self.storage.removeAddress(wallet.id, address, function () {
              return cb(err);
            });
          } else {
            return cb(null, address);
          }
        });
      });
    });
  });
};

/**
 * Get all addresses.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @returns {Address[]}
 */
CopayServer.prototype.getAddresses = function (opts, cb) {
  var self = this;

  self.storage.fetchAddresses(opts.walletId, function(err, addresses) {
    if (err) return cb(err);

    return cb(null, addresses);
  });
};

/**
 * Verifies that a given message was actually sent by an authorized copayer.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {string} opts.copayerId - The wallet id.
 * @param {string} opts.message - The message to verify.
 * @param {string} opts.signature - The signature of message to verify.
 * @returns {truthy} The result of the verification.
 */
CopayServer.prototype.verifyMessageSignature = function(opts, cb) {
  var self = this;

  Utils.checkRequired(opts, ['walletId', 'copayerId', 'message', 'signature']);

  self.getWallet({
    id: opts.walletId
  }, function(err, wallet) {
    if (err) return cb(err);

    var copayer = wallet.getCopayer(opts.copayerId);
    if (!copayer) return cb(new ClientError('Copayer not found'));

    var isValid = self._verifySignature(opts.message, opts.signature, copayer.signingPubKey);
    return cb(null, isValid);
  });
};


CopayServer.prototype._getBlockExplorer = function(provider, network) {
  var url;

  switch (provider) {
    default:
    case 'insight':
      switch (network) {
        default:
        case 'livenet':
          url = 'https://insight.bitpay.com:443';
          break;
        case 'testnet':
          url = 'https://test-insight.bitpay.com:443'
          break;
      }
      return new Explorers.Insight(url, network);
      break;
  }
};

CopayServer.prototype._getUtxos = function(opts, cb) {
  var self = this;

  // Get addresses for this wallet
  self.storage.fetchAddresses(opts.walletId, function(err, addresses) {
    if (err) return cb(err);
    if (addresses.length == 0) return cb(new ClientError('The wallet has no addresses'));

    var addresses = _.pluck(addresses, 'address');

    var bc = self._getBlockExplorer('insight', opts.network);
    bc.getUnspentUtxos(addresses, function(err, utxos) {
      if (err) return cb(err);

      self.getPendingTxs({
        walletId: opts.walletId
      }, function(err, txps) {
        if (err) return cb(err);

        var inputs = _.chain(txps)
          .pluck('inputs')
          .flatten()
          .map(function(utxo) {
            return utxo.txid + '|' + utxo.vout
          })
          .value();

        var dictionary = _.reduce(utxos, function (memo, utxo) {
          memo[utxo.txid + '|' + utxo.vout] = utxo;
          return memo;
        }, {});

        _.each(inputs, function(input) {
          if (dictionary[input]) {
            dictionary[input].locked = true;
          }
        });


        return cb(null, utxos);
      });
    });
  });
};


/**
 * Creates a new transaction proposal.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @returns {Object} balance - Total amount & locked amount.
 */
CopayServer.prototype.getBalance = function(opts, cb) {
  var self = this;

  Utils.checkRequired(opts, 'walletId');

  self._getUtxos({
    walletId: opts.walletId
  }, function(err, utxos) {
    if (err) return cb(err);

    var balance = {};
    balance.totalAmount = Utils.strip(_.reduce(utxos, function(sum, utxo) {
      return sum + utxo.amount;
    }, 0));

    balance.lockedAmount = Utils.strip(_.reduce(_.filter(utxos, {
      locked: true
    }), function(sum, utxo) {
      return sum + utxo.amount;
    }, 0));

    return cb(null, balance);
  });
};


CopayServer.prototype._createRawTx = function(txp) {
console.log('[server.js.320:txp:]',txp.inputs, txp.toAddress, txp.amount, txp.changeAddress); //TODO


  var rawTx = new Bitcore.Transaction()
    .from(txp.inputs)
    .to(txp.toAddress, txp.amount)
    .change(txp.changeAddress);

console.log('[server.js.324:rawTx:]',rawTx); //TODO
  return rawTx;
};

CopayServer.prototype._selectUtxos = function(txp, utxos) {
  var i = 0;
  var total = 0;
  var selected = [];
  var inputs = _.sortBy(utxos, 'amount');

  while (i < inputs.length) {
    selected.push(inputs[i]);
    total += inputs[i].amount;
    if (total >= txp.amount) {
      break;
    }
    i++;
  };
  return total  >= txp.amount  ? selected : null;
};


/**
 * Creates a new transaction proposal.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {string} opts.copayerId - The wallet id.
 * @param {string} opts.toAddress - Destination address.
 * @param {number} opts.amount - Amount to transfer in satoshi.
 * @param {string} opts.message - A message to attach to this transaction.
 * @returns {TxProposal} Transaction proposal.
 */
CopayServer.prototype.createTx = function(opts, cb) {
  var self = this;

  Utils.checkRequired(opts, ['walletId', 'copayerId', 'toAddress', 'amount', 'message']);


  // TODO? 
  // Check some parameters like:
  //  amount > dust

  self.getWallet({
    id: opts.walletId
  }, function(err, wallet) {
    if (err) return cb(err);

    self._getUtxos({
      walletId: wallet.id
    }, function(err, utxos) {
      if (err) return cb(err);

      var changeAddress = wallet.createAddress(true).address;

      utxos = _.reject(utxos, {
        locked: true
      });

      var txp = new TxProposal({
        creatorId: opts.copayerId,
        toAddress: opts.toAddress,
        amount: opts.amount,
        changeAddress: changeAddress,
        requiredSignatures: wallet.m,
        maxRejections: wallet.n - wallet.m,
      });

      txp.inputs = self._selectUtxos(txp, utxos);
      if (!txp.inputs) {
        return cb(new ClientError('INSUFFICIENTFUNDS', 'Insufficient funds'));
      }

      // no need to do this now: // TODO remove this comment
      //self._createRawTx(txp);
      self.storage.storeTx(wallet.id, txp, function(err) {
        if (err) return cb(err);

        return cb(null, txp);
      });
    });
  });
};

CopayServer.prototype._broadcastTx = function(rawTx, cb) {
  // TODO: this should attempt to broadcast _all_ accepted and not-yet broadcasted (status=='accepted') txps?
  cb = cb || function() {};

  throw 'not implemented';
};

/**
 * Sign a transaction proposal.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {string} opts.copayerId - The wallet id.
 * @param {string} opts.txProposalId - The identifier of the transaction.
 * @param {string} opts.signature - The signature of the tx for this copayer.
 */
CopayServer.prototype.signTx = function(opts, cb) {
  var self = this;

  Utils.checkRequired(opts, ['walletId', 'copayerId', 'txProposalId', 'signature']);

  self.fetchTx(opts.walletId, opts.txProposalId, function(err, txp) {
    if (err) return cb(err);
    if (!txp) return cb(new ClientError('Transaction proposal not found'));
    var action = _.find(txp.actions, {
      copayerId: opts.copayerId
    });
    if (action) return cb(new ClientError('CVOTED', 'Copayer already voted on this transaction proposal'));
    if (txp.status != 'pending') return cb(new ClientError('TXNOTPENDING', 'The transaction proposal is not pending'));

    txp.sign(opts.copayerId, opts.signature);

    self.storage.storeTx(opts.walletId, txp, function(err) {
      if (err) return cb(err);

      if (txp.status == 'accepted');
      self._broadcastTx(txp.rawTx, function(err, txid) {
        if (err) return cb(err);

        tx.setBroadcasted(txid);
        self.storage.storeTx(opts.walletId, txp, function(err) {
          if (err) return cb(err);

          return cb();
        });
      });
    });
  });
};

/**
 * Reject a transaction proposal.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {string} opts.copayerId - The wallet id.
 * @param {string} opts.txProposalId - The identifier of the transaction.
 * @param {string} [opts.reason] - A message to other copayers explaining the rejection.
 */
CopayServer.prototype.rejectTx = function(opts, cb) {
  var self = this;

  Utils.checkRequired(opts, ['walletId', 'copayerId', 'txProposalId']);

  self.fetchTx(opts.walletId, opts.txProposalId, function(err, txp) {
    if (err) return cb(err);
    if (!txp) return cb(new ClientError('Transaction proposal not found'));
    var action = _.find(txp.actions, {
      copayerId: opts.copayerId
    });
    if (action) return cb(new ClientError('CVOTED', 'Copayer already voted on this transaction proposal'));
    if (txp.status != 'pending') return cb(new ClientError('TXNOTPENDING', 'The transaction proposal is not pending'));

    txp.reject(opts.copayerId);

    self.storage.storeTx(opts.walletId, txp, function(err) {
      if (err) return cb(err);

      return cb();
    });
  });
};

/**
 * Retrieves all pending transaction proposals.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @returns {TxProposal[]} Transaction proposal.
 */
CopayServer.prototype.getPendingTxs = function(opts, cb) {
  var self = this;

  Utils.checkRequired(opts, 'walletId');

  self.storage.fetchTxs(opts.walletId, function(err, txps) {
    if (err) return cb(err);

    var pending = _.filter(txps, {
      status: 'pending'
    });
    return cb(null, pending);
  });
};


module.exports = CopayServer;
