'use strict';
var _ = require('lodash');
var $ = require('preconditions').singleton();
var async = require('async');
var log = require('npmlog');
log.debug = log.verbose;

var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var PublicKey = Bitcore.PublicKey;
var HDPublicKey = Bitcore.HDPublicKey;
var Address = Bitcore.Address;

var ClientError = require('./clienterror');
var Utils = require('./utils');
var Storage = require('./storage');
var NotificationBroadcaster = require('./notificationbroadcaster');
var BlockchainExplorer = require('./blockchainexplorer');

var Wallet = require('./model/wallet');
var Copayer = require('./model/copayer');
var Address = require('./model/address');
var TxProposal = require('./model/txproposal');
var Notification = require('./model/notification');

var initialized = false;
var storage, blockchainExplorer;


/**
 * Creates an instance of the Bitcore Wallet Service.
 * @constructor
 */
function WalletService() {
  if (!initialized)
    throw new Error('Server not initialized');

  this.storage = storage;
  this.blockchainExplorer = blockchainExplorer;
  this.notifyTicker = 0;
};

WalletService.onNotification = function(func) {
  NotificationBroadcaster.on('notification', func);
};

/**
 * Initializes global settings for all instances.
 * @param {Object} opts
 * @param {Storage} [opts.storage] - The storage provider.
 * @param {Storage} [opts.blockchainExplorer] - The blockchainExporer provider.
 */
