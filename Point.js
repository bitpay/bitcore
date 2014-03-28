"use strict";

var imports = require('soop').imports();
var Key = imports.Key || require('./Key'); 
var bignum = imports.bignum || require('bignum');
var assert = require('assert');

//browser
if (!process.versions) {
  var ECKey = require('./browser/vendor-bundle.js').ECKey;
  var ECPointFp = require('./browser/vendor-bundle.js').ECPointFp;
  var ECFieldElementFp = require('./browser/vendor-bundle.js').ECFieldElementFp;
  var getSECCurveByName = require('./browser/vendor-bundle.js').getSECCurveByName;
  var BigInteger = require('./browser/vendor-bundle.js').BigInteger;
  var should = require('chai').should();
}


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
    var ecparams = getSECCurveByName('secp256k1');

    var p1xhex = p1.x.toBuffer({size: 32}).toString('hex');
    var p1x = new BigInteger(p1xhex, 16);
    var p1yhex = p1.y.toBuffer({size: 32}).toString('hex');
    var p1y = new BigInteger(p1yhex, 16);
    var p1px = new ECFieldElementFp(ecparams.getCurve().getQ(), p1x);
    var p1py = new ECFieldElementFp(ecparams.getCurve().getQ(), p1y);
    var p1p = new ECPointFp(ecparams.getCurve(), p1px, p1py);

    var p2xhex = p2.x.toBuffer({size: 32}).toString('hex');
    var p2x = new BigInteger(p2xhex, 16);
    var p2yhex = p2.y.toBuffer({size: 32}).toString('hex');
    var p2y = new BigInteger(p2yhex, 16);
    var p2px = new ECFieldElementFp(ecparams.getCurve().getQ(), p2x);
    var p2py = new ECFieldElementFp(ecparams.getCurve().getQ(), p2y);
    var p2p = new ECPointFp(ecparams.getCurve(), p2px, p2py);

    var p = p1p.add(p2p);

    var point = new Point();
    var pointxbuf = new Buffer(p.getX().toBigInteger().toByteArrayUnsigned());
    point.x = bignum.fromBuffer(pointxbuf, {size: pointxbuf.length});
    assert(pointxbuf.length <= 32);
    var pointybuf = new Buffer(p.getY().toBigInteger().toByteArrayUnsigned());
    assert(pointybuf.length <= 32);
    point.y = bignum.fromBuffer(pointybuf, {size: pointybuf.length});

    return point;
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
    var point = new Point();
    var pubKeyBuf = new Buffer(key.public);
    var key2 = new ECKey();
    key2.setCompressed(key.compressed);
    key2.setPub(Key.bufferToArray(pubKeyBuf));
    key2.setCompressed(false);
    point.x = bignum.fromBuffer((new Buffer(key2.getPub())).slice(1, 33), {size: 32});
    point.y = bignum.fromBuffer((new Buffer(key2.getPub())).slice(33, 65), {size: 32});
    return point;
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
    key.public = Buffer.concat([prefix, xbuf, ybuf]); //this might be wrong
    key.compressed = true;
    return key;
  }

  //browser
  else {
    var xbuf = this.x.toBuffer({size: 32});
    var ybuf = this.y.toBuffer({size: 32});
    var key = new ECKey();
    key.setCompressed(false);
    var prefix = new Buffer([0x04]);
    var pub = Buffer.concat([prefix, xbuf, ybuf]); //this might be wrong
    key.setPub(Key.bufferToArray(pub));
    key.setCompressed(true);
    var key2 = new Key();
    key2.public = new Buffer(key.getPub());
    return key2;
  }
};

module.exports = require('soop')(Point);
