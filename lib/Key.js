var Key = require('bindings')('KeyModule').Key;
var CommonKey = require('./common/Key');
var bignum = require('bignum');
var Point = require('./Point');
var coinUtil = require('../util');

for (var i in CommonKey) {
  if (CommonKey.hasOwnProperty(i))
    Key[i] = CommonKey[i];
}

Key.sign = function(hash, priv, k) {
  if (k)
    throw new Error('Deterministic k not supported in node');

  var key = new Key();
  key.private = priv.toBuffer({size: 32});
  var sig = key.signSync(hash);

  var parsed = Key.parseDERsig(sig);

  return {r: parsed.r, s: parsed.s};
};

Key.signCompressed = function(hash, priv, k) {
  var sig = Key.sign(hash, priv, k);
  var r = sig.r;
  var s = sig.s;
  var e = bignum.fromBuffer(hash);

  var G = Point.getG();
  var Q = Point.multiply(G, priv.toBuffer({size: 32}));

  var i = Key.calcPubKeyRecoveryParam(e, r, s, Q);

  var rbuf = r.toBuffer({size: 32});
  var sbuf = s.toBuffer({size: 32});
  var ibuf = new Buffer([i]);
  var buf = Buffer.concat([ibuf, rbuf, sbuf]);
  return buf;
};

Key.verifyCompressed = function(hash, sigbuf, pubkeyhash) {
  if (sigbuf.length !== 1 + 32 + 32)
    throw new Error("Invalid length for sigbuf");

  var i = sigbuf[0];
  if (i < 0 || i > 3)
    throw new Error("Invalid value for i");

  var rbuf = sigbuf.slice(1, 1 + 32);
  var sbuf = sigbuf.slice(1 + 32, 1 + 32 + 32);
  var r = bignum.fromBuffer(rbuf);
  var s = bignum.fromBuffer(sbuf);

  var sigDER = Key.rs2DER(r, s);

  var e = bignum.fromBuffer(hash);

  var key = new Key();
  var pub = Key.recoverPubKey(e, r, s, i);
  var pubbuf = pub.toCompressedPubKey();
  key.public = pubbuf;

  var pubkeyhash2 = coinUtil.sha256ripe160(pubbuf);
  if (pubkeyhash2.toString('hex') !== pubkeyhash.toString('hex')) {
    return false;
  }

  return key.verifySignatureSync(hash, sigDER);
};

module.exports = Key;
