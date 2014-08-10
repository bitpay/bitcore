var Privkey = require('./privkey');
var Pubkey = require('./pubkey');
var Random = require('./random');
var bn = require('./bn');
var point = require('./point');

function Key(privkey, pubkey) {
  this.privkey = privkey;
  this.pubkey = pubkey;
};

Key.prototype.fromRandom = function() {
  do {
    var privbuf = Random.getRandomBuffer(32);
    this.privkey = new Privkey(bn(privbuf));
    var condition = this.privkey.n.lt(point.getN());
  } while (!condition);
  this.privkey2pubkey();
};

Key.prototype.fromString = function(str) {
  var obj = JSON.parse(str);
  if (obj.priv) {
    this.privkey = new Privkey();
    this.privkey.fromString(obj.priv);
  }
  if (obj.pub) {
    this.pubkey = new Pubkey();
    this.pubkey.fromString(obj.pub);
  }
};

Key.prototype.privkey2pubkey = function() {
  this.pubkey = new Pubkey(point.getG().mul(this.privkey.n));
};

Key.prototype.toString = function() {
  var obj = {};
  if (this.privkey)
    obj.priv = this.privkey.toString();
  if (this.pubkey)
    obj.pub = this.pubkey.toString();
  return JSON.stringify(obj);
};

module.exports = Key;
