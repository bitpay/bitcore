var Privkey = require('./privkey');
var Pubkey = require('./pubkey');
var Random = require('./random');
var bn = require('./bn');
var point = require('./point');

function Key(priv, pub) {
  this.priv = priv;
  this.pub = pub;
};

Key.prototype.fromRandom = function() {
  do {
    var privbuf = Random.getRandomBuffer(32);
    this.priv = new Privkey(bn(privbuf));
    var condition = this.priv.n.lt(point.getN());
  } while (!condition);
  this.priv2pub();
};

Key.prototype.fromString = function(str) {
  var obj = JSON.parse(str);
  if (obj.priv) {
    this.priv = new Privkey();
    this.priv.fromString(obj.priv);
  }
  if (obj.pub) {
    this.pub = new Pubkey();
    this.pub.fromString(obj.pub);
  }
};

Key.prototype.priv2pub = function() {
  this.pub = new Pubkey(point.getG().mul(this.priv.n));
};

Key.prototype.toString = function() {
  var obj = {};
  if (this.priv)
    obj.priv = this.priv.toString();
  if (this.pub)
    obj.pub = this.pub.toString();
  return JSON.stringify(obj);
};

module.exports = Key;
