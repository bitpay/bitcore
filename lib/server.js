'use strict';
var _ = require('lodash');
var $ = require('preconditions').singleton();
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;
var inherits = require('inherits');
var events = require('events');
var nodeutil = require('util');

var Bitcore = require('bitcore');
var PublicKey = Bitcore.PublicKey;
var HDPublicKey = Bitcore.HDPublicKey;
var Address = Bitcore.Address;
var Explorers = require('bitcore-explorers');

var ClientError = require('./clienterror');
var Utils = require('./utils');
var Storage = require('./storage');
var WalletUtils = require('./walletutils');

var Wallet = require('./model/wallet');
var Copayer = require('./model/copayer');
var Address = require('./model/address');
var TxProposal = require('./model/txproposal');
var Notification = require('./model/notification');

var initialized = false;
var storage, blockExplorer;

/**
 * Creates an instance of the Copay server.
 * @constructor
 */
function WalletService() {
  if (!initialized)
    throw new Error('Server not initialized');

  this.storage = storage;
  this.blockExplorer = blockExplorer;
  this.notifyTicker = 0;
};

nodeutil.inherits(WalletService, events.EventEmitter);


/**
 * Initializes global settings for all instances.
 * @param {Object} opts
 * @param {Storage} [opts.storage] - The storage provider.
 * @param {Storage} [opts.blockExplorer] - The blockExporer provider.
 */
WalletService.initialize = function(opts) {
  opts = opts || {};
  storage = opts.storage ||  new Storage();
  blockExplorer = opts.blockExplorer;
  initialized = true;
};

WalletService.getInstance = function() {
  return new WalletService();
};

/**
 * Gets an instance of the server after authenticating the copayer.
 * @param {Object} opts
 * @param {string} opts.copayerId - The copayer id making the request.
 * @param {string} opts.message - The contents of the request to be signed.
 * @param {string} opts.signature - Signature of message to be verified using the copayer's signingPubKey.
 */
