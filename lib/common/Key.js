var bignum = require('bignum');
var Point = require('../Point');
var SecureRandom = require('../SecureRandom');
var bignum = require('bignum');
var elliptic = require('elliptic');
var Key = function() {}

Key.parseDERsig = function(sig) {
  if (!Buffer.isBuffer(sig))
    throw new Error('DER formatted signature should be a buffer');

  var header = sig[0];

  if (header !== 0x30)
    throw new Error('Header byte should be 0x30');

  var length = sig[1];
  if (length !== sig.slice(2).length)
    throw new Error('Length byte should length of what follows');

  var rheader = sig[2 + 0];
  if (rheader !== 0x02)
    throw new Error('Integer byte for r should be 0x02');

  var rlength = sig[2 + 1];
  var rbuf = sig.slice(2 + 2, 2 + 2 + rlength);
  var r = bignum.fromBuffer(rbuf);
  var rneg = sig[2 + 1 + 1] === 0x00 ? true : false;
  if (rlength !== rbuf.length)
    throw new Error('Length of r incorrect');

  var sheader = sig[2 + 2 + rlength + 0];
  if (sheader !== 0x02)
    throw new Error('Integer byte for s should be 0x02');

  var slength = sig[2 + 2 + rlength + 1];
  var sbuf = sig.slice(2 + 2 + rlength + 2, 2 + 2 + rlength + 2 + slength);
  var s = bignum.fromBuffer(sbuf);
  var sneg = sig[2 + 2 + rlength + 2 + 2] === 0x00 ? true : false;
  if (slength !== sbuf.length)
    throw new Error('Length of s incorrect');

  var sumlength = 2 + 2 + rlength + 2 + slength;
  if (length !== sumlength - 2)
    throw new Error('Length of signature incorrect');


  var obj = {
    header: header,
    length: length,
    rheader: rheader,
    rlength: rlength,
    rneg: rneg,
    rbuf: rbuf,
    r: r,
    sheader: sheader,
    slength: slength,
    sneg: sneg,
    sbuf: sbuf,
    s: s
  };

  return obj;
};

Key.rs2DER = function(r, s) {
  var rnbuf = r.toBuffer();
  var snbuf = s.toBuffer();

  var rneg = rnbuf[0] & 0x80 ? true : false;
  var sneg = snbuf[0] & 0x80 ? true : false;

  var rbuf = rneg ? Buffer.concat([new Buffer([0x00]), rnbuf]) : rnbuf;
  var sbuf = sneg ? Buffer.concat([new Buffer([0x00]), snbuf]) : snbuf;

  var length = 2 + rbuf.length + 2 + sbuf.length;
  var rlength = rbuf.length;
  var slength = sbuf.length;
  var rheader = 0x02;
  var sheader = 0x02;
  var header = 0x30;

  var der = Buffer.concat([new Buffer([header, length, rheader, rlength]), rbuf, new Buffer([sheader, slength]), sbuf]);
  return der;
};

Key.recoverPubKey = function(e, r, s, i) {
  var bnjs = require('bn.js');

  if (i>3 || i<0)
    throw new Error('Recovery param is more than two bits');

  e = new bnjs(e.toBuffer({size: 32}));
  r = new bnjs(r.toBuffer({size: 32}));
  s = new bnjs(s.toBuffer({size: 32}));

  var ec = elliptic.curves.secp256k1;

  // A set LSB signifies that the y-coordinate is odd
  var isYOdd = i & 1;

  // The more significant bit specifies whether we should use the
  // first or second candidate key.
  var isSecondKey = i >> 1;

  var n = ec.curve.n;
  var G = ec.curve.g;

  // 1.1 Let x = r + jn
  var x = isSecondKey ? r.add(n) : r;
  var R = ec.curve.pointFromX(isYOdd, x.toArray());

  // 1.4 Check that nR is at infinity
  var nR = R.mul(n);

  //TODO: check that nR is not infinity
  //assert(curve.isInfinity(nR), 'nR is not a valid curve point');

  // Compute -e from e
  var eNeg = e.neg().mod(n);

  // 1.6.1 Compute Q = r^-1 (sR - eG)
  // Q = r^-1 (sR + -eG)
  var rInv = r.invm(n);

  //var Q = R.multiplyTwo(s, G, eNeg).mul(rInv);
  var Q = R.mul(s).add(G.mul(eNeg)).mul(rInv);
  ec.curve.validate(Q);
  var pubkey = new Point();
  pubkey.x = bignum(Q.x.toString());
  pubkey.y = bignum(Q.y.toString());

  return pubkey;
}

/**
* Calculate pubkey extraction parameter.
*
* When extracting a pubkey from a signature, we have to
* distinguish four different cases. Rather than putting this
* burden on the verifier, Bitcoin includes a 2-bit value with the
* signature.
*
* This function simply tries all four cases and returns the value
* that resulted in a successful pubkey recovery.
*/
Key.calcPubKeyRecoveryParam = function(e, r, s, Q) {
  for (var i = 0; i < 4; i++) {
    var Qprime = Key.recoverPubKey(e, r, s, i);

    // 1.6.2 Verify Q
    if (Qprime.x.toString() == Q.x.toString() && Qprime.y.toString() == Q.y.toString()) {
      return i;
    }
  }

  throw new Error('Unable to find valid recovery factor');
}

Key.genk = function() {
  //TODO: account for when >= n
  var k = new bignum(SecureRandom.getRandomBuffer(32))
  return k;
};

module.exports = Key;
