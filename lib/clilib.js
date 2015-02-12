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

var clilib = {};


function _getUrl(path) {
  return BASE_URL + path;
};


function _signRequest(url, args) {

};

function _save(data) {
  fs.writeFileSync('.bit', JSON.stringify(data));
};

function _load() {
  try {
    return JSON.parse(fs.readFileSync('.bit'));
  } catch (ex) {}
};

function _createXPrivKey() {
  return new Bitcore.HDPrivateKey().toString();
};

clilib.createWallet = function(walletName, copayerName, m, n, cb) {
  var data = _load();
  if (data) return cb('Only one wallet can exist');

  data = {
    xPrivKey: _createXPrivKey(),
    m: m,
  };

  var privKey = new Bitcore.PrivateKey();
  var pubKey = privKey.toPublicKey();

  var args = {
    name: walletName,
    m: m,
    n: n,
    pubKey: pubKey.toString(),
  };

  request({
    method: 'post',
    url: _getUrl('v1/wallets'),
    body: args,
    json: true,
  }, function(err, res, body) {
    if (err) return cb(err);
    var walletId = body;
    data.secret = walletId + '|' + privKey.toString();

    _save(data);

    clilib.joinWallet(data.secret, copayerName, function(err) {
      if (err) return cb(err);

      return cb(null, data.secret);
    });
  });
};

clilib.joinWallet = function(secret, copayerName, cb) {
  var data = _load();
  if (data && data.copayerId) return cb('Only one wallet can exist');
  if (!data) {
    data = {
      xPrivKey: _createXPrivKey(),
    };
  }

  var secretSplit = secret.split('|');
  var walletId = secretSplit[0];
  var privKey = Bitcore.PrivateKey.fromString(secretSplit[1]);
  var pubKey = privKey.toPublicKey();

  var xPubKey = new Bitcore.HDPublicKey(data.xPrivKey).toString();
  var xPubKeySignature = SignUtils.sign(xPubKey, privKey);

  var args = {
    walletId: walletId,
    name: copayerName,
    xPubKey: xPubKey,
    xPubKeySignature: xPubKeySignature,
  };

  request({
    method: 'post',
    url: _getUrl('v1/wallets/' + walletId + '/copayers'),
    body: args,
    json: true,
  }, function(err, res, body) {
    if (err) return cb(err);
    var copayerId = body;
    data.copayerId = copayerId;

    _save(data);

    // TODO: call status to retrieve wallet.m

    return clilib.status(cb);
  });
};

clilib.status = function(cb) {
  var data = _load();
  if (!data || !data.copayerId) return cb('Not a part of an active wallet');

  var url = 'v1/dump/';
  var signature = _signRequest(url);

  request({
    headers: {
      'x-identity': data.copayerId,
      'x-signature': signature,
    },
    method: 'get',
    url: _getUrl(url),
  }, function(err, res, body) {
    if (err) return cb(err);

    return cb(null, body);
  });
};

clilib.send = function(addressTo, amount, message, cb) {

};

clilib.sign = function(proposalId, cb) {

};

clilib.reject = function(proposalId, cb) {

};

clilib.address = function(cb) {

};

clilib.history = function(limit, cb) {

};

module.exports = clilib;
