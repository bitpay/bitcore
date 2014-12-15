'use strict';

var Address = require('./address');
var BN = require('./crypto/bn');
var Point = require('./crypto/point');
var JSUtil = require('./util/js');

/**
 * Instantiate a PublicKey from a 'PrivateKey', 'Point', 'string', 'Buffer'.
 *
 * @example
 *
 * // instantiate from a private key
 * var key = PublicKey(privateKey, true);
 *
 * // export to as a DER hex encoded string
 * var exported = key.toString();
 *
 * // import the public key
 * var imported = PublicKey.fromString(exported);
 *
 * @param {String} data - The encoded data in various formats
 * @returns {PublicKey} A new valid instance of an PublicKey
 * @constructor
 */
var PublicKey = function PublicKey(data) {

  if (!(this instanceof PublicKey)) {
    return new PublicKey(data);
  }

  if (!data) {
    throw new TypeError('First argument is required, please include public key data.');
  }
  if (data instanceof PublicKey) {
    // Return copy, but as it's an immutable object, return same argument
    return data;
  }

  var info = {
    compressed: true
  };

  // detect type of data
  if (data instanceof Point) {
    info.point = data;
  } else if (PublicKey._isJSON(data)) {
    info = PublicKey._transformJSON(data);
  } else if (typeof(data) === 'string') {
    info = PublicKey._transformDER(new Buffer(data, 'hex'));
  } else if (PublicKey._isBuffer(data)) {
    info = PublicKey._transformDER(data);
  } else if (PublicKey._isPrivateKey(data)) {
    info = PublicKey._transformPrivateKey(data);
  } else {
    throw new TypeError('First argument is an unrecognized data format.');
  }

  // validation
  info.point.validate();

  Object.defineProperty(this, 'point', {
    configurable: false,
    value: info.point
  });

  Object.defineProperty(this, 'compressed', {
    configurable: false,
    value: info.compressed
  });

  Object.defineProperty(this, 'address', {
    configurable: false,
    get: this.toAddress.bind(this)
  });

  return this;

};

/**
 * Internal function to detect if an object is a PrivateKey
 *
 * @param {*} param - object to test
 * @returns {boolean}
 * @private
 */
PublicKey._isPrivateKey = function(param) {
  return param && param.constructor && param.constructor.name
      && param.constructor.name === 'PrivateKey';
};

/**
 * Internal function to detect if an object is a Buffer
 *
 * @param {*} param - object to test
 * @returns {boolean}
 * @private
 */
PublicKey._isBuffer = function(param) {
  return (param instanceof Buffer) || (param instanceof Uint8Array);
};

/**
 * Internal function to detect if a param is a JSON string or plain object
 *
 * @param {*} param - value to test
 * @returns {boolean}
 * @private
 */
PublicKey._isJSON = function(json) {
  return JSUtil.isValidJSON(json) || (json.x && json.y);
};

/**
 * Internal function to transform a private key into a public key point
 *
 * @param {PrivateKey} privkey - An instance of PrivateKey
 * @returns {Object} An object with keys: point and compressed
 * @private
 */
PublicKey._transformPrivateKey = function(privkey) {
  var info = {};
  if (!PublicKey._isPrivateKey(privkey)) {
    throw new TypeError('Must be an instance of PrivateKey');
  }
  info.point = Point.getG().mul(privkey.bn);
  info.compressed = privkey.compressed;
  return info;
};

/**
 * Internal function to transform DER into a public key point
 *
 * @param {Buffer} buf - An hex encoded buffer
 * @returns {Object} An object with keys: point and compressed
 * @private
 */
PublicKey._transformDER = function(buf){
  var info = {};
  if (!PublicKey._isBuffer(buf)) {
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
    info = PublicKey._transformX(true, x);
    info.compressed = true;
  } else if (buf[0] == 0x02) {
    xbuf = buf.slice(1);
    x = BN(xbuf);
    info = PublicKey._transformX(false, x);
    info.compressed = true;
  } else {
    throw new TypeError('Invalid DER format public key');
  }
  return info;
};

/**
 * Internal function to transform X into a public key point
 *
 * @param {Boolean} odd - If the point is above or below the x axis
 * @param {Point} x - The x point
 * @returns {Object} An object with keys: point and compressed
 * @private
 */
PublicKey._transformX = function(odd, x){
  var info = {};
  if (typeof odd !== 'boolean') {
    throw new TypeError('Must specify whether y is odd or not (true or false)');
  }
  info.point = Point.fromX(odd, x);
  return info;
};

/**
 * Instantiate a PublicKey from JSON
 *
 * @param {String} json - A JSON string
 * @returns {PublicKey} A new valid instance of PublicKey
 */
