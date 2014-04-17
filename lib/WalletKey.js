var imports = require('soop').imports();

var coinUtil = require('../util');
var timeUtil = require('../util/time');
var Key = require('./Key');
var PrivateKey = require('./PrivateKey');
var Address = require('./Address');

function WalletKey(cfg) {
  if (!cfg) cfg = {};
  if (!cfg.network) throw new Error('network parameter is required');
  this.network = cfg.network; // required
  this.created = cfg.created;
  this.privKey = cfg.privKey;
};

WalletKey.prototype.generate = function() {
  this.privKey = Key.generateSync();
  this.created = timeUtil.curtime();
};

WalletKey.prototype.storeObj = function() {
  var pubKey = this.privKey.public.toString('hex');
  var pubKeyHash = coinUtil.sha256ripe160(this.privKey.public);
  var addr = new Address(this.network.addressVersion, pubKeyHash);
  var priv = new PrivateKey(this.network.privKeyVersion, this.privKey.private, this.privKey.compressed);
  var obj = {
    created: this.created,
    priv: priv.toString(),
    pub: pubKey,
    addr: addr.toString(),
  };

  return obj;
};

WalletKey.prototype.fromObj = function(obj) {
  this.created = obj.created;
  this.privKey = new Key();
  if (obj.priv.length == 64) {
    this.privKey.private = new Buffer(obj.priv, 'hex');
    this.privKey.compressed = typeof obj.compressed === 'undefined'? true: obj.compressed;
  } else {
    var priv = new PrivateKey(obj.priv);
    priv.validate();
    this.privKey.private = new Buffer(priv.payload());
    this.privKey.compressed = priv.compressed();
  }
  this.privKey.regenerateSync();
};

module.exports = require('soop')(WalletKey);
