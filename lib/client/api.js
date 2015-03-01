'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var util = require('util');
var async = require('async');
var log = require('npmlog');
var request = require('request')
var events = require('events');
log.debug = log.verbose;
var Bitcore = require('bitcore')
var sjcl = require('sjcl');

var Credentials = require('./credentials');
var WalletUtils = require('../walletutils');
var Verifier = require('./verifier');
var ServerCompromisedError = require('./servercompromisederror');
var ClientError = require('../clienterror');

var BASE_URL = 'http://localhost:3001/copay/api';
var WALLET_ENCRYPTION_OPTS = {
  iter: 5000
};

function _encryptMessage(message, encryptingKey) {
  if (!message) return null;
  return WalletUtils.encryptMessage(message, encryptingKey);
};

function _decryptMessage(message, encryptingKey) {
  if (!message) return '';
  try {
    return WalletUtils.decryptMessage(message, encryptingKey);
  } catch (ex) {
    return '<ECANNOTDECRYPT>';
  }
};

function _processTxps(txps, encryptingKey) {
  if (!txps) return;
  _.each([].concat(txps), function(txp) {
    txp.encryptedMessage = txp.message;
    txp.message = _decryptMessage(txp.message, encryptingKey);
    _.each(txp.actions, function(action) {
      action.comment = _decryptMessage(action.comment, encryptingKey);
    });
  });
};

function _parseError(body) {
  if (_.isString(body)) {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {
        error: body
      };
    }
  }
  var ret;
  if (body.code) {
    ret = new ClientError(body.code, body.message);
  } else {
    ret = {
      code: 'ERROR',
      error: body.error || 'There was an unknown error processing the request',
    };
  }
  log.error(ret);
  return ret;
};

function _signRequest(method, url, args, privKey) {
  var message = method.toLowerCase() + '|' + url + '|' + JSON.stringify(args);
  return WalletUtils.signMessage(message, privKey);
};

