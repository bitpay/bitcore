var imports = require('soop').imports();

var coinUtil = require('./util/util');
var timeUtil = require('./util/time');
var KeyModule = require('./Key');
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
  this.privKey = KeyModule.Key.generateSync();
  this.created = timeUtil.curtime();
};

WalletKey.prototype.storeObj = function() {
  var pubKey = this.privKey.public.toString('hex');
  var pubKeyHash = coinUtil.sha256ripe160(this.privKey.public);
  var addr = new Address(this.network.addressPubkey, pubKeyHash);
  var priv = new PrivateKey(this.network.keySecret, this.privKey.private, this.privKey.compressed);
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
  this.privKey = new KeyModule.Key();
  if (obj.priv.length==64) {
    this.privKey.private = new Buffer(obj.priv,'hex');
    this.privKey.compressed = true;
  }
  else {
    var priv = new PrivateKey(obj.priv);
    this.privKey.private = new Buffer(priv.payload());
    this.privKey.compressed = priv.compressed();
  }
  this.privKey.regenerateSync();
};

module.exports = require('soop')(WalletKey);
