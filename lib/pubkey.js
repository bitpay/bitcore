'use strict';

var Point = require('./crypto/point');
var BN = require('./crypto/bn');

/**
 *
 * Bitcore Pubkey
 *
 * Instantiate a Pubkey from a 'Privkey', 'Point', 'string', 'Buffer'.
 *
 * @example
 *
 * var pubkey = new Pubkey(privkey, true);
 *
 * @param {String} data - The encoded data in various formats
 * @param {String} [compressed] - If the public key is compressed
 * @returns {Pubkey} A new valid instance of an Pubkey
 */
var Pubkey = function Pubkey(data, compressed) {

  if (!(this instanceof Pubkey)) {
    return new Pubkey(data, compressed);
  }

  if (!data) {
    throw new TypeError('First argument is required, please include public key data.');
  }

  var info = {
    compressed: typeof(compressed) !== 'undefined' ? compressed : true
  };

  // detect type of data
  if (data instanceof Point) {
    info.point = data;
  } else if (typeof(data) === 'string'){
    info = Pubkey._transformDER(new Buffer(data, 'hex' ));
  } else if (data instanceof Buffer){
    info = Pubkey._transformDER(data);
  } else if (data.constructor && (data.constructor.name && 
                                  data.constructor.name === 'Privkey')) {
    info = Pubkey._transformPrivkey(data);
  } else {
    throw new TypeError('First argument is an unrecognized data format.');
  }

  // validation
  if (info.point.isInfinity()){
    throw new Error('Point cannot be equal to Infinity');
  }
  if (info.point.eq(Point(BN(0), BN(0)))){
    throw new Error('Point cannot be equal to 0, 0');
  }

  //https://www.iacr.org/archive/pkc2003/25670211/25670211.pdf
  info.point.validate();

  this.point = info.point;
  this.compressed = info.compressed;

  return this;

};

/**
 *
 * Internal function to transform a private key into a public key point
 *
 * @param {Privkey} privkey - An instance of Privkey
 * @returns {Object} An object with keys: point and compressed
 */
Pubkey._transformPrivkey = function(privkey) {
  var info = {};
  if (!privkey.constructor || 
      (privkey.constructor.name && privkey.constructor.name !== 'Privkey')) {
    throw new TypeError('Must be an instance of Privkey');
  }
  info.point = Point.getG().mul(privkey.bn);
  info.compressed = privkey.compressed;
  return info;
};

/**
 *
 * Internal function to transform DER into a public key point
 *
 * @param {Buffer} buf - An hex encoded buffer
 * @returns {Object} An object with keys: point and compressed
 */
Pubkey._transformDER = function(buf){
  var info = {};
  if (!(buf instanceof Buffer)){
    throw new TypeError('Must be a hex buffer of DER encoded public key');
  }

  var x;
  var y;
  var xbuf;
  var ybuf;

  if (buf[0] === 0x04) {
    xbuf = buf.slice(1, 33);
    ybuf = buf.slice(33, 65);
    if (xbuf.length !== 32 || ybuf.length !== 32 || buf.length !== 65) {
      throw new TypeError('Length of x and y must be 32 bytes');
    }
    x = BN(xbuf);
    y = BN(ybuf);
    info.point = Point(x, y);
    info.compressed = false;
  } else if (buf[0] === 0x03) {
    xbuf = buf.slice(1);
    x = BN(xbuf);
    info = Pubkey._transformX(true, x);
    info.compressed = true;
  } else if (buf[0] == 0x02) {
    xbuf = buf.slice(1);
    x = BN(xbuf);
    info = Pubkey._transformX(false, x);
    info.compressed = true;
  } else {
    throw new TypeError('Invalid DER format pubkey');
  }
  return info;
};

/**
 *
 * Internal function to transform X into a public key point
 *
 * @param {Boolean} odd - If the point is above or below the x axis
 * @param {Point} x - The x point
 * @returns {Object} An object with keys: point and compressed
 */
Pubkey._transformX = function(odd, x){
  var info = {};
  if (typeof odd !== 'boolean') {
    throw new TypeError('Must specify whether y is odd or not (true or false)');
  }
  info.point = Point.fromX(odd, x);
  return info;
};

/**
 *
 * Instantiate a Pubkey from JSON
 *
 * @param {String} json - A JSON string of DER encoded pubkey
 * @returns {Pubkey} A new valid instance of Pubkey
 */
Pubkey.fromJSON = function(json) {
  var buf = new Buffer(json, 'hex');
  var info = Pubkey._transformDER(buf);
  return new Pubkey(info.point, info.compressed);
};

/**
 *
 * Instantiate a Pubkey from a Privkey
 *
 * @param {Privkey} privkey - An instance of Privkey
 * @returns {Pubkey} A new valid instance of Pubkey
 */