function API(opts) {
  opts = opts || {};

  this.verbose = !!opts.verbose;
  this.request = opts.request || request;
  this.baseUrl = opts.baseUrl || BASE_URL;
  this.basePath = this.baseUrl.replace(/http.?:\/\/[a-zA-Z0-9:-]*\//, '/');
  if (this.verbose) {
    log.level = 'debug';
  } else {
    log.level = 'info';
  }
};

util.inherits(API, events.EventEmitter);

API.prototype.seedFromExtendedPrivateKey = function(xPrivKey) {
  this.credentials = Credentials.seedFromExtendedPrivateKey(xPrivKey);
};

API.prototype.seedFromAirGapped = function(seed) {
  this.credentials = Credentials.fromExtendedPublicKey(seed.xPubKey, seed.requestPrivKey);
};

/**
 * export
 *
 * @param opts
 * @param opts.compressed
 * @param opts.password
 */
API.prototype.export = function(opts) {
  $.checkState(this.credentials);

  opts = opts || {};

  var output;
  if (opts.compressed) {
    output = this.credentials.exportCompressed();
  } else {
    output = JSON.stringify(this.credentials.toObj());
  }

  if (opts.password) {
    output = sjcl.encrypt(opts.password, output, WALLET_ENCRYPTION_OPTS);
  }

  return output;
}


/**
 * export
 *
 * @param opts
 * @param opts.compressed
 * @param opts.password
 */
API.prototype.import = function(str, opts) {
  opts = opts || {};

  var input = str;
  if (opts.password) {
    try {
      input = sjcl.decrypt(opts.password, input);
    } catch (ex) {
      throw new Error('Incorrect password');
    }
  }

  var credentials;
  try {
    if (opts.compressed) {
      credentials = Credentials.importCompressed(input);
      // TODO: complete missing fields that live on the server only such as: walletId, walletName, copayerName
    } else {
      credentials = Credentials.fromObj(JSON.parse(input));
    }
  } catch (ex) {
    throw new Error('Error importing from source');
  }
  this.credentials = credentials;
};

API.prototype.toString = function(password) {
  $.checkState(this.credentials);
  return this.credentials.toObject();
};

API.prototype.fromString = function(str) {
  this.credentials = Credentials.fromObject(str);
};

API.prototype._doRequest = function(method, url, args, cb) {
  $.checkState(this.credentials);

  var reqSignature;

  if (this.credentials.requestPrivKey) {
    reqSignature = _signRequest(method, url, args, this.credentials.requestPrivKey);
  }

  var absUrl = this.baseUrl + url;
  var args = {
    // relUrl: only for testing with `supertest`
    relUrl: this.basePath + url,
    headers: {
      'x-identity': this.credentials.copayerId,
      'x-signature': reqSignature,
    },
    method: method,
    url: absUrl,
    body: args,
    json: true,
  };

  log.verbose('Request Args', util.inspect(args, {
    depth: 10
  }));
  this.request(args, function(err, res, body) {
    log.verbose(util.inspect(body, {
      depth: 10
    }));
    if (err) return cb(err);

    if (res.statusCode != 200) {
      return cb(_parseError(body));
    }

    return cb(null, body, res.header);
  });
};


API.prototype._doPostRequest = function(url, args, cb) {
  return this._doRequest('post', url, args, cb);
};

API.prototype._doGetRequest = function(url, cb) {
  return this._doRequest('get', url, {}, cb);
};

API.prototype._doDeleteRequest = function(url, cb) {
  return this._doRequest('delete', url, {}, cb);
};

API.prototype._doJoinWallet = function(walletId, walletPrivKey, xPubKey, copayerName, cb) {
  var args = {
    walletId: walletId,
    name: copayerName,
    xPubKey: xPubKey,
    xPubKeySignature: WalletUtils.signMessage(xPubKey, walletPrivKey),
  };
  var url = '/v1/wallets/' + walletId + '/copayers';
  this._doPostRequest(url, args, function(err, body) {
    if (err) return cb(err);
    return cb(null, body.wallet);
  });
};

API.prototype.isComplete = function() {
  return this.credentials && this.credentials.isComplete();
};

/**
 * Opens a wallet and tries to complete the public key ring.
 * @param {Function} cb - Returns an error and a flag indicating that the wallet has just been completed and needs to be persisted
 */
API.prototype.openWallet = function(cb) {
  $.checkState(this.credentials);

  var self = this;

  if (self.credentials.isComplete()) return cb(null, false);

  self._doGetRequest('/v1/wallets/', function(err, ret) {
    if (err) return cb(err);
    var wallet = ret.wallet;

    if (wallet.status != 'complete')
      return cb('Wallet Incomplete');

    if (!Verifier.checkCopayers(self.credentials, wallet.copayers)) {
      return cb(new ServerCompromisedError(
        'Copayers in the wallet could not be verified to have known the wallet secret'));
    }

    self.credentials.addPublicKeyRing(_.pluck(wallet.copayers, 'xPubKey'));
    return cb(null, true);
  });
};

API.prototype.createWallet = function(walletName, copayerName, m, n, network, cb) {
  var self = this;

  network = network || 'livenet';
  if (!_.contains(['testnet', 'livenet'], network)) return cb('Invalid network');

  if (!self.credentials) {
    log.info('Generating new keys');
    self.credentials = Credentials.create(network);
  } else {
    log.info('Using existing keys');
  }

  $.checkState(network == self.credentials.network);

  var walletPrivKey = new Bitcore.PrivateKey();
  var args = {
    name: walletName,
    m: m,
    n: n,
    pubKey: walletPrivKey.toPublicKey().toString(),
    network: network,
  };

  self._doPostRequest('/v1/wallets/', args, function(err, body) {
    if (err) return cb(err);

    var walletId = body.walletId;

    var secret = WalletUtils.toSecret(walletId, walletPrivKey, network);
    self.credentials.addWalletInfo(walletId, walletName, m, n, walletPrivKey.toString(), copayerName);

    self._doJoinWallet(walletId, walletPrivKey, self.credentials.xPubKey, copayerName,
      function(err, wallet) {
        if (err) return cb(err);
        return cb(null, n > 1 ? secret : null);
      });
  });
};

API.prototype.joinWallet = function(secret, copayerName, cb) {
  var self = this;

  try {
    var secretData = WalletUtils.fromSecret(secret);
  } catch (ex) {
    return cb(ex);
  }

  if (!self.credentials) {
    self.credentials = Credentials.create(secretData.network);
  }

  self._doJoinWallet(secretData.walletId, secretData.walletPrivKey, self.credentials.xPubKey, copayerName,
    function(err, wallet) {
      if (err) return cb(err);
      self.credentials.addWalletInfo(wallet.id, wallet.name, wallet.m, wallet.n, secretData.walletPrivKey, copayerName);
      return cb(null, wallet);
    });
};

API.prototype.getStatus = function(cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  var self = this;

  self._doGetRequest('/v1/wallets/', function(err, result) {
    _processTxps(result.pendingTxps, self.credentials.sharedEncryptingKey);
    return cb(err, result, self.credentials.copayerId);
  });
};

/**
 * send
 *
 * @param opts
 * @param opts.toAddress
 * @param opts.amount
 * @param opts.message
 */
API.prototype.sendTxProposal = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(opts);
  $.shouldBeNumber(opts.amount);

  var self = this;

  var args = {
    toAddress: opts.toAddress,
    amount: opts.amount,
    message: _encryptMessage(opts.message, self.credentials.sharedEncryptingKey),
  };
  var hash = WalletUtils.getProposalHash(args.toAddress, args.amount, args.message);
  args.proposalSignature = WalletUtils.signMessage(hash, self.credentials.requestPrivKey);
  log.debug('Generating & signing tx proposal hash -> Hash: ', hash, ' Signature: ', args.proposalSignature);

  self._doPostRequest('/v1/txproposals/', args, function(err, txp) {
    if (err) return cb(err);
    return cb(null, txp);
  });
};