WalletService.initialize = function(opts) {
  opts = opts || {};
  storage = opts.storage ||  new Storage(opts.storageOpts);
  blockchainExplorer = opts.blockchainExplorer;
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
 * @param {string} opts.signature - Signature of message to be verified using the copayer's requestPubKey
 */
WalletService.getInstanceWithAuth = function(opts, cb) {

  if (!Utils.checkRequired(opts, ['copayerId', 'message', 'signature']))
    return cb(new ClientError('Required argument missing'));

  var server = new WalletService();
  server.storage.fetchCopayerLookup(opts.copayerId, function(err, copayer) {
    if (err) return cb(err);
    if (!copayer) return cb(new ClientError('NOTAUTHORIZED', 'Copayer not found'));

    var isValid = server._verifySignature(opts.message, opts.signature, copayer.requestPubKey);
    if (!isValid)
      return cb(new ClientError('NOTAUTHORIZED', 'Invalid signature'));

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
  } catch (ex) {
    return cb(new ClientError('Invalid public key'));
  };

  var newWallet;
  async.series([

    function(acb) {
      if (!opts.id)
        return acb();

      self.storage.fetchWallet(opts.id, function(err, wallet) {
        if (wallet) return acb(new ClientError('WEXISTS', 'Wallet already exists'));
        return acb(err);
      });
    },
    function(acb) {
      var wallet = Wallet.create({
        name: opts.name,
        m: opts.m,
        n: opts.n,
        network: network,
        pubKey: pubKey.toString(),
        id: opts.id,
      });
      self.storage.storeWallet(wallet, function(err) {
        log.debug('Wallet created', wallet.id, network);
        newWallet = wallet;
        return acb(err);
      });
    }
  ], function(err) {
    return cb(err, newWallet ? newWallet.id : null);
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
 * Replace temporary request key
 * @param {Object} opts
 * @param {string} opts.name - The copayer name.
 * @param {string} opts.xPubKey - Extended Public Key for this copayer.
 * @param {string} opts.requestPubKey - Public Key used to check requests from this copayer.
 * @param {string} opts.copayerSignature - S(name|xPubKey|requestPubKey). Used by other copayers to verify the that the copayer joining knows the wallet secret.
 */
WalletService.prototype.replaceTemporaryRequestKey = function(opts, cb) {
  var self = this;

  if (!Utils.checkRequired(opts, ['name', 'xPubKey', 'requestPubKey', 'copayerSignature']))
    return cb(new ClientError('Required argument missing'));


  if (_.isEmpty(opts.name))
    return cb(new ClientError('Invalid copayer name'));


  if (opts.isTemporaryRequestKey)
    return cb(new ClientError('Bad arguments'));

  Utils.runLocked(self.walletId, cb, function(cb) {
    self.storage.fetchWallet(self.walletId, function(err, wallet) {
      if (err) return cb(err);

      if (!wallet) return cb(new ClientError('Wallet not found'));
      var hash = WalletUtils.getCopayerHash(opts.name, opts.xPubKey, opts.requestPubKey);
      if (!self._verifySignature(hash, opts.copayerSignature, wallet.pubKey)) {
        return cb(new ClientError());
      }

      var oldCopayerData = _.find(wallet.copayers, {
        id: self.copayerId
      });
      $.checkState(oldCopayerData);

      if (oldCopayerData.xPubKey !== opts.xPubKey || !oldCopayerData.isTemporaryRequestKey)
        return cb(new ClientError('CDATAMISMATCH', 'Copayer data mismatch'));

      if (wallet.copayers.length != wallet.n)
        return cb(new ClientError('WNOTFULL', 'Replace only works on full wallets'));

      wallet.updateCopayerRequestKey(self.copayerId, opts.requestPubKey, opts.copayerSignature);

      self.storage.storeWalletAndUpdateCopayersLookup(wallet, function(err) {
        if (err) return cb(err);

        self._notify('CopayerUpdated', {
          walletId: opts.walletId,
          copayerId: self.copayerId,
          copayerName: opts.name,
        });

        return cb(null, {
          copayerId: self.copayerId,
          wallet: wallet
        });
      });
    });
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
 * _emit
 *
 * @param {Object} args
 */
WalletService.prototype._emit = function(eventName, args) {
  NotificationBroadcaster.broadcast(eventName, args);
};

/**
 * _notify
 *
 * @param {String} type
 * @param {Object} data
 * @param {Boolean} isGlobal - If true, the notification is not issued on behalf of any particular copayer (defaults to false)
 */
WalletService.prototype._notify = function(type, data, isGlobal) {
  var self = this;

  log.debug('Notification', type, data);

  var walletId = self.walletId || data.walletId;
  var copayerId = self.copayerId || data.copayerId;

  $.checkState(walletId);

  var n = Notification.create({
    type: type,
    data: data,
    ticker: this.notifyTicker++,
    creatorId: isGlobal ? null : copayerId,
    walletId: walletId,
  });
  this.storage.storeNotification(walletId, n, function() {
    self._emit('notification', n);
  });
};

/**
 * Joins a wallet in creation.
 * @param {Object} opts
 * @param {string} opts.walletId - The wallet id.
 * @param {string} opts.name - The copayer name.
 * @param {string} opts.xPubKey - Extended Public Key for this copayer.
 * @param {string} opts.requestPubKey - Public Key used to check requests from this copayer.
 * @param {string} opts.copayerSignature - S(name|xPubKey|requestPubKey). Used by other copayers to verify the that the copayer joining knows the wallet secret.
 * @param {string} opts.isTemporaryRequestKey - requestPubKey will be marked as 'temporary' (only used for Copay migration)
 */
WalletService.prototype.joinWallet = function(opts, cb) {
  var self = this;

  if (!Utils.checkRequired(opts, ['walletId', 'name', 'xPubKey', 'requestPubKey', 'copayerSignature']))
    return cb(new ClientError('Required argument missing'));

  if (_.isEmpty(opts.name))
    return cb(new ClientError('Invalid copayer name'));

  Utils.runLocked(opts.walletId, cb, function(cb) {
    self.storage.fetchWallet(opts.walletId, function(err, wallet) {

      if (err) return cb(err);
      if (!wallet) return cb(new ClientError('Wallet not found'));

      var hash = WalletUtils.getCopayerHash(opts.name, opts.xPubKey, opts.requestPubKey);
      if (!self._verifySignature(hash, opts.copayerSignature, wallet.pubKey)) {
        return cb(new ClientError());
      }

      if (_.find(wallet.copayers, {
        xPubKey: opts.xPubKey
      })) return cb(new ClientError('CINWALLET', 'Copayer already in wallet'));

      if (wallet.copayers.length == wallet.n)
        return cb(new ClientError('WFULL', 'Wallet full'));

      var copayer = Copayer.create({
        name: opts.name,
        copayerIndex: wallet.copayers.length,
        xPubKey: opts.xPubKey,
        requestPubKey: opts.requestPubKey,
        signature: opts.copayerSignature,
        isTemporaryRequestKey: !!opts.isTemporaryRequestKey,
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

        self._notify('NewAddress', {
          address: address.address,
        });
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
WalletService.prototype.getMainAddresses = function(opts, cb) {
  var self = this;

  self.storage.fetchAddresses(self.walletId, function(err, addresses) {
    if (err) return cb(err);

    var onlyMain = _.reject(addresses, {
      isChange: true
    });
    return cb(null, onlyMain);
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

    var isValid = self._verifySignature(opts.message, opts.signature, copayer.requestPubKey);
    return cb(null, isValid);
  });
};


WalletService.prototype._getBlockchainExplorer = function(provider, network) {
  if (!this.blockchainExplorer) {
    this.blockchainExplorer = new BlockchainExplorer({
      provider: provider,
      network: network,
    });
  }

  return this.blockchainExplorer;
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
    if (addresses.length == 0) return cb(null, []);

    var addressStrs = _.pluck(addresses, 'address');
    var addressToPath = _.indexBy(addresses, 'address'); // TODO : check performance
    var networkName = Bitcore.Address(addressStrs[0]).toObject().network;

    var bc = self._getBlockchainExplorer('insight', networkName);
    bc.getUnspentUtxos(addressStrs, function(err, inutxos) {
      if (err) return cb(err);
      var utxos = _.map(inutxos, function(i) {
        return _.pick(i.toObject(), ['txid', 'vout', 'address', 'scriptPubKey', 'amount', 'satoshis']);
      });
      self.getPendingTxs({}, function(err, txps) {
        if (err) return cb(err);

        var utxoKey = function(utxo) {
          return utxo.txid + '|' + utxo.vout
        };

        var inputs = _.chain(txps)
          .pluck('inputs')
          .flatten()
          .map(utxoKey)
          .value();

        var dictionary = _.reduce(utxos, function(memo, utxo) {
          memo[utxoKey(utxo)] = utxo;
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

WalletService.prototype._totalizeUtxos = function(utxos) {
  var balance = {};
  balance.totalAmount = Utils.strip(_.reduce(utxos, function(sum, utxo) {
    return sum + utxo.satoshis;
  }, 0));

  balance.lockedAmount = Utils.strip(_.reduce(_.filter(utxos, {
    locked: true
  }), function(sum, utxo) {
    return sum + utxo.satoshis;
  }, 0));
  return balance;
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

    var balance = self._totalizeUtxos(utxos);

    // Compute balance by address
    var byAddress = {};
    _.each(_.indexBy(utxos, 'address'), function(value, key) {
      byAddress[key] = {
        address: key,
        path: value.path,
        amount: 0,
      };
    });

    _.each(utxos, function(utxo) {
      byAddress[utxo.address].amount += utxo.satoshis;
    });

    balance.byAddress = _.values(byAddress);

    return cb(null, balance);
  });
};

WalletService.prototype._selectTxInputs = function(txp, cb) {
  var self = this;

  self._getUtxos(function(err, utxos) {
    if (err) return cb(err);

    var balance = self._totalizeUtxos(utxos);

    if (balance.totalAmount < txp.amount)
      return cb(new ClientError('INSUFFICIENTFUNDS', 'Insufficient funds'));
    if ((balance.totalAmount - balance.lockedAmount) < txp.amount)
      return cb(new ClientError('LOCKEDFUNDS', 'Funds are locked by pending transaction proposals'));

    utxos = _.reject(utxos, {
      locked: true
    });

    var i = 0;
    var total = 0;
    var selected = [];
    var inputs = _.sortBy(utxos, 'amount');
    var bitcoreTx, bitcoreError;

    while (i < inputs.length) {
      selected.push(inputs[i]);
      total += inputs[i].satoshis;
      i++;

      if (total >= txp.amount) {
        try {
          txp.inputs = selected;
          bitcoreTx = txp.getBitcoreTx();
          bitcoreError = bitcoreTx.getSerializationError({
            disableIsFullySigned: true,
          });
          if (!bitcoreError) {
            txp.inputPaths = _.pluck(txp.inputs, 'path');
            txp.fee = bitcoreTx.getFee();
            return cb();
          }
        } catch (ex) {
          return cb(ex);
        }
      }
    };

    if (bitcoreError instanceof Bitcore.errors.Transaction.FeeError) {
      return cb(new ClientError('INSUFFICIENTFUNDS', 'Insufficient funds for fee'));
    }
    if (bitcoreError instanceof Bitcore.errors.Transaction.DustOutputs) {
      return cb(new ClientError('DUSTAMOUNT', 'Amount below dust threshold'));
    }

    return cb(bitcoreError || new Error('Could not select tx inputs'));
  });
};

/**
 * Creates a new transaction proposal.
 * @param {Object} opts
 * @param {string} opts.toAddress - Destination address.
 * @param {number} opts.amount - Amount to transfer in satoshi.
 * @param {string} opts.message - A message to attach to this transaction.
 * @param {string} opts.proposalSignature - S(toAddress|amount|message|payProUrl). Used by other copayers to verify the proposal.
 * @param {string} opts.payProUrl - Options: Paypro URL for peers to verify TX
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
      var hash = WalletUtils.getProposalHash(opts.toAddress, opts.amount, opts.message, opts.payProUrl);
      if (!self._verifySignature(hash, opts.proposalSignature, copayer.requestPubKey))
        return cb(new ClientError('Invalid proposal signature'));

      var toAddress;
      try {
        toAddress = new Bitcore.Address(opts.toAddress);
      } catch (ex) {
        return cb(new ClientError('INVALIDADDRESS', 'Invalid address'));
      }
      if (toAddress.network != wallet.getNetworkName())
        return cb(new ClientError('INVALIDADDRESS', 'Incorrect address network'));

      if (opts.amount <= 0)
        return cb(new ClientError('Invalid amount'));

      if (opts.amount < Bitcore.Transaction.DUST_AMOUNT)
        return cb(new ClientError('DUSTAMOUNT', 'Amount below dust threshold'));


      var changeAddress = wallet.createAddress(true);

      var txp = TxProposal.create({
        walletId: self.walletId,
        creatorId: self.copayerId,
        toAddress: opts.toAddress,
        amount: opts.amount,
        message: opts.message,
        proposalSignature: opts.proposalSignature,
        payProUrl: opts.payProUrl,
        changeAddress: changeAddress,
        requiredSignatures: wallet.m,
        requiredRejections: Math.min(wallet.m, wallet.n - wallet.m + 1),
      });

      self._selectTxInputs(txp, function(err) {
        if (err) return cb(err);

        $.checkState(txp.inputs);

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
 * @param {string} opts.txProposalId - The tx id.
 * @returns {Object} txProposal
 */
WalletService.prototype.getTx = function(opts, cb) {
  var self = this;

  self.storage.fetchTx(self.walletId, opts.txProposalId, function(err, txp) {
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
      txProposalId: opts.txProposalId,
    }, function(err, txp) {
      if (err) return cb(err);

      if (!txp.isPending())
        return cb(new ClientError('TXNOTPENDING', 'Transaction proposal not pending'));


      if (txp.creatorId !== self.copayerId)
        return cb(new ClientError('Only creators can remove pending proposals'));

      var actors = txp.getActors();

      if (actors.length > 1 || (actors.length == 1 && actors[0] !== self.copayerId))
        return cb(new ClientError('TXACTIONED', 'Cannot remove a proposal signed/rejected by other copayers'));

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
  var bc = this._getBlockchainExplorer('insight', txp.getNetworkName());
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
      txProposalId: opts.txProposalId
    }, function(err, txp) {
      if (err) return cb(err);

      var action = _.find(txp.actions, {
        copayerId: self.copayerId
      });
      if (action)
        return cb(new ClientError('CVOTED', 'Copayer already voted on this transaction proposal'));
      if (!txp.isPending())
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

        if (txp.isAccepted()) {
          self._notify('TxProposalFinallyAccepted', {
            txProposalId: opts.txProposalId,
          });
        }

        return cb(null, txp);
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
      txProposalId: opts.txProposalId
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

          return cb(null, txp);
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
    txProposalId: opts.txProposalId
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
 * Retrieves pending transaction proposals.
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
 * Retrieves all transaction proposals in the range (maxTs-minTs)
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
 * Retrieves notifications in the range (maxTs-minTs).
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


WalletService.prototype._normalizeTxHistory = function(txs) {
  return _.map(txs, function(tx) {
    var inputs = _.map(tx.vin, function(item) {
      return {
        address: item.addr,
        amount: item.valueSat,
      }
    });

    var outputs = _.map(tx.vout, function(item) {
      var itemAddr;
      // If classic multisig, ignore
      if (item.scriptPubKey && item.scriptPubKey.addresses.length == 1) {
        itemAddr = item.scriptPubKey.addresses[0];
      }

      return {
        address: itemAddr,
        amount: parseInt((item.value * 1e8).toFixed(0)),
      }
    });

    return {
      txid: tx.txid,
      confirmations: tx.confirmations,
      fees: parseInt((tx.fees * 1e8).toFixed(0)),
      time: !_.isNaN(tx.time) ? tx.time : Math.floor(Date.now() / 1000),
      inputs: inputs,
      outputs: outputs,
    };
  });
};

/**
 * Retrieves all transactions (incoming & outgoing)
 * Times are in UNIX EPOCH
 *
 * @param {Object} opts
 * @param {Number} opts.skip (defaults to 0)
 * @param {Number} opts.limit
 * @returns {TxProposal[]} Transaction proposals, first newer
 */
WalletService.prototype.getTxHistory = function(opts, cb) {
  var self = this;

  function decorate(txs, addresses, proposals) {

    var indexedAddresses = _.indexBy(addresses, 'address');
    var indexedProposals = _.indexBy(proposals, 'txid');

    function sum(items, isMine, isChange) {
      var filter = {};
      if (_.isBoolean(isMine)) filter.isMine = isMine;
      if (_.isBoolean(isChange)) filter.isChange = isChange;
      return _.reduce(_.where(items, filter),
        function(memo, item) {
          return memo + item.amount;
        }, 0);
    };

    function classify(items) {
      return _.map(items, function(item) {
        var address = indexedAddresses[item.address];
        return {
          address: item.address,
          amount: item.amount,
          isMine: !!address,
          isChange: address ? address.isChange : false,
        }
      });
    };

    var now = Math.floor(Date.now() / 1000);

    return _.map(txs, function(tx) {
      var inputs = classify(tx.inputs);
      var outputs = classify(tx.outputs);

      var amountIn = sum(inputs, true);
      var amountOut = sum(outputs, true, false);
      var amountOutChange = sum(outputs, true, true);
      var amount, action, addressTo;
      if (amountIn == (amountOut + amountOutChange + (amountIn > 0 ? tx.fees : 0))) {
        amount = amountOut;
        action = 'moved';
      } else {
        amount = amountIn - amountOut - amountOutChange - (amountIn > 0 ? tx.fees : 0);
        action = amount > 0 ? 'sent' : 'received';
      }

      amount = Math.abs(amount);
      if (action == 'sent' || action == 'moved') {
        addressTo = outputs[0].address;
      };

      var newTx = {
        txid: tx.txid,
        action: action,
        amount: amount,
        fees: tx.fees,
        time: tx.time || now,
        addressTo: addressTo,
        confirmations: tx.confirmations,
      };

      var proposal = indexedProposals[tx.txid];
      if (proposal) {
        newTx.proposalId = proposal.id;
        newTx.creatorName = proposal.creatorName;
        newTx.message = proposal.message;
        newTx.actions = _.map(proposal.actions, function(action) {
          return _.pick(action, ['createdOn', 'type', 'copayerId', 'copayerName', 'comment']);
        });
        // newTx.sentTs = proposal.sentTs;
        // newTx.merchant = proposal.merchant;
        //newTx.paymentAckMemo = proposal.paymentAckMemo;
      }

      return newTx;
    });
  };

  function paginate(txs) {
    var skip = opts.skip || 0;
    var limited = _.isNumber(opts.limit) && opts.limit != -1;

    var sliced = _.slice(_.sortBy(txs, function(tx) {
      return -tx.time;
    }), skip);

    return limited ? _.take(sliced, opts.limit) : sliced;
  };

  // Get addresses for this wallet
  self.storage.fetchAddresses(self.walletId, function(err, addresses) {
    if (err) return cb(err);
    if (addresses.length == 0) return cb(null, []);

    var addressStrs = _.pluck(addresses, 'address');
    var networkName = Bitcore.Address(addressStrs[0]).toObject().network;

    var bc = self._getBlockchainExplorer('insight', networkName);
    async.parallel([

      function(next) {
        self.storage.fetchTxs(self.walletId, opts, function(err, txps) {
          if (err) return next(err);
          next(null, txps);
        });
      },
      function(next) {
        bc.getTransactions(addressStrs, null, null, function(err, txs) {
          if (err) return next(err);

          next(null, self._normalizeTxHistory(txs));
        });
      },
    ], function(err, res) {
      if (err) return cb(err);

      var proposals = res[0];
      var txs = res[1];

      txs = paginate(decorate(txs, addresses, proposals));

      return cb(null, txs);
    });
  });
};


WalletService.scanConfig = {
  SCAN_WINDOW: 20,
  DERIVATION_DELAY: 10, // in milliseconds
};

/**
 * Scan the blockchain looking for addresses having some activity
 *
 * @param {Object} opts
 * @param {Boolean} opts.includeCopayerBranches (defaults to false)
 */
WalletService.prototype.scan = function(opts, cb) {
  var self = this;

  opts = opts || {};

  function deriveAddresses(size, derivator, cb) {
    async.mapSeries(_.range(size), function(i, next) {
      setTimeout(function() {
        next(null, derivator());
      }, WalletService.scanConfig.DERIVATION_DELAY)
    }, cb);
  };

  function checkActivity(addresses, cb) {
    var bc = self._getBlockchainExplorer();
    bc.getAddressActivity(addresses, cb);
  };

  function scanBranch(derivator, cb) {
    var activity = true;
    var allAddresses = [];
    async.whilst(function() {
      return activity;
    }, function(next) {
      deriveAddresses(WalletService.scanConfig.SCAN_WINDOW, derivator, function(err, addresses) {
        if (err) return next(err);
        allAddresses.push(addresses);
        checkActivity(_.pluck(addresses, 'address'), function(err, thereIsActivity) {
          if (err) return next(err);
          activity = thereIsActivity;
          next();
        });
      });
    }, function(err) {
      return cb(err, _.flatten(allAddresses));
    });
  };


  Utils.runLocked(self.walletId, cb, function(cb) {
    self.getWallet({}, function(err, wallet) {
      if (err) return cb(err);
      if (!wallet.isComplete()) return cb(new ClientError('Wallet is not complete'));

      var derivators = [];
      _.each([false, true], function(isChange) {
        derivators.push(_.bind(wallet.createAddress, wallet, isChange));
        if (opts.includeCopayerBranches) {
          _.each(wallet.copayers, function(copayer) {
            derivators.push(_.bind(copayer.createAddress, copayer, wallet, isChange));
          });
        }
      });

      async.eachSeries(derivators, function(derivator, next) {
        scanBranch(derivator, function(err, addresses) {
          if (err) return next(err);
          self.storage.storeAddressAndWallet(wallet, addresses, next);
        });
      }, cb);
    });
  });
};

/**
 * Start a scan process.
 *
 * @param {Object} opts
 * @param {Boolean} opts.includeCopayerBranches (defaults to false)
 */
WalletService.prototype.startScan = function(opts, cb) {
  var self = this;

  function scanFinished(err) {
    var data = {};
    if (err) {
      data.result = 'error';
      data.error = err;
    } else {
      data.result = 'success';
    }
    self._notify('ScanFinished', data, true);
  };

  self.getWallet({}, function(err, wallet) {
    if (err) return cb(err);
    if (!wallet.isComplete()) return cb(new ClientError('Wallet is not complete'));

    setTimeout(function() {
      self.scan(opts, scanFinished);
    }, 100);

    return cb(null, {
      started: true
    });
  });
};


module.exports = WalletService;
module.exports.ClientError = ClientError;
