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
var SignUtils = require('./lib/signutils');

var BASE_URL = 'http://localhost:3001/copay/api/';

function getUrl(path) {
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



function createWallet(walletName, copayerName, m, n, cb) {
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
    url: getUrl('v1/wallets'),
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

function joinWallet(secret, copayerName, cb) {
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
    url: getUrl('v1/wallets/' + walletId + '/copayers'),
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

function status(cb) {
  request({
    method: 'get',
    url: getUrl('v1/dump/'),
  }, function(err, res, body) {
    if (err) return cb(err);

    console.log(body);
    return cb();
  });
};

function send(addressTo, amount, message, cb) {

};

function sign(proposalId, cb) {

};

function reject(proposalId, cb) {

};

function address(cb) {

};

function history(limit, cb) {

};


// createWallet('test wallet', 'test copayer', 2, 2, function(err, secret) {
//   if (err) process.exit(err);
//   var data = load();
//   console.log('ESTE ES EL SECRET', secret);
//   console.log('ESTE ES EL STORAGE', data);
// });


// joinWallet('1b44f598-ced5-4fe1-bac3-d9f4563c3011|9b483158c271036035ea639a57761247902222784ef03142b552800e35082929', 'otro copayer', function(err) {
//   if (err) process.exit(err);
// });