Pubkey.fromPrivkey = function(privkey) {
  var info = Pubkey._transformPrivkey(privkey);
  return new Pubkey(info.point, info.compressed);
};

/**
 *
 * Instantiate a Pubkey from a Buffer
 *
 * @param {Buffer} buf - A DER hex buffer
 * @returns {Pubkey} A new valid instance of Pubkey
 */
Pubkey.fromBuffer = function(buf) {
  var info = Pubkey._transformDER(buf);
  return new Pubkey(info.point, info.compressed);
};

/**
 *
 * Instantiate a Pubkey from a Point
 *
 * @param {Point} point - A Point instance
 * @returns {Pubkey} A new valid instance of Pubkey
 */
Pubkey.fromPoint = function(point){
  if (!(point instanceof Point)) {
    throw new TypeError('First argument must be an instance of Point.');
  }
  return new Pubkey(point);
};

/**
 *
 * Instantiate a Pubkey from a DER Buffer
 *
 * @param {Buffer} buf - A DER Buffer
 * @returns {Pubkey} A new valid instance of Pubkey
 */
Pubkey.fromDER = function(buf) {
  var info = Pubkey._transformDER(buf);
  return new Pubkey(info.point, info.compressed);
};

/**
 *
 * Instantiate a Pubkey from a DER hex encoded string
 *
 * @param {String} str - A DER hex string
 * @param {String} [encoding] - The type of string encoding
 * @returns {Pubkey} A new valid instance of Pubkey
 */
Pubkey.fromString = function(str, encoding) {
  var buf = new Buffer(str, encoding || 'hex');
  var info = Pubkey._transformDER(buf);
  return new Pubkey(info.point, info.compressed);
};

/**
 *
 * Instantiate a Pubkey from an X Point
 *
 * @param {Boolean} odd - If the point is above or below the x axis
 * @param {Point} x - The x point
 * @returns {Pubkey} A new valid instance of Pubkey
 */
Pubkey.fromX = function(odd, x) {
  var info = Pubkey._transformX(odd, x);
  return new Pubkey(info.point, info.compressed);
};


/**
 *
 * Check if there would be any errors when initializing a Pubkey
 *
 * @param {String} data - The encoded data in various formats
 * @param {String} [compressed] - If the public key is compressed
 * @returns {null|Error} An error if exists
 */
Pubkey.getValidationError = function(data, compressed) {
  var error;
  try {
    new Pubkey(data, compressed);
  } catch (e) {
    error = e;
  }
  return error;
};

/**
 *
 * Check if the parameters are valid
 *
 * @param {String} data - The encoded data in various formats
 * @param {String} [compressed] - If the public key is compressed
 * @returns {Boolean} If the pubkey is would be valid
 */
Pubkey.isValid = function(data, compressed) {
  return !Pubkey.getValidationError(data, compressed);
};

/**
 *
 * Will output the Pubkey to JSON
 *
 * @returns {String} A hex encoded string
 */
Pubkey.prototype.toJSON = function() {
  return this.toBuffer().toString('hex');
};

/**
 *
 * Will output the Pubkey to a Buffer
 *
 * @returns {Buffer} A DER hex encoded buffer
 */
Pubkey.prototype.toBuffer = function() {
  var compressed = typeof this.compressed === 'undefined' ? true : this.compressed;
  return this.toDER(compressed);
};

/**
 *
 * Will output the Pubkey to a DER Buffer
 *
 * @returns {Buffer} A DER hex encoded buffer
 */
Pubkey.prototype.toDER = function(compressed) {
  compressed = typeof(compressed) !== 'undefined' ? compressed : this.compressed;
  if (typeof compressed !== 'boolean') {
    throw new TypeError('Must specify whether the public key is compressed or not (true or false)');
  }

  var x = this.point.getX();
  var y = this.point.getY();

  var xbuf = x.toBuffer({size: 32});
  var ybuf = y.toBuffer({size: 32});

  var prefix;
  if (!compressed) {
    prefix = new Buffer([0x04]);
    return Buffer.concat([prefix, xbuf, ybuf]);
  } else {
    var odd = ybuf[ybuf.length - 1] % 2;
    if (odd) {
      prefix = new Buffer([0x03]);
    } else {
      prefix = new Buffer([0x02]);
    }
    return Buffer.concat([prefix, xbuf]);
  }
};

/**
 *
 * Will output the Pubkey to a DER encoded hex string
 *
 * @returns {String} A DER hex encoded string
 */
Pubkey.prototype.toString = function() {
  var compressed = typeof this.compressed === 'undefined' ? true : this.compressed;
  return this.toDER(compressed).toString('hex');
};

/**
 *
 * Will return a string formatted for the console
 *
 * @returns {String} Public key
 */
Pubkey.prototype.inspect = function() {
  return '<Pubkey: ' + this.toString() + ', compressed: '+this.compressed+'>';
};

module.exports = Pubkey;
