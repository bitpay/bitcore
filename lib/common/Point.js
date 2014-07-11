var bignum = require('bignum');

//x and y are both bignums
var Point = function(x, y) {
  this.x = x;
  this.y = y;
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
