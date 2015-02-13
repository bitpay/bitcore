'use strict';

var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
var request = require('request')
log.debug = log.verbose;
log.level = 'debug';
var fs = require('fs')

var Bitcore = require('bitcore')
var SignUtils = require('./signutils');

var BASE_URL = 'http://localhost:3001/copay/api/';



function _getUrl(path) {
  return BASE_URL + path;
};

function _parseError(body) {
  if (_.isString(body)) {
    body = JSON.parse(body);
  }
  var code = body.code || 'ERROR';
  var message = body.error || 'There was an unknown error processing the request';
  log.error(code, message);
};

function _signRequest(url, args, privKey) {
  var message = url + '|' + JSON.stringify(args);
  return SignUtils.sign(message, privKey);
};

function _createXPrivKey() {
  return new Bitcore.HDPrivateKey().toString();
};

function CliLib(opts) {
  if (!opts.filename) {
    throw new Error('Please set the config filename');
  }
  this.filename = opts.filename;
};


CliLib.prototype._save = function(data) {
  fs.writeFileSync(this.filename, JSON.stringify(data));
};

CliLib.prototype._load = function() {
  try {
    return JSON.parse(fs.readFileSync(this.filename));
  } catch (ex) {}
};

CliLib.prototype._loadAndCheck = function() {
  var data = this._load();
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

CliLib.prototype.createWallet = function(walletName, copayerName, m, n, network, cb) {
  var self = this;

  var data = this._load();
  if (data) return cb('Only one wallet is supported in this version');

  // Generate wallet key pair to verify copayers
  var privKey = new Bitcore.PrivateKey();
  var pubKey = privKey.toPublicKey();

  data = {
    xPrivKey: _createXPrivKey(),
    m: m,
    n: n,
    walletPrivKey: privKey.toString(),
  };

  var args = {
    name: walletName,
    m: m,
    n: n,
    pubKey: pubKey.toString(),
    network: network || 'livenet',
  };

  request({
    method: 'post',
    url: _getUrl('/v1/wallets/'),
    body: args,
    json: true,
  }, function(err, res, body) {
    if (err) return cb(err);
    if (res.statusCode != 200) {
      _parseError(body);
      return cb('Request error');
    }

    var walletId = body.walletId;
    var secret = walletId + ':' + privKey.toString();
    data.secret = secret;

    self._save(data);

    self._joinWallet(data, secret, copayerName, function(err) {
      if (err) return cb(err);

      return cb(null, data.secret);
    });
  });
};

CliLib.prototype._joinWallet = function(data, secret, copayerName, cb) {
  var self = this;

  var secretSplit = secret.split(':');
  var walletId = secretSplit[0];
  var privKey = Bitcore.PrivateKey.fromString(secretSplit[1]);

  var xPubKey = new Bitcore.HDPublicKey(data.xPrivKey);
  var xPubKeySignature = SignUtils.sign(xPubKey.toString(), privKey);

  var signingPrivKey = (new Bitcore.HDPrivateKey(data.xPrivKey)).derive('m/1/0').privateKey;

  var args = {
    walletId: walletId,
    name: copayerName,
    xPubKey: xPubKey.toString(),
    xPubKeySignature: xPubKeySignature,
  };

  request({
    method: 'post',
    url: _getUrl('/v1/wallets/' + walletId + '/copayers'),
    body: args,
    json: true,
  }, function(err, res, body) {
    if (err) return cb(err);
    if (res.statusCode != 200) {
      _parseError(body);
      return cb('Request error');
    }

    var wallet = body.wallet;
    data.copayerId = body.copayerId;
    data.signingPrivKey = signingPrivKey.toString();
    data.m = wallet.m;
    data.n = wallet.n;
    data.publicKeyRing = wallet.publicKeyRing;
    self._save(data);

    return cb();
  });
};

CliLib.prototype.joinWallet = function(secret, copayerName, cb) {
  var self = this;

  var data = this._load();
  if (data) return cb('Only one wallet is supported in this version');

  data = {
    xPrivKey: _createXPrivKey(),
  };

  self._joinWallet(data, secret, copayerName, cb);
};

CliLib.prototype.status = function(cb) {
  var self = this;

  var data = this._loadAndCheck();
  console.log('[clilib.js.180:data:]', data); //TODO

  var url = '/v1/wallets/';
  var signature = _signRequest(url, {}, data.signingPrivKey);

  request({
    headers: {
      'x-identity': data.copayerId,
      'x-signature': signature,
    },
    method: 'get',
    url: _getUrl(url),
    json: true,
  }, function(err, res, body) {
    if (err) return cb(err);
    if (res.statusCode != 200) {
      _parseError(body);
      return cb('Request error');
    }
    var wallet = body;

    if (wallet.n > 0 && wallet.status === 'complete' && !data.verified) {
      var pubKey = Bitcore.PrivateKey.fromString(data.walletPrivKey).toPublicKey().toString();
      var fake = [];
      _.each(wallet.copayers, function(copayer) {
        if (!SignUtils.verify(copayer.xPubKey, copayer.xPubKeySignature, pubKey)) {
          fake.push(copayer);
        }
      });
      if (fake.length > 0) {
        log.error('Some copayers in the wallet could not be verified to have known the wallet secret');
        data.verified = 'corrupt';
      } else {
        data.verified = 'ok';
      }
      self._save(data);
    }

    return cb(null, wallet);
  });
};

CliLib.prototype.send = function(addressTo, amount, message, cb) {

};

CliLib.prototype.sign = function(proposalId, cb) {

};

CliLib.prototype.reject = function(proposalId, cb) {

};

CliLib.prototype.address = function(cb) {

};

CliLib.prototype.history = function(limit, cb) {

};

module.exports = CliLib;
