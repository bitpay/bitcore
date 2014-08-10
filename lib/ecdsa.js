var bn = require('./bn');
var point = require('./point');
var Signature = require('./signature');
var Privkey = require('./privkey');
var Pubkey = require('./pubkey');
var Random = require('./random');

var ECDSA = function(hash, key, sig, k) {
  this.hash = hash;
  this.key = key;
  this.sig = sig;
  this.k = k;
};

ECDSA.prototype.sigError = function() {
  if (!Buffer.isBuffer(this.hash) || this.hash.length !== 32)
    return 'Invalid hash';

  try {
    this.key.pubkey.validate();
  } catch (e) {
    return 'Invalid pubkey: ' + e;
  };

  var r = this.sig.r;
  var s = this.sig.s;
  if (!(r.gt(0) && r.lt(point.getN()))
   || !(s.gt(0) && s.lt(point.getN())))
    return 'r and s not in range';

  var e = bn.fromBuffer(this.hash);
  var n = point.getN();
  var sinv = s.invm(n);
  var u1 = sinv.mul(e).mod(n);
  var u2 = sinv.mul(r).mod(n);

  var p = point.getG().mulAdd(u1, this.key.pubkey.p, u2);
  if (p.isInfinity())
    return 'p is infinity';

  if (!(p.getX().mod(n).cmp(r) === 0))
    return 'Invalid signature';
  else
    return false;
};

ECDSA.prototype.randomK = function() {
  var N = point.getN();
  var k;
  do {
    k = bn.fromBuffer(Random.getRandomBuffer(32));
  } while (!(k.lt(N) && k.gt(0)));
  this.k = k;
  return this;
};

ECDSA.prototype.sign = function() {
  var hash = this.hash;
  var privkey = this.key.privkey;
  var k = this.k;
  var d = privkey.n;

  if (!hash || !privkey || !k || !d)
    throw new Error('ecdsa: invalid parameters');

  var N = point.getN();
  var G = point.getG();
  var e = bn(hash);

  do {
    var Q = G.mul(k);
    var r = Q.x.mod(N);
    var s = k.invm(N).mul(e.add(d.mul(r))).mod(N);
  } while (r.cmp(0) <= 0 || s.cmp(0) <= 0);

  this.sig = new Signature(r, s);
  return this.sig;
};

ECDSA.prototype.signRandomK = function() {
  var k = this.randomK();
  return this.sign();
};

ECDSA.prototype.verify = function() {
  if (!this.sigError())
    return true;
  else
    return false;
};

module.exports = ECDSA;