PublicKey.fromJSON = function(json) {
  if (!PublicKey._isJSON(json)) {
    throw new TypeError('Must be a valid JSON string or plain object');
  }

  return new PublicKey(json);
};

/**
 * Internal function to transform a JSON into a public key point
 *
 * @param {Buffer} buf - a JSON string or plain object
 * @returns {Object} An object with keys: point and compressed
 * @private
 */
PublicKey._transformJSON = function(json) {
  if (JSUtil.isValidJSON(json)) {
    json = JSON.parse(json);
  }
  var x = BN(json.x, 'hex');
  var y = BN(json.y, 'hex');

  return {
    point: Point(x, y),
    compressed: json.compressed
  };
};

/**
 * Instantiate a PublicKey from a PrivateKey
 *
 * @param {PrivateKey} privkey - An instance of PrivateKey
 * @returns {PublicKey} A new valid instance of PublicKey
 */
PublicKey.fromPrivateKey = function(privkey) {
  if (!PublicKey._isPrivateKey(privkey)) {
    throw new TypeError('Must be an instance of PrivateKey');
  }
  return new PublicKey(privkey);
};

/**
 * Instantiate a PublicKey from a Buffer
 *
 * @param {Buffer} buf - A DER buffer
 * @returns {PublicKey} A new valid instance of PublicKey
 */
PublicKey.fromDER = PublicKey.fromBuffer = function(buf) {
  if (!PublicKey._isBuffer(buf)) {
    throw new TypeError('Must be a hex buffer of DER encoded public key');
  }
  return new PublicKey(buf);
};

/**
 * Instantiate a PublicKey from a Point
 *
 * @param {Point} point - A Point instance
 * @returns {PublicKey} A new valid instance of PublicKey
 */
PublicKey.fromPoint = function(point){
  if (!(point instanceof Point)) {
    throw new TypeError('First argument must be an instance of Point.');
  }
  return new PublicKey(point);
};

/**
 * Instantiate a PublicKey from a DER Buffer
 *
 * @param {String} str - A DER hex string
 * @param {String} [encoding] - The type of string encoding
 * @returns {PublicKey} A new valid instance of PublicKey
 */
PublicKey.fromString = function(str, encoding) {
  var buf = new Buffer(str, encoding || 'hex');
  return new PublicKey(buf);
};

/**
 * Instantiate a PublicKey from an X Point
 *
 * @param {Boolean} odd - If the point is above or below the x axis
 * @param {Point} x - The x point
 * @returns {PublicKey} A new valid instance of PublicKey
 */
PublicKey.fromX = function(odd, x) {
  var info = PublicKey._transformX(odd, x);
  return new PublicKey(info.point);
};

/**
 * Check if there would be any errors when initializing a PublicKey
 *
 * @param {String} data - The encoded data in various formats
 * @param {String} [compressed] - If the public key is compressed
 * @returns {null|Error} An error if exists
 */
PublicKey.getValidationError = function(data) {
  var error;
  try {
    new PublicKey(data);
  } catch (e) {
    error = e;
  }
  return error;
};

/**
 * Check if the parameters are valid
 *
 * @param {String} data - The encoded data in various formats
 * @param {String} [compressed] - If the public key is compressed
 * @returns {Boolean} If the public key would be valid
 */
PublicKey.isValid = function(data) {
  return !PublicKey.getValidationError(data);
};

/**
 * @returns {Object} A plain object of the PublicKey
 */
PublicKey.prototype.toObject = function toObject() {
  return {
    x: this.point.getX().toString('hex'),
    y: this.point.getY().toString('hex'),
    compressed: this.compressed
  };
};

PublicKey.prototype.toJSON = function toJSON(){
  return JSON.stringify(this.toObject());
};

/**
 * Will output the PublicKey to a DER Buffer
 *
 * @returns {Buffer} A DER hex encoded buffer
 */
PublicKey.prototype.toBuffer = PublicKey.prototype.toDER = function() {
  var x = this.point.getX();
  var y = this.point.getY();

  var xbuf = x.toBuffer({size: 32});
  var ybuf = y.toBuffer({size: 32});

  var prefix;
  if (!this.compressed) {
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
 * Will return an address for the public key
 *
 * @returns {Address} An address generated from the public key
 */
PublicKey.prototype.toAddress = function(network) {
  return Address.fromPublicKey(this, network);
};

/**
 * Will output the PublicKey to a DER encoded hex string
 *
 * @returns {String} A DER hex encoded string
 */
PublicKey.prototype.toString = function() {
  return this.toDER().toString('hex');
};

/**
 * Will return a string formatted for the console
 *
 * @returns {String} Public key
 */
PublicKey.prototype.inspect = function() {
  var uncompressed = !this.compressed ? ', uncompressed' : '';
  return '<PublicKey: ' + this.toString() + uncompressed + '>';
};

module.exports = PublicKey;