WalletService.getInstanceWithAuth = function(opts, cb) {

  if (!Utils.checkRequired(opts, ['copayerId', 'message', 'signature']))
    return cb(new ClientError('Required argument missing'));

  var server = new WalletService();
  server.storage.fetchCopayerLookup(opts.copayerId, function(err, copayer) {
    if (err) return cb(err);
    if (!copayer) return cb(new ClientError('NOTAUTHORIZED', 'Copayer not found'));

    var isValid = server._verifySignature(opts.message, opts.signature, copayer.signingPubKey);
    if (!isValid) return cb(new ClientError('NOTAUTHORIZED', 'Invalid signature'));

    server.copayerId = opts.copayerId;
    server.walletId = copayer.walletId;
    return cb(null, server);
  });
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
WalletService.prototype.createWallet = function(opts, cb) {
  var self = this,
    pubKey;

  if (!Utils.checkRequired(opts, ['name', 'm', 'n', 'pubKey']))
    return cb(new ClientError('Required argument missing'));

  if (_.isEmpty(opts.name)) return cb(new ClientError('Invalid wallet name'));
  if (!Wallet.verifyCopayerLimits(opts.m, opts.n))
    return cb(new ClientError('Invalid combination of required copayers / total copayers'));

  var network = opts.network || 'livenet';
  if (network != 'livenet' && network != 'testnet')
    return cb(new ClientError('Invalid network'));

  try {
    pubKey = new PublicKey.fromString(opts.pubKey);
  } catch (e) {
    return cb(e.toString());
  };

  var wallet = Wallet.create({
    name: opts.name,
    m: opts.m,
    n: opts.n,
    network: network,
    pubKey: pubKey.toString(),
  });

  self.storage.storeWallet(wallet, function(err) {
    log.debug('Wallet created', wallet.id, network);
    return cb(err, wallet.id);
  });
};

/**
 * Retrieves a wallet from storage.
 * @param {Object} opts
 * @returns {Object} wallet
 */
WalletService.prototype.getWallet = function(opts, cb) {
  var self = this;

  self.storage.fetchWallet(self.walletId, function(err, wallet) {
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
WalletService.prototype._verifySignature = function(text, signature, pubKey) {
  return WalletUtils.verifyMessage(text, signature, pubKey);
};


/**
 * _notify
 *
 * @param type
 * @param data
 */
WalletService.prototype._notify = function(type, data) {
  var self = this;

  log.debug('Notification', type, data);

  var walletId = self.walletId || data.walletId;
  $.checkState(walletId);

  var n = Notification.create({
    type: type,
    data: data,
    ticker: this.notifyTicker++,
  });
  this.storage.storeNotification(walletId, n, function() {
    self.emit(n);
  });
};

/**
 * Joins a wallet in creation.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {string} opts.name - The copayer name.
 * @param {number} opts.xPubKey - Extended Public Key for this copayer.
 * @param {number} opts.xPubKeySignature - Signature of xPubKey using the wallet pubKey.
 */
WalletService.prototype.joinWallet = function(opts, cb) {
  var self = this;

  if (!Utils.checkRequired(opts, ['walletId', 'name', 'xPubKey', 'xPubKeySignature']))
    return cb(new ClientError('Required argument missing'));

  if (_.isEmpty(opts.name))
    return cb(new ClientError('Invalid copayer name'));

  Utils.runLocked(opts.walletId, cb, function(cb) {
    self.storage.fetchWallet(opts.walletId, function(err, wallet) {
      if (err) return cb(err);
      if (!wallet) return cb(new ClientError('Wallet not found'));

      if (!self._verifySignature(opts.xPubKey, opts.xPubKeySignature, wallet.pubKey)) {
        return cb(new ClientError());
      }

      if (_.find(wallet.copayers, {
        xPubKey: opts.xPubKey
      })) return cb(new ClientError('CINWALLET', 'Copayer already in wallet'));

      if (wallet.copayers.length == wallet.n)
        return cb(new ClientError('WFULL', 'Wallet full'));

      var copayer = Copayer.create({
        name: opts.name,
        xPubKey: opts.xPubKey,
        xPubKeySignature: opts.xPubKeySignature,
        copayerIndex: wallet.copayers.length,
      });

      self.storage.fetchCopayerLookup(copayer.id, function(err, res) {
        if (err) return cb(err);
        if (res)
          return cb(new ClientError('CREGISTERED', 'Copayer ID already registered on server'));

        wallet.addCopayer(copayer);
        self.storage.storeWalletAndUpdateCopayersLookup(wallet, function(err) {
          if (err) return cb(err);

          self._notify('NewCopayer', {
            walletId: opts.walletId,
            copayerId: copayer.id,
            copayerName: copayer.name,
          });
          return cb(null, {
            copayerId: copayer.id,
            wallet: wallet
          });
        });
      });
    });
  });
};

/**
 * Creates a new address.
 * @param {Object} opts
 * @returns {Address} address
 */
WalletService.prototype.createAddress = function(opts, cb) {
  var self = this;

  Utils.runLocked(self.walletId, cb, function(cb) {
    self.getWallet({}, function(err, wallet) {
      if (err) return cb(err);
      if (!wallet.isComplete())
        return cb(new ClientError('Wallet is not complete'));

      var address = wallet.createAddress(false);

      self.storage.storeAddressAndWallet(wallet, address, function(err) {
        if (err) return cb(err);

        self._notify('NewAddress');
        return cb(null, address);
      });
    });
  });
};

/**
 * Get all addresses.
 * @param {Object} opts
 * @returns {Address[]}
 */
WalletService.prototype.getAddresses = function(opts, cb) {
  var self = this;

  self.storage.fetchAddresses(self.walletId, function(err, addresses) {
    if (err) return cb(err);

    return cb(null, addresses);
  });
};

/**
 * Verifies that a given message was actually sent by an authorized copayer.
 * @param {Object} opts
 * @param {string} opts.message - The message to verify.
 * @param {string} opts.signature - The signature of message to verify.
 * @returns {truthy} The result of the verification.
 */
WalletService.prototype.verifyMessageSignature = function(opts, cb) {
  var self = this;

  if (!Utils.checkRequired(opts, ['message', 'signature']))
    return cb(new ClientError('Required argument missing'));

  self.getWallet({}, function(err, wallet) {
    if (err) return cb(err);

    var copayer = wallet.getCopayer(self.copayerId);

    var isValid = self._verifySignature(opts.message, opts.signature, copayer.signingPubKey);
    return cb(null, isValid);
  });
};


WalletService.prototype._getBlockExplorer = function(provider, network) {
  var url;

  if (this.blockExplorer)
    return this.blockExplorer;

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

/**
 * _getUtxos
 *
 */
WalletService.prototype._getUtxos = function(cb) {
  var self = this;


  // Get addresses for this wallet
  self.storage.fetchAddresses(self.walletId, function(err, addresses) {
    if (err) return cb(err);
    if (addresses.length == 0)
      return cb(null, []);

    var addressStrs = _.pluck(addresses, 'address');
    var addressToPath = _.indexBy(addresses, 'address'); // TODO : check performance
    var networkName = Bitcore.Address(addressStrs[0]).toObject().network;

    var bc = self._getBlockExplorer('insight', networkName);
    bc.getUnspentUtxos(addressStrs, function(err, inutxos) {
      if (err) return cb(err);
      var utxos = _.map(inutxos, function(i) {
        return _.pick(i, ['txid', 'vout', 'address', 'scriptPubKey', 'amount', 'satoshis']);
      });
      self.getPendingTxs({}, function(err, txps) {
        if (err) return cb(err);

        var inputs = _.chain(txps)
          .pluck('inputs')
          .flatten()
          .map(function(utxo) {
            return utxo.txid + '|' + utxo.vout
          })
          .value();

        var dictionary = _.reduce(utxos, function(memo, utxo) {
          memo[utxo.txid + '|' + utxo.vout] = utxo;
          return memo;
        }, {});

        _.each(inputs, function(input) {
          if (dictionary[input]) {
            dictionary[input].locked = true;
          }
        });

        // Needed for the clients to sign UTXOs
        _.each(utxos, function(utxo) {
          utxo.satoshis = utxo.satoshis ? +utxo.satoshis : Utils.strip(utxo.amount * 1e8);
          delete utxo.amount;
          utxo.path = addressToPath[utxo.address].path;
          utxo.publicKeys = addressToPath[utxo.address].publicKeys;
        });

        return cb(null, utxos);
      });
    });
  });
};


/**
 * Creates a new transaction proposal.
 * @param {Object} opts
 * @returns {Object} balance - Total amount & locked amount.
 */
WalletService.prototype.getBalance = function(opts, cb) {
  var self = this;

  self._getUtxos(function(err, utxos) {
    if (err) return cb(err);

    var balance = {};
    balance.totalAmount = Utils.strip(_.reduce(utxos, function(sum, utxo) {
      return sum + utxo.satoshis;
    }, 0));

    balance.lockedAmount = Utils.strip(_.reduce(_.filter(utxos, {
      locked: true
    }), function(sum, utxo) {
      return sum + utxo.satoshis;
    }, 0));

    return cb(null, balance);
  });
};


WalletService.prototype._selectUtxos = function(txp, utxos) {
  var i = 0;
  var total = 0;
  var selected = [];
  var inputs = _.sortBy(utxos, 'amount');

  while (i < inputs.length) {
    selected.push(inputs[i]);
    total += inputs[i].satoshis;

    if (total >= txp.amount + Bitcore.Transaction.FEE_PER_KB) {
      try {
        // Check if there are enough fees
        txp.inputs = selected;
        var raw = txp.getRawTx();
        return;
      } catch (ex) {
        if (ex.name != 'bitcore.ErrorTransactionFeeError') {
          throw ex.message;
        }
      }
    }
    i++;
  };
  txp.inputs = null;
  return;
};


/**
 * Creates a new transaction proposal.
 * @param {Object} opts
 * @param {string} opts.toAddress - Destination address.
 * @param {number} opts.amount - Amount to transfer in satoshi.
 * @param {string} opts.message - A message to attach to this transaction.
 * @param {string} opts.proposalSignature - S(toAddress + '|' + amount + '|' + message). Used by other copayers to verify the proposal. Optional in 1-of-1 wallets.
 * @returns {TxProposal} Transaction proposal.
 */
WalletService.prototype.createTx = function(opts, cb) {
  var self = this;

  if (!Utils.checkRequired(opts, ['toAddress', 'amount', 'proposalSignature']))
    return cb(new ClientError('Required argument missing'));

  Utils.runLocked(self.walletId, cb, function(cb) {
    self.getWallet({}, function(err, wallet) {
      if (err) return cb(err);
      if (!wallet.isComplete()) return cb(new ClientError('Wallet is not complete'));

      var copayer = wallet.getCopayer(self.copayerId);
      var hash = WalletUtils.getProposalHash(opts.toAddress, opts.amount, opts.message);
      if (!self._verifySignature(hash, opts.proposalSignature, copayer.signingPubKey))
        return cb(new ClientError('Invalid proposal signature'));

      var toAddress;
      try {
        toAddress = new Bitcore.Address(opts.toAddress);
      } catch (ex) {
        return cb(new ClientError('INVALIDADDRESS', 'Invalid address'));
      }
      if (toAddress.network != wallet.getNetworkName())
        return cb(new ClientError('INVALIDADDRESS', 'Incorrect address network'));

      if (opts.amount < Bitcore.Transaction.DUST_AMOUNT)
        return cb(new ClientError('DUSTAMOUNT', 'Amount below dust threshold'));

      self._getUtxos(function(err, utxos) {
        if (err) return cb(err);

        var changeAddress = wallet.createAddress(true);

        utxos = _.reject(utxos, {
          locked: true
        });

        var txp = TxProposal.create({
          creatorId: self.copayerId,
          toAddress: opts.toAddress,
          amount: opts.amount,
          message: opts.message,
          proposalSignature: opts.proposalSignature,
          changeAddress: changeAddress,
          requiredSignatures: wallet.m,
          requiredRejections: Math.min(wallet.m, wallet.n - wallet.m + 1),
        });

        try {
          self._selectUtxos(txp, utxos);
        } catch (ex) {
          return cb(new ClientError(ex));
        }

        if (!txp.inputs)
          return cb(new ClientError('INSUFFICIENTFUNDS', 'Insufficient funds'));

        txp.inputPaths = _.pluck(txp.inputs, 'path');

        self.storage.storeAddressAndWallet(wallet, changeAddress, function(err) {
          if (err) return cb(err);

          self.storage.storeTx(wallet.id, txp, function(err) {
            if (err) return cb(err);

            self._notify('NewTxProposal', {
              amount: opts.amount
            });
            return cb(null, txp);
          });
        });
      });
    });
  });
};

/**
 * Retrieves a tx from storage.
 * @param {Object} opts
 * @param {string} opts.id - The tx id.
 * @returns {Object} txProposal
 */
WalletService.prototype.getTx = function(opts, cb) {
  var self = this;

  self.storage.fetchTx(self.walletId, opts.id, function(err, txp) {
    if (err) return cb(err);
    if (!txp) return cb(new ClientError('Transaction proposal not found'));
    return cb(null, txp);
  });
};


/**
 * removeWallet
 *
 * @param opts
 * @param cb
 * @return {undefined}
 */
WalletService.prototype.removeWallet = function(opts, cb) {
  var self = this;

  Utils.runLocked(self.walletId, cb, function(cb) {
    self.storage.removeWallet(self.walletId, cb);
  });
};

/**
 * removePendingTx
 *
 * @param opts
 * @param {string} opts.txProposalId - The tx id.
 * @return {undefined}
 */
WalletService.prototype.removePendingTx = function(opts, cb) {
  var self = this;

  if (!Utils.checkRequired(opts, ['txProposalId']))
    return cb(new ClientError('Required argument missing'));

  Utils.runLocked(self.walletId, cb, function(cb) {

    self.getTx({
      id: opts.txProposalId,
    }, function(err, txp) {
      if (err) return cb(err);

      if (!txp.isPending())
        return cb(new ClientError('Transaction proposal not pending'));


      if (txp.creatorId !== self.copayerId)
        return cb(new ClientError('Only creators can remove pending proposals'));

      var actors = txp.getActors();

      if (actors.length > 1 || (actors.length == 1 && actors[0] !== self.copayerId))
        return cb(new ClientError('Cannot remove a proposal signed/rejected by other copayers'));

      self._notify('transactionProposalRemoved');
      self.storage.removeTx(self.walletId, txp.id, cb);
    });
  });
};


WalletService.prototype._broadcastTx = function(txp, cb) {
  var raw;
  try {
    raw = txp.getRawTx();
  } catch (ex) {
    return cb(ex);
  }
  var bc = this._getBlockExplorer('insight', txp.getNetworkName());
  bc.broadcast(raw, function(err, txid) {
    return cb(err, txid);
  })
};

/**
 * Sign a transaction proposal.
 * @param {Object} opts
 * @param {string} opts.txProposalId - The identifier of the transaction.
 * @param {string} opts.signatures - The signatures of the inputs of this tx for this copayer (in apperance order)
 */
WalletService.prototype.signTx = function(opts, cb) {
  var self = this;

  if (!Utils.checkRequired(opts, ['txProposalId', 'signatures']))
    return cb(new ClientError('Required argument missing'));

  self.getWallet({}, function(err, wallet) {
    if (err) return cb(err);

    self.getTx({
      id: opts.txProposalId
    }, function(err, txp) {
      if (err) return cb(err);

      var action = _.find(txp.actions, {
        copayerId: self.copayerId
      });
      if (action)
        return cb(new ClientError('CVOTED', 'Copayer already voted on this transaction proposal'));
      if (txp.status != 'pending')
        return cb(new ClientError('TXNOTPENDING', 'The transaction proposal is not pending'));

      var copayer = wallet.getCopayer(self.copayerId);

      if (!txp.sign(self.copayerId, opts.signatures, copayer.xPubKey))
        return cb(new ClientError('BADSIGNATURES', 'Bad signatures'));

      self.storage.storeTx(self.walletId, txp, function(err) {
        if (err) return cb(err);

        self._notify('TxProposalAcceptedBy', {
          txProposalId: opts.txProposalId,
          copayerId: self.copayerId,
        });

        // TODO: replace with .isAccepted()
        if (txp.status == 'accepted') {

          self._notify('TxProposalFinallyAccepted', {
            txProposalId: opts.txProposalId,
          });

          self._broadcastTx(txp, function(err, txid) {
            if (err) return cb(err);

            txp.setBroadcasted(txid);
            self.storage.storeTx(self.walletId, txp, function(err) {
              if (err) return cb(err);

              self._notify('NewOutgoingTx', {
                txProposalId: opts.txProposalId,
                txid: txid
              });
              return cb(null, txp);
            });
          });
        } else {
          return cb(null, txp);
        }
      });
    });
  });
};


/**
 * Broadcast a transaction proposal.
 * @param {Object} opts
 * @param {string} opts.txProposalId - The identifier of the transaction.
 */
WalletService.prototype.broadcastTx = function(opts, cb) {
  var self = this;

  if (!Utils.checkRequired(opts, ['txProposalId']))
    return cb(new ClientError('Required argument missing'));

  self.getWallet({}, function(err, wallet) {
    if (err) return cb(err);

    self.getTx({
      id: opts.txProposalId
    }, function(err, txp) {
      if (err) return cb(err);

      if (txp.status == 'broadcasted')
        return cb(new ClientError('TXALREADYBROADCASTED', 'The transaction proposal is already broadcasted'));

      if (txp.status != 'accepted')
        return cb(new ClientError('TXNOTACCEPTED', 'The transaction proposal is not accepted'));

      self._broadcastTx(txp, function(err, txid) {
        if (err) return cb(err);

        txp.setBroadcasted(txid);
        self.storage.storeTx(self.walletId, txp, function(err) {
          if (err) return cb(err);

          self._notify('NewOutgoingTx', {
            txProposalId: opts.txProposalId,
            txid: txid
          });

          return cb(null, txid);
        });
      });
    });
  });
};

/**
 * Reject a transaction proposal.
 * @param {Object} opts
 * @param {string} opts.txProposalId - The identifier of the transaction.
 * @param {string} [opts.reason] - A message to other copayers explaining the rejection.
 */
WalletService.prototype.rejectTx = function(opts, cb) {
  var self = this;

  if (!Utils.checkRequired(opts, ['txProposalId']))
    return cb(new ClientError('Required argument missing'));

  self.getTx({
    id: opts.txProposalId
  }, function(err, txp) {
    if (err) return cb(err);

    var action = _.find(txp.actions, {
      copayerId: self.copayerId
    });
    if (action)
      return cb(new ClientError('CVOTED', 'Copayer already voted on this transaction proposal'));

    if (txp.status != 'pending')
      return cb(new ClientError('TXNOTPENDING', 'The transaction proposal is not pending'));

    txp.reject(self.copayerId, opts.reason);

    self.storage.storeTx(self.walletId, txp, function(err) {
      if (err) return cb(err);

      self._notify('TxProposalRejectedBy', {
        txProposalId: opts.txProposalId,
        copayerId: self.copayerId,
      });


      if (txp.status == 'rejected') {
        self._notify('TxProposalFinallyRejected', {
          txProposalId: opts.txProposalId,
        });
      };

      return cb(null, txp);
    });
  });
};

/**
 * Retrieves all pending transaction proposals.
 * @param {Object} opts
 * @returns {TxProposal[]} Transaction proposal.
 */
WalletService.prototype.getPendingTxs = function(opts, cb) {
  var self = this;

  self.storage.fetchPendingTxs(self.walletId, function(err, txps) {
    if (err) return cb(err);

    return cb(null, txps);
  });
};

/**
 * Retrieves pending transaction proposals in  the range (maxTs-minTs)
 * Times are in UNIX EPOCH
 *
 * @param {Object} opts.minTs (defaults to 0)
 * @param {Object} opts.maxTs (defaults to now)
 * @param {Object} opts.limit
 * @returns {TxProposal[]} Transaction proposals, first newer
 */
WalletService.prototype.getTxs = function(opts, cb) {
  var self = this;
  self.storage.fetchTxs(self.walletId, opts, function(err, txps) {
    if (err) return cb(err);
    return cb(null, txps);
  });
};


/**
 * Retrieves notifications in  the range (maxTs-minTs).
 * Times are in UNIX EPOCH. Order is assured even for events with the same time
 *
 * @param {Object} opts.minTs (defaults to 0)
 * @param {Object} opts.maxTs (defaults to now)
 * @param {Object} opts.limit
 * @param {Object} opts.reverse (default false)
 * @returns {Notification[]} Notifications
 */
WalletService.prototype.getNotifications = function(opts, cb) {
  var self = this;
  self.storage.fetchNotifications(self.walletId, opts, function(err, notifications) {
    if (err) return cb(err);
    return cb(null, notifications);
  });
};





module.exports = WalletService;
module.exports.ClientError = ClientError;
