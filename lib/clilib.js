'use strict';

var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
var request = require('request')
var commander = require('commander')
log.debug = log.verbose;
log.level = 'debug';
var fs = require('fs')

var Bitcore = require('bitcore')
var SignUtils = require('./signutils');

var BASE_URL = 'http://localhost:3001/copay/api/';

var cli = {};


function _getUrl(path) {
  return BASE_URL + path;
};


function signRequest(url, args) {

};

function save(data) {
  fs.writeFileSync('./.bit', JSON.stringify(data));
};

function load() {
  try {
    return JSON.parse(fs.readFileSync('./.bit'));
  } catch (ex) {}
};



clilib.createWallet = function(walletName, copayerName, m, n, cb) {
  var data = load();
  if (!data) {
    data = {};
    data.xPrivKey = new Bitcore.HDPrivateKey().toString();
    data.m = m;
  }
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
    var secret = walletId + '|' + privKey.toString();

    joinWallet(secret, copayerName, function(err) {
      if (err) return cb(err);

      save(data);
      return cb(null, secret);
    });
  });
};

clilib.joinWallet = function(secret, copayerName, cb) {
  var data = load();
  if (!data) {
    data = {};
    data.xPrivKey = new Bitcore.HDPrivateKey().toString();
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
    save(data);
    return status(cb);
  });
};

clilib.status = function(cb) {
  request({
    method: 'get',
    url: _getUrl('v1/dump/'),
  }, function(err, res, body) {
    if (err) return cb(err);

    console.log(body);
    return cb();
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
