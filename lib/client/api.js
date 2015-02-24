'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var util = require('util');
var async = require('async');
var log = require('npmlog');
var request = require('request')
log.debug = log.verbose;

var Bitcore = require('bitcore')
var WalletUtils = require('../walletutils');
var Verifier = require('./verifier');
var ServerCompromisedError = require('./servercompromisederror');
var ClientError = require('../clienterror');

var BASE_URL = 'http://localhost:3001/copay/api';

var WALLET_CRITICAL_DATA = ['xPrivKey', 'm', 'n', 'publicKeyRing', 'sharedEncryptingKey'];
var WALLET_EXTRA_DATA = ['copayerId', 'roPrivKey', 'rwPrivKey'];

var WALLET_AIRGAPPED_TOCOMPLETE = ['publicKeyRing', 'm', 'n', 'sharedEncryptingKey'];

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

function _initWcd(network) {
  $.checkArgument(network);
  var xPrivKey = new Bitcore.HDPrivateKey(network);
  var xPubKey = (new Bitcore.HDPublicKey(xPrivKey)).toString();
  var roPrivKey = xPrivKey.derive('m/1/0').privateKey;
  var rwPrivKey = xPrivKey.derive('m/1/1').privateKey;
  var copayerId = WalletUtils.xPubToCopayerId(xPubKey);


  return {
    copayerId: copayerId,
    xPrivKey: xPrivKey.toString(),
    publicKeyRing: [xPubKey],
    network: network,
    roPrivKey: roPrivKey.toWIF(),
    rwPrivKey: rwPrivKey.toWIF(),
  };
};

function _addWalletToWcd(wcd, walletPrivKey, m, n) {
  $.checkArgument(wcd);
  var sharedEncryptingKey = WalletUtils.privateKeyToAESKey(walletPrivKey);

  wcd.walletPrivKey = walletPrivKey.toWIF();
  wcd.sharedEncryptingKey = sharedEncryptingKey;
  wcd.m = m;
  wcd.n = n;
};

