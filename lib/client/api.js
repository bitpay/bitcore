'use strict';

var _ = require('lodash');
var util = require('util');
var async = require('async');
var log = require('npmlog');
var request = require('request')
log.debug = log.verbose;

var Bitcore = require('bitcore')
var SignUtils = require('../signutils');
var Verifier = require('./verifier');
var ServerCompromisedError = require('./servercompromisederror')

var BASE_URL = 'http://localhost:3001/copay/api';

function _createProposalOpts(opts, signingKey) {
  var msg = opts.toAddress + '|' + opts.amount + '|' + opts.message;
  opts.proposalSignature = SignUtils.sign(msg, signingKey);
  return opts;
};

function _getUrl(path) {
  return BASE_URL + path;
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
  var code = body.code || 'ERROR';
  var message = body.error || 'There was an unknown error processing the request';
  log.error(code, message);
};

function _signRequest(method, url, args, privKey) {
  var message = method.toLowerCase() + '|' + url + '|' + JSON.stringify(args);
  return SignUtils.sign(message, privKey);
};

function _createXPrivKey(network) {
  return new Bitcore.HDPrivateKey(network).toString();
};

function API(opts) {
  if (!opts.storage) {
    throw new Error('Must provide storage option');
  }
  this.storage = opts.storage;
  this.verbose = !!opts.verbose;
  this.request = request || opts.request;
  if (this.verbose) {
    log.level = 'debug';
  }
};


API.prototype._loadAndCheck = function() {
  var data = this.storage.load();
  if (!data) {
    log.error('Wallet file not found.');
    process.exit(1);
  }

  if (data.verified == 'corrupt') {
    log.error('The wallet is tagged as corrupt. Some of the copayers cannot be verified to have known the wallet secret.');
    process.exit(1);
  }
  if (data.n > 1) {
    var pkrComplete = data.publicKeyRing && data.m && data.publicKeyRing.length === data.n;
    if (!pkrComplete) {
      log.warn('The file ' + this.filename + ' is incomplete. It will allow you to operate with the wallet but it should not be trusted as a backup. Please wait for all copayers to join the wallet and run the tool with -export flag.')
    }
  }
  return data;
};

API.prototype._doRequest = function(method, url, args, data, cb) {
  var reqSignature = _signRequest(method, url, args, data.signingPrivKey);
  var absUrl = _getUrl(url);
  var args = {
    headers: {
      'x-identity': data.copayerId,
      'x-signature': reqSignature,
    },
    method: method,
    url: absUrl,
    body: args,
    json: true,
  };
  log.verbose('Request Args', util.inspect(args));
  this.request(args, function(err, res, body) {
    log.verbose('Response:', err, body);

    if (err) return cb(err);
    if (res.statusCode != 200) {
      _parseError(body);
      return cb('Request error');
    }

    return cb(null, body);
  });
};


API.prototype._doPostRequest = function(url, args, data, cb) {
  return this._doRequest('post', url, args, data, cb);
};

API.prototype._doGetRequest = function(url, data, cb) {
  return this._doRequest('get', url, {}, data, cb);
};



API.prototype.createWallet = function(walletName, copayerName, m, n, network, cb) {
  var self = this;
  network = network || 'livenet';
  if (!_.contains(['testnet', 'livenet'], network))
    return cb('Invalid network');

  var data = this.storage.load();
  if (data) return cb('File ' + this.filename + ' already contains a wallet');

  // Generate wallet key pair to verify copayers
  var privKey = new Bitcore.PrivateKey(null, network);
  var pubKey = privKey.toPublicKey();

  data = {
    m: m,
    n: n,
    walletPrivKey: privKey.toString(),
    network: network,
  };

  var args = {
    name: walletName,
    m: m,
    n: n,
    pubKey: pubKey.toString(),
    network: network,
  };
  var url = '/v1/wallets/';

  this._doPostRequest(url, args, data, function(err, body) {
    if (err) return cb(err);

    var walletId = body.walletId;
    var secret = walletId + ':' + privKey.toString() + ':' + (network == 'testnet' ? 'T' : 'L');
    var ret;

    if (n > 1)
      ret = data.secret = secret;

    self.storage.save(data);
    self._joinWallet(data, secret, copayerName, function(err) {
      if (err) return cb(err);

      return cb(null, ret);
    });
  });
};

API.prototype._joinWallet = function(data, secret, copayerName, cb) {
  var self = this;
  data = data || {};

  var secretSplit = secret.split(':');
  var walletId = secretSplit[0];

  var walletPrivKey = Bitcore.PrivateKey.fromString(secretSplit[1]);
  var network = secretSplit[2] == 'T' ? 'testnet' : 'livenet';
  data.xPrivKey = _createXPrivKey(network);

  var xPubKey = new Bitcore.HDPublicKey(data.xPrivKey);
  var xPubKeySignature = SignUtils.sign(xPubKey.toString(), walletPrivKey);

  var signingPrivKey = (new Bitcore.HDPrivateKey(data.xPrivKey)).derive('m/1/0').privateKey;
  var args = {
    walletId: walletId,
    name: copayerName,
    xPubKey: xPubKey.toString(),
    xPubKeySignature: xPubKeySignature,
  };
  var url = '/v1/wallets/' + walletId + '/copayers';

  this._doPostRequest(url, args, data, function(err, body) {
    var wallet = body.wallet;
    data.copayerId = body.copayerId;
    data.walletPrivKey = walletPrivKey;
    data.signingPrivKey = signingPrivKey.toString();
    data.m = wallet.m;
    data.n = wallet.n;
    data.publicKeyRing = wallet.publicKeyRing;
    self.storage.save(data);

    return cb();
  });
};

