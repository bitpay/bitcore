var bignum = require('bignum');

//x and y are both bignums
var Point = function(x, y) {
  this.x = x;
  this.y = y;
};

var n = bignum.fromBuffer(new Buffer("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", 'hex'), {
  size: 32
});

Point.getN = function() {
  return n;
};

var G;
Point.getG = function() {
  // don't use Point in top scope, causes exception in browser
  // when Point is not loaded yet

  // use cached version if available
  G = G || new Point(bignum.fromBuffer(new Buffer("79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798", 'hex'), {
      size: 32
    }),
    bignum.fromBuffer(new Buffer("483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8", 'hex'), {
      size: 32
    }));
  return G;
};

//convert the public key of a Key into a Point
Point.fromUncompressedPubKey = function(pubkey) {
  var point = new Point();
  point.x = bignum.fromBuffer(pubkey.slice(1, 33), {
    size: 32
  });
  point.y = bignum.fromBuffer(pubkey.slice(33, 65), {
    size: 32
  });
  return point;
};

//convert the Point into the Key containing a compressed public key
Point.prototype.toUncompressedPubKey = function() {
  var xbuf = this.x.toBuffer({
    size: 32
  });
  var ybuf = this.y.toBuffer({
    size: 32
  });
  var prefix = new Buffer([0x04]);
  var pubkey = Buffer.concat([prefix, xbuf, ybuf]);
  return pubkey;
};

Point.prototype.toCompressedPubKey = function() {
  var xbuf = this.x.toBuffer({size: 32});
  var ybuf = this.y.toBuffer({size: 32});
  if (ybuf[ybuf.length-1] % 2) { //odd
    var pub = Buffer.concat([new Buffer([3]), xbuf]);
  }
  else { //even
    var pub = Buffer.concat([new Buffer([2]), xbuf]);
  }
  return pub;
};

module.exports = Point;
