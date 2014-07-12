var hex = function(hex) {
  return new Buffer(hex, 'hex');
};

var fs = require('fs');
var EncFile = require('../util/EncFile');
var Address = require('./Address');
var networks = require('../networks');
var util = require('../util');
var ENC_METHOD = 'aes-256-cbc';

var skeleton = {
  client: 'libcoin',
  client_version: '0.0.1',
  network: 'testnet',
  version: 1,
  best_hash: null,
  best_height: -1,
  keys: [],
  sin: {},
  scripts: {},
};

function Wallet(cfg) {
  if (typeof cfg !== 'object')
    cfg = {};

  // deep copy (no references)
  if (cfg.datastore)
    this.datastore = JSON.parse(JSON.stringify(cfg.datastore));
  else
    this.datastore = JSON.parse(JSON.stringify(skeleton));

  this.network = undefined;
  this.dirty = cfg.dirty || true;
};

Wallet.prototype.readSync = function(filename, passphrase) {
  this.datastore = EncFile.readJFileSync(ENC_METHOD,
    passphrase, filename);
  this.dirty = false;
};

Wallet.prototype.writeSync = function(filename, passphrase) {
  var tmp_fn = filename + ".tmp";

  EncFile.writeJFileSync(ENC_METHOD, passphrase, tmp_fn,
    this.datastore);
  fs.renameSync(tmp_fn, filename);

  this.dirty = false;
};

Wallet.prototype.setNetwork = function(netname) {
  if (!netname)
    netname = this.datastore.network;

  switch (netname) {
    case "mainnet":
    case "livenet":
      this.network = networks.livenet;
      break;
    case "testnet":
      this.network = networks.testnet;
      break;
    default:
      throw new Error("Unsupported network");
  }

  // store+canonicalize name
  this.datastore['network'] = this.network.name;
  this.dirty = true;
};

Wallet.prototype.addKey = function(wkey) {
  this.datastore.keys.push(wkey);
  this.dirty = true;
};

Wallet.prototype.addSIN = function(sinObj) {
  this.datastore.sin[sinObj.sin] = sinObj;
  this.dirty = true;
};

Wallet.prototype.findKeyHash = function(pubKeyHash) {
  var pkhStr = pubKeyHash.toString();

  for (var i = 0; i < this.datastore.keys.length; i++) {
    var obj = this.datastore.keys[i];
    var addrStr = obj.addr;
    var addr = new Address(addrStr);
    if (addr.payload().toString() == pkhStr)
      return obj;
  }

  return undefined;
};

Wallet.prototype.expandKey = function(key) {
  var addr = new Address(key);
  var isAddr = true;

  try {
    addr.validate();
    var b = addr.payload();
    var obj = this.findKeyHash(b);
    key = obj.pub;
  } catch (e) {
    // do nothing
  }

  var re = /^[a-fA-F0-9]+$/;
  if (!key.match(re))
    throw new Error("Unknown key type");
  return hex(key);
};

Wallet.prototype.expandKeys = function(keys) {
  var res = [];
  var us = this;
  keys.forEach(function(key) {
    var expKey = us.expandKey(key);
    res.push(expKey);
  });
  return res;
};

Wallet.prototype.addScript = function(script) {
  var buf = script.getBuffer();
  var hash = util.sha256ripe160(buf);
  var addr = new Address(this.network.P2SHVersion, hash);
  var addrStr = addr.as('base58');
  this.datastore.scripts[addrStr] = buf.toString('hex');
  this.dirty = true;

  return addrStr;
};

module.exports = Wallet;