API.prototype.joinWallet = function(secret, copayerName, cb) {
  var self = this;

  var data = this.storage.load();
  if (data) return cb('File ' + this.filename + ' already contains a wallet');

  self._joinWallet(data, secret, copayerName, cb);
};

API.prototype.getStatus = function(cb) {
  var self = this;

  var data = this._loadAndCheck();

  var url = '/v1/wallets/';
  this._doGetRequest(url, data, function(err, body) {
    if (err) return cb(err);

    var wallet = body;
    if (wallet.n > 0 && wallet.status === 'complete' && !data.verified) {
      var pubKey = Bitcore.PrivateKey.fromString(data.walletPrivKey).toPublicKey().toString();
      var fake = [];
      _.each(wallet.copayers, function(copayer) {


        console.log('[clilib.js.224]', copayer.xPubKey, copayer.xPubKeySignature, pubKey); //TODO
        if (!SignUtils.verify(copayer.xPubKey, copayer.xPubKeySignature, pubKey)) {

          console.log('[clilib.js.227] FAKE'); //TODO
          fake.push(copayer);
        }
      });
      if (fake.length > 0) {
        log.error('Some copayers in the wallet could not be verified to have known the wallet secret');
        data.verified = 'corrupt';
      } else {
        data.verified = 'ok';
      }
      self.storage.save(data);
    }

    return cb(null, wallet);
  });
};

/**
 * send
 *
 * @param inArgs
 * @param inArgs.toAddress
 * @param inArgs.amount
 * @param inArgs.message
 */
API.prototype.sendTxProposal = function(inArgs, cb) {
  var self = this;

  var data = this._loadAndCheck();
  var args = _createProposalOpts(inArgs, data.signingPrivKey);

  var url = '/v1/txproposals/';
  this._doPostRequest(url, args, data, cb);
};

// Get addresses
API.prototype.getAddresses = function(cb) {
  var self = this;

  var data = this._loadAndCheck();

  var url = '/v1/addresses/';
  this._doGetRequest(url, data, cb);
};


// Creates a new address 
// TODO: verify derivation!!
API.prototype.createAddress = function(cb) {
  var self = this;

  var data = this._loadAndCheck();
  $.checkState(data.publicKeyRing.length != data.n, 'Wallet Incomplete, cannot derive address.');

  var url = '/v1/addresses/';
  this._doPostRequest(url, {}, data, function(err, address) {
    if (err) return cb(err);

    if (!Verifier.checkAddress(data, address)) {
      return cb(new ServerCompromisedError('Server sent fake address'));
    }

    return cb(null, address);
  });
};

API.prototype.history = function(limit, cb) {

};

API.prototype.getBalance = function(cb) {
  var self = this;

  var data = this._loadAndCheck();

  var url = '/v1/balance/';
  this._doGetRequest(url, data, cb);
};


API.prototype.getTxProposals = function(opts, cb) {
  var self = this;

  var data = this._loadAndCheck();

  var url = '/v1/txproposals/';
  this._doGetRequest(url, data, cb);
};

API.prototype.signTxProposal = function(txp, cb) {
  var self = this;
  var data = this._loadAndCheck();


  //Derive proper key to sign, for each input
  var privs = [],
    derived = {};

  var network = new Bitcore.Address(txp.toAddress).network.name;
  var xpriv = new Bitcore.HDPrivateKey(data.xPrivKey, network);

  _.each(txp.inputs, function(i) {
    if (!derived[i.path]) {
      derived[i.path] = xpriv.derive(i.path).privateKey;
    }
    privs.push(derived[i.path]);
  });

  var t = new Bitcore.Transaction();
  _.each(txp.inputs, function(i) {
    t.from(i, i.publicKeys, txp.requiredSignatures);
  });

  t.to(txp.toAddress, txp.amount)
    .change(txp.changeAddress)
    .sign(privs);

  var signatures = [];
  _.each(privs, function(p) {
    var s = t.getSignatures(p)[0].signature.toDER().toString('hex');
    signatures.push(s);
  });

  var url = '/v1/txproposals/' + txp.id + '/signatures/';
  var args = {
    signatures: signatures
  };

  this._doPostRequest(url, args, data, cb);
};

API.prototype.rejectTxProposal = function(txp, reason, cb) {
  var self = this;
  var data = this._loadAndCheck();

  var url = '/v1/txproposals/' + txp.id + '/rejections/';
  var args = {
    reason: reason || '',
  };
  this._doPostRequest(url, args, data, cb);
};

API.prototype.broadcastTxProposal = function(txp, cb) {
  var self = this;
  var data = this._loadAndCheck();

  var url = '/v1/txproposals/' + txp.id + '/broadcast/';
  this._doPostRequest(url, {}, data, cb);
};



API.prototype.removeTxProposal = function(txp, cb) {
  var self = this;
  var data = this._loadAndCheck();

  var url = '/v1/txproposals/' + txp.id;

  this._doRequest('delete', url, {}, data, cb);
};

module.exports = API;