function API(opts) {
  if (!opts.storage) {
    throw new Error('Must provide storage option');
  }
  this.storage = opts.storage;
  this.verbose = !!opts.verbose;
  this.request = request || opts.request;
  this.baseUrl = opts.baseUrl || BASE_URL;
  this.basePath = this.baseUrl.replace(/http.?:\/\/[a-zA-Z0-9:-]*\//, '/');
  if (this.verbose) {
    log.level = 'debug';
  } else {
    log.level = 'info';
  }
};

API.prototype._tryToCompleteFromServer = function(wcd, cb) {

  if (!wcd.walletPrivKey)
    return cb('Could not perform that action. Wallet Incomplete');

  var self = this;
  var url = '/v1/wallets/';
  self._doGetRequest(url, wcd, function(err, ret) {
    if (err) return cb(err);
    var wallet = ret.wallet;

    if (wallet.status != 'complete')
      return cb('Wallet Incomplete');

    if (!Verifier.checkCopayers(wallet.copayers, wcd.walletPrivKey,
      wcd.xPrivKey, wcd.n)) {

      return cb(new ServerCompromisedError(
        'Copayers in the wallet could not be verified to have known the wallet secret'));
    }

    wcd.publicKeyRing = _.pluck(wallet.copayers, 'xPubKey')

    self.storage.save(wcd, function(err) {
      return cb(err, wcd);
    });
  });
};


API.prototype._tryToCompleteFromData = function(wcd, toComplete, cb) {
  var inData = _decryptMessage(toComplete,
    WalletUtils.privateKeyToAESKey(wcd.roPrivKey));
  if (!inData)
    return cb('Could not complete wallet');

  try {
    inData = JSON.parse(inData);
    _.extend(wcd, _.pick(inData, WALLET_AIRGAPPED_TOCOMPLETE));
  } catch (ex) {
    return cb(ex);
  }

  this.storage.save(wcd, function(err) {
    return cb(err, wcd);
  });
};


API.prototype._tryToComplete = function(opts, wcd, cb) {
  if (opts.toComplete) {
    this._tryToCompleteFromData(wcd, opts.toComplete, cb);
  } else {
    this._tryToCompleteFromServer(wcd, cb);
  }
};



API.prototype._load = function(cb) {
  var self = this;

  this.storage.load(function(err, wcd) {
    if (err || !wcd) {
      return cb(err || 'wcd file not found.');
    }
    return cb(null, wcd);
  });
};


/**
 * _loadAndCheck
 *
 * @param opts.pkr
 */
API.prototype._loadAndCheck = function(opts, cb) {
  var self = this;

  this._load(function(err, wcd) {
    if (err) return cb(err);

    if (!wcd.n || (wcd.n > 1 && wcd.publicKeyRing.length != wcd.n)) {
      return self._tryToComplete(opts, wcd, cb);
    }

    return cb(null, wcd);
  });
};

API.prototype._doRequest = function(method, url, args, wcd, cb) {
  var reqSignature;
  wcd = wcd || {};

  if (method == 'get') {
    if (wcd.roPrivKey)
      reqSignature = _signRequest(method, url, args, wcd.roPrivKey);
  } else {
    if (wcd.rwPrivKey)
      reqSignature = _signRequest(method, url, args, wcd.rwPrivKey);
  }

  var absUrl = this.baseUrl + url;
  var args = {
    // relUrl: only for testing with `supertest`
    relUrl: this.basePath + url,
    headers: {
      'x-identity': wcd.copayerId,
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


API.prototype._doPostRequest = function(url, args, wcd, cb) {
  return this._doRequest('post', url, args, wcd, cb);
};

API.prototype._doGetRequest = function(url, wcd, cb) {
  return this._doRequest('get', url, {}, wcd, cb);
};


API.prototype._doJoinWallet = function(walletId, walletPrivKey, xPubKey, copayerName, cb) {
  var args = {
    walletId: walletId,
    name: copayerName,
    xPubKey: xPubKey,
    xPubKeySignature: WalletUtils.signMessage(xPubKey, walletPrivKey),
  };
  var url = '/v1/wallets/' + walletId + '/copayers';
  this._doPostRequest(url, args, {}, function(err, body) {
    if (err) return cb(err);
    return cb(null, body.wallet);
  });
};

API.prototype.generateKey = function(network, cb) {
  var self = this;
  network = network || 'livenet';
  if (!_.contains(['testnet', 'livenet'], network))
    return cb('Invalid network');

  this.storage.load(function(err, wcd) {
    if (wcd)
      return cb(self.storage.getName() + ' already contains a wallet');

    var wcd = _initWcd(network);
    self.storage.save(wcd, function(err) {
      return cb(err, null);
    });
  });
};

API.prototype.createWallet = function(walletName, copayerName, m, n, network, cb) {
  var self = this;
  network = network || 'livenet';
  if (!_.contains(['testnet', 'livenet'], network))
    return cb('Invalid network');

  this.storage.load(function(err, wcd) {
    if (wcd && wcd.n)
      return cb(self.storage.getName() + ' already contains a wallet');

    if (wcd && wcd.network && wcd.network != network)
      return cb('Storage ' + self.storage.getName() + ' is set to network:' + wcd.network);

    var walletPrivKey = new Bitcore.PrivateKey();
    var args = {
      name: walletName,
      m: m,
      n: n,
      pubKey: walletPrivKey.toPublicKey().toString(),
      network: network,
    };
    var url = '/v1/wallets/';
    self._doPostRequest(url, args, {}, function(err, body) {
      if (err) return cb(err);

      var walletId = body.walletId;

      var secret = WalletUtils.toSecret(walletId, walletPrivKey, network);

      wcd = wcd || _initWcd(network);
      _addWalletToWcd(wcd, walletPrivKey, m, n)

      self._doJoinWallet(walletId, walletPrivKey, wcd.publicKeyRing[0], copayerName,
        function(err, wallet) {
          if (err) return cb(err);
          self.storage.save(wcd, function(err) {
            return cb(err, n > 1 ? secret : null);
          });
        });
    });
  });
};


API.prototype.reCreateWallet = function(walletName, cb) {
  var self = this;
  this._loadAndCheck({}, function(err, wcd) {
    if (err) return cb(err);

    var walletPrivKey = new Bitcore.PrivateKey();
    var args = {
      name: walletName,
      m: wcd.m,
      n: wcd.n,
      pubKey: walletPrivKey.toPublicKey().toString(),
      network: wcd.network,
    };
    var url = '/v1/wallets/';
    self._doPostRequest(url, args, {}, function(err, body) {
      if (err) return cb(err);

      var walletId = body.walletId;

      var secret = WalletUtils.toSecret(walletId, walletPrivKey, wcd.network);
      var i = 0;
      async.each(wcd.publicKeyRing, function(xpub, next) {
        var copayerName = 'recovered Copayer #' + i;
        self._doJoinWallet(walletId, walletPrivKey, wcd.publicKeyRing[i++], copayerName, next);
      }, function(err) {
        return cb(err);
      });
    });
  });
};


API.prototype.joinWallet = function(secret, copayerName, cb) {
  var self = this;

  this.storage.load(function(err, wcd) {
    if (wcd && wcd.n)
      return cb(self.storage.getName() + ' already contains a wallet');

    try {
      var secretData = WalletUtils.fromSecret(secret);
    } catch (ex) {
      return cb(ex);
    }
    wcd = wcd || _initWcd(secretData.network);

    self._doJoinWallet(secretData.walletId, secretData.walletPrivKey, wcd.publicKeyRing[0], copayerName,
      function(err, joinedWallet) {
        if (err) return cb(err);
        _addWalletToWcd(wcd, secretData.walletPrivKey, joinedWallet.m, joinedWallet.n);
        self.storage.save(wcd, cb);
      });
  });
};

API.prototype.getStatus = function(cb) {
  var self = this;

  this._load(function(err, wcd) {
    if (err) return cb(err);

    var url = '/v1/wallets/';
    self._doGetRequest(url, wcd, function(err, result) {
      _processTxps(result.pendingTxps, wcd.sharedEncryptingKey);
      return cb(err, result, wcd.copayerId);
    });
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
  $.checkArgument(opts);
  $.shouldBeNumber(opts.amount);

  var self = this;

  this._loadAndCheck({}, function(err, wcd) {
    if (err) return cb(err);

    if (!wcd.rwPrivKey)
      return cb('No key to generate proposals');

    var args = {
      toAddress: opts.toAddress,
      amount: opts.amount,
      message: _encryptMessage(opts.message, wcd.sharedEncryptingKey),
    };
    var hash = WalletUtils.getProposalHash(args.toAddress, args.amount, args.message);
    args.proposalSignature = WalletUtils.signMessage(hash, wcd.rwPrivKey);
    log.debug('Generating & signing tx proposal hash -> Hash: ', hash, ' Signature: ', args.proposalSignature);

    var url = '/v1/txproposals/';
    self._doPostRequest(url, args, wcd, cb);
  });
};

API.prototype.createAddress = function(cb) {
  var self = this;

  this._loadAndCheck({}, function(err, wcd) {
    if (err) return cb(err);

    var url = '/v1/addresses/';
    self._doPostRequest(url, {}, wcd, function(err, address) {
      if (err) return cb(err);
      if (!Verifier.checkAddress(wcd, address)) {
        return cb(new ServerCompromisedError('Server sent fake address'));
      }

      return cb(null, address);
    });
  });
};

/*
 * opts.doNotVerify
 */

API.prototype.getMainAddresses = function(opts, cb) {
  var self = this;

  this._loadAndCheck({}, function(err, wcd) {
    if (err) return cb(err);

    var url = '/v1/addresses/';
    self._doGetRequest(url, wcd, function(err, addresses) {
      if (err) return cb(err);

      if (!opts.doNotVerify) {
        var fake = _.any(addresses, function(address) {
          return !Verifier.checkAddress(wcd, address);
        });
        if (fake)
          return cb(new ServerCompromisedError('Server sent fake address'));
      }
      return cb(null, addresses);
    });
  });
};

API.prototype.getBalance = function(cb) {
  var self = this;

  this._loadAndCheck({}, function(err, wcd) {
    if (err) return cb(err);
    var url = '/v1/balance/';
    self._doGetRequest(url, wcd, cb);
  });
};

/**
 * Export does not try to complete the wallet from the server. Exports the
 * wallet as it is now.
 *
 * @param opts.access =['full', 'readonly', 'readwrite']
 */
API.prototype.export = function(opts, cb) {
  var self = this;
  $.shouldBeFunction(cb);
  opts = opts || {};
  var access = opts.access || 'full';

  this._load(function(err, wcd) {
    if (err) return cb(err);
    var v = [];

    var myXPubKey = (new Bitcore.HDPublicKey(wcd.xPrivKey)).toString();

    _.each(WALLET_CRITICAL_DATA, function(k) {
      var d;

      if (access != 'full' && k === 'xPrivKey') {
        v.push(null);
        return;
      }

      // Skips own pub key IF priv key is exported
      if (access == 'full' && k === 'publicKeyRing') {
        d = _.without(wcd[k], myXPubKey);
      } else {
        d = wcd[k];
      }
      v.push(d);
    });

    if (access != 'full') {
      v.push(wcd.copayerId);
      v.push(wcd.roPrivKey);
      if (access == 'readwrite') {
        v.push(wcd.rwPrivKey);
      }
    }

    return cb(null, JSON.stringify(v));
  });
}


API.prototype.import = function(str, cb) {
  var self = this;

  this.storage.load(function(err, wcd) {
    if (wcd)
      return cb('Storage already contains a wallet');

    wcd = {};

    var inData = JSON.parse(str);
    var i = 0;

    _.each(WALLET_CRITICAL_DATA.concat(WALLET_EXTRA_DATA), function(k) {
      wcd[k] = inData[i++];
    });

    if (wcd.xPrivKey) {
      var xpriv = new Bitcore.HDPrivateKey(wcd.xPrivKey);
      var xPubKey = new Bitcore.HDPublicKey(xpriv).toString();
      wcd.publicKeyRing.unshift(xPubKey);
      wcd.copayerId = WalletUtils.xPubToCopayerId(xPubKey);
      wcd.roPrivKey = xpriv.derive('m/1/0').privateKey.toWIF();
      wcd.rwPrivKey = xpriv.derive('m/1/1').privateKey.toWIF();
    }

    if (!wcd.publicKeyRing)
      return cb('Invalid source wallet');

    wcd.network = wcd.publicKeyRing[0].substr(0, 4) == 'tpub' ? 'testnet' : 'livenet';
    self.storage.save(wcd, function(err) {
      return cb(err, WalletUtils.accessFromData(wcd));
    });
  });
};

/**
 *
 */

API.prototype.parseTxProposals = function(txData, cb) {
  var self = this;

  this._loadAndCheck({
    toComplete: txData.toComplete
  }, function(err, wcd) {
    if (err) return cb(err);

    var txps = txData.txps;
    _processTxps(txps, wcd.sharedEncryptingKey);

    var fake = _.any(txps, function(txp) {
      return (!Verifier.checkTxProposal(wcd, txp));
    });

    if (fake)
      return cb(new ServerCompromisedError('Server sent fake transaction proposal'));

    return cb(null, txps);
  });
};



/**
 *
 * opts.doNotVerify
 * opts.getRawTxps
 * @return {undefined}
 */

API.prototype.getTxProposals = function(opts, cb) {
  var self = this;

  this._loadAndCheck({}, function(err, wcd) {
    if (err) return cb(err);
    var url = '/v1/txproposals/';
    self._doGetRequest(url, wcd, function(err, txps) {
      if (err) return cb(err);

      var rawTxps;
      if (opts.getRawTxps)
        rawTxps = JSON.parse(JSON.stringify(txps));

      _processTxps(txps, wcd.sharedEncryptingKey);

      var fake = _.any(txps, function(txp) {
        return (!opts.doNotVerify && !Verifier.checkTxProposal(wcd, txp));
      });

      if (fake)
        return cb(new ServerCompromisedError('Server sent fake transaction proposal'));

      return cb(null, txps, rawTxps);
    });
  });
};

API.prototype._getSignaturesFor = function(txp, wcd) {

  //Derive proper key to sign, for each input
  var privs = [],
    derived = {};

  var network = new Bitcore.Address(txp.toAddress).network.name;
  var xpriv = new Bitcore.HDPrivateKey(wcd.xPrivKey, network);

  _.each(txp.inputs, function(i) {
    if (!derived[i.path]) {
      derived[i.path] = xpriv.derive(i.path).privateKey;
      privs.push(derived[i.path]);
    }
  });

  var t = new Bitcore.Transaction();

  _.each(txp.inputs, function(i) {
    t.from(i, i.publicKeys, txp.requiredSignatures);
  });

  t.to(txp.toAddress, txp.amount)
    .change(txp.changeAddress.address);

  var signatures = _.map(privs, function(priv, i) {
    return t.getSignatures(priv);
  });

  signatures = _.map(_.sortBy(_.flatten(signatures), 'inputIndex'), function(s) {
    return s.signature.toDER().toString('hex');
  });

  return signatures;
};

API.prototype.getSignatures = function(txp, cb) {
  $.checkArgument(txp.creatorId);
  var self = this;

  this._loadAndCheck({}, function(err, wcd) {
    if (err) return cb(err);

    if (!Verifier.checkTxProposal(wcd, txp)) {
      return cb(new ServerCompromisedError('Transaction proposal is invalid'));
    }

    return cb(null, self._getSignaturesFor(txp, wcd));
  });
};

API.prototype.getEncryptedWalletData = function(cb) {
  var self = this;

  this._loadAndCheck({}, function(err, wcd) {
    if (err) return cb(err);
    var toComplete = JSON.stringify(_.pick(wcd, WALLET_AIRGAPPED_TOCOMPLETE));
    return cb(null, _encryptMessage(toComplete, WalletUtils.privateKeyToAESKey(wcd.roPrivKey)));
  });
};



API.prototype.signTxProposal = function(txp, cb) {
  $.checkArgument(txp.creatorId);

  var self = this;

  this._loadAndCheck({}, function(err, wcd) {
    if (err) return cb(err);

    if (!Verifier.checkTxProposal(wcd, txp)) {
      return cb(new ServerCompromisedError('Server sent fake transaction proposal'));
    }

    var signatures = txp.signatures || self._getSignaturesFor(txp, wcd);

    var url = '/v1/txproposals/' + txp.id + '/signatures/';
    var args = {
      signatures: signatures
    };

    self._doPostRequest(url, args, wcd, cb);
  });
};

API.prototype.rejectTxProposal = function(txp, reason, cb) {
  $.checkArgument(cb);

  var self = this;

  this._loadAndCheck({},
    function(err, wcd) {
      if (err) return cb(err);

      var url = '/v1/txproposals/' + txp.id + '/rejections/';
      var args = {
        reason: _encryptMessage(reason, wcd.sharedEncryptingKey) || '',
      };
      self._doPostRequest(url, args, wcd, cb);
    });
};

API.prototype.broadcastTxProposal = function(txp, cb) {
  var self = this;

  this._loadAndCheck({},
    function(err, wcd) {
      if (err) return cb(err);

      var url = '/v1/txproposals/' + txp.id + '/broadcast/';
      self._doPostRequest(url, {}, wcd, cb);
    });
};



API.prototype.removeTxProposal = function(txp, cb) {
  var self = this;
  this._loadAndCheck({},
    function(err, wcd) {
      if (err) return cb(err);
      var url = '/v1/txproposals/' + txp.id;
      self._doRequest('delete', url, {}, wcd, cb);
    });
};

API.prototype.getTxHistory = function(opts, cb) {
  var self = this;

  this._loadAndCheck({}, function(err, wcd) {
    if (err) return cb(err);
    var url = '/v1/txhistory/';
    self._doGetRequest(url, wcd, function(err, txs) {
      if (err) return cb(err);

      _processTxps(txs, wcd.sharedEncryptingKey);

      return cb(null, txs);
    });
  });
};

module.exports = API;
