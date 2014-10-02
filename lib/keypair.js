var Privkey = require('./privkey');
var Pubkey = require('./pubkey');
var BN = require('./bn');
var point = require('./point');

var Keypair = function Keypair(obj) {  
  if (!(this instanceof Keypair))
    return new Keypair(obj);
    
  if (!obj) {
    var privkey = Privkey().fromRandom();
    var obj = this.fromPrivkey( privkey );
  }

  if (obj)
    this.set(obj);
};

Keypair.prototype.set = function(obj) {
  this.privkey = obj.privkey || this.privkey || undefined;
  this.pubkey  = obj.pubkey  || this.pubkey  || undefined;
  return this;
};

Keypair.prototype.fromJSON = function(json) {
  if (json.privkey)
    this.set({privkey: Privkey().fromJSON(json.privkey)});
  if (json.pubkey)
    this.set({pubkey: Pubkey().fromJSON(json.pubkey)});
  return this;
};

Keypair.prototype.toJSON = function() {
  var json = {};
  if (this.privkey)
    json.privkey = this.privkey.toJSON();
  if (this.pubkey)
    json.pubkey = this.pubkey.toJSON();
  return json;
};

Keypair.prototype.fromPrivkey = function(privkey) {
  this.privkey = privkey;
  this.privkey2pubkey();
  return this;
};

Keypair.prototype.fromRandom = function() {
  this.privkey = Privkey().fromRandom();
  this.privkey2pubkey();
  return this;
};

Keypair.prototype.fromString = function(str) {
  var obj = JSON.parse(str);
  if (obj.privkey) {
    this.privkey = new Privkey();
    this.privkey.fromString(obj.privkey);
  }
  if (obj.pubkey) {
    this.pubkey = new Pubkey();
    this.pubkey.fromString(obj.pubkey);
  }
};

Keypair.prototype.privkey2pubkey = function() {
  this.pubkey = Pubkey().fromPrivkey(this.privkey);
};

Keypair.prototype.toString = function() {
  var obj = {};
  if (this.privkey)
    obj.privkey = this.privkey.toString();
  if (this.pubkey)
    obj.pubkey = this.pubkey.toString();
  return JSON.stringify(obj);
};

module.exports = Keypair;