API.prototype.createAddress = function(cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;

  self._doPostRequest('/v1/addresses/', {}, function(err, address) {
    if (err) return cb(err);
    if (!Verifier.checkAddress(self.credentials, address)) {
      return cb(new ServerCompromisedError('Server sent fake address'));
    }

    return cb(null, address);
  });
};

/*
 * opts.doNotVerify
 */

API.prototype.getMainAddresses = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;

  self._doGetRequest('/v1/addresses/', function(err, addresses) {
    if (err) return cb(err);

    if (!opts.doNotVerify) {
      var fake = _.any(addresses, function(address) {
        return !Verifier.checkAddress(self.credentials, address);
      });
      if (fake)
        return cb(new ServerCompromisedError('Server sent fake address'));
    }
    return cb(null, addresses);
  });
};

API.prototype.getBalance = function(cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  var self = this;

  self._doGetRequest('/v1/balance/', cb);
};


/**
 *
 * opts.doNotVerify
 * opts.forAirGapped
 * @return {undefined}
 */

API.prototype.getTxProposals = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;

  self._doGetRequest('/v1/txproposals/', function(err, txps) {
    if (err) return cb(err);

    _processTxps(txps, self.credentials.sharedEncryptingKey);

    var fake = _.any(txps, function(txp) {
      return (!opts.doNotVerify && !Verifier.checkTxProposal(self.credentials, txp));
    });

    if (fake)
      return cb(new ServerCompromisedError('Server sent fake transaction proposal'));

    var result;
    if (opts.forAirGapped) {
      result = {
        txps: JSON.parse(JSON.stringify(txps)),
        publicKeyRing: WalletUtils.encryptMessage(JSON.stringify(self.credentials.publicKeyRing), self.credentials.personalEncryptingKey),
        m: self.credentials.m,
        n: self.credentials.n,
      };
    } else {
      result = txps;
    }

    return cb(null, result);
  });
};

API.prototype.getSignatures = function(txp, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(txp.creatorId);

  var self = this;

  if (!self.credentials.canSign())
    return cb('You do not have the required keys to sign transactions');

  if (!Verifier.checkTxProposal(self.credentials, txp)) {
    return cb(new ServerCompromisedError('Transaction proposal is invalid'));
  }

  return cb(null, WalletUtils.signTxp(txp, self.credentials.xPrivKey));
};

API.prototype.signTxProposal = function(txp, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(txp.creatorId);

  var self = this;

  if (!self.credentials.canSign() && !txp.signatures)
    return cb(new Error('You do not have the required keys to sign transactions'));

  if (!Verifier.checkTxProposal(self.credentials, txp)) {
    return cb(new ServerCompromisedError('Server sent fake transaction proposal'));
  }

  var signatures = txp.signatures || WalletUtils.signTxp(txp, self.credentials.xPrivKey);

  var url = '/v1/txproposals/' + txp.id + '/signatures/';
  var args = {
    signatures: signatures
  };

  self._doPostRequest(url, args, function(err, txp) {
    if (err) return cb(err);
    return cb(null, txp);
  });
};

API.prototype.rejectTxProposal = function(txp, reason, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());
  $.checkArgument(cb);

  var self = this;

  var url = '/v1/txproposals/' + txp.id + '/rejections/';
  var args = {
    reason: _encryptMessage(reason, self.credentials.sharedEncryptingKey) || '',
  };
  self._doPostRequest(url, args, function(err, txp) {
    if (err) return cb(err);
    return cb(null, txp);
  });
};

API.prototype.broadcastTxProposal = function(txp, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;

  var url = '/v1/txproposals/' + txp.id + '/broadcast/';
  self._doPostRequest(url, {}, function(err, txp) {
    if (err) return cb(err);
    return cb(null, txp);
  });
};



API.prototype.removeTxProposal = function(txp, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;

  var url = '/v1/txproposals/' + txp.id;
  self._doDeleteRequest(url, function(err) {
    if (err) return cb(err);
    return cb();
  });
};

API.prototype.getTxHistory = function(opts, cb) {
  $.checkState(this.credentials && this.credentials.isComplete());

  var self = this;

  self._doGetRequest('/v1/txhistory/', function(err, txs) {
    if (err) return cb(err);

    _processTxps(txs, self.credentials.sharedEncryptingKey);

    return cb(null, txs);
  });
};

module.exports = API;
