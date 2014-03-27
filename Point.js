var imports = require('soop').imports();
var Key = imports.Key || require('./Key');
var bignum = imports.bignum || require('bignum');

//a point on the secp256k1 curve
//x and y are bignums
var Point = function(x, y) {
  this.x = x;
  this.y = y;
};

Point.add = function(p1, p2) {

  //node
  if (process.versions) {
    var key1 = p1.toKey();
    key1.compressed = false;
    var key2 = p2.toKey();
    key2.compressed = false;
    var pubKey = Key.addUncompressed(key1.public, key2.public);
    var key = new Key();
    key.compressed = false;
    key.public = pubKey;
    key.compressed = true;
    return Point.fromKey(key);
  }

  //browser
  else {
  }

};

//convert the public key of a Key into a Point
Point.fromKey = function(key) {

  //node
  if (process.versions) {
    var point = new Point();
    var pubKeyBuf = new Buffer(key.public);
    var key2 = new Key();
    key2.compressed = key.compressed;
    key2.public = pubKeyBuf;
    key2.compressed = false;
    point.x = bignum.fromBuffer(key2.public.slice(1, 33), {size: 32});
    point.y = bignum.fromBuffer(key2.public.slice(33, 65), {size: 32});
    return point;
  }

  //browser
  else {
  }
};

//convert the Point into the Key containing a compressed public key
Point.prototype.toKey = function() {
  
  //node
  if (process.versions) {
    var xbuf = this.x.toBuffer({size: 32});
    var ybuf = this.y.toBuffer({size: 32});
    var key = new Key();
    key.compressed = false;
    var prefix = new Buffer([0x04]);
    key.public = Buffer.concat([prefix, xbuf, ybuf]); //this is probably wrong
    key.compressed = true;
    return key;
  }

  //browser
  else {
  }
};

module.exports = require('soop')(Point);
