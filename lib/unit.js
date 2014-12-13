'use strict';

var JSUtil = require('./util/js');

/**
 *
 * Bitcore Unit
 *
 * Utility for handling and converting bitcoins units. The supported units are
 * BTC, mBTC, bits and satoshis. A unit instance can be created with an
 * amount and a unit code, or alternatively using static methods like {fromBTC}.
 * You can consult for different representation of a unit instance using it's
 * {to} method, the fixed unit methods like {toSatoshis} or alternatively using
 * the unit accessors.
 *
 * @example
 *
 * var sats = Unit.fromBTC(1.3).toSatoshis();
 * var mili = Unit.fromBits(1.3).to(Unit.mBTC);
 * var btc = new Unit(1.3, Unit.bits).BTC;
 *
 * @param {Number} amount - The amount to be represented
 * @param {String} code - The unit of the amount
 * @returns {Unit} A new instance of an Unit
 */

function Unit(amount, code) {
  if (!(this instanceof Unit)) {
    return new Unit(amount, code);
  }

  this._amount = amount;
  this._code = code;

  this._value = this._from(amount, code);

  var self = this;
  var defineAccesor = function(key) {
    Object.defineProperty(self, key, {
      get: function() { return self.to(key); },
      enumerable: true,
    });
  };

  Object.keys(UNITS).forEach(defineAccesor);
};

var UNITS = {
  'BTC'      : [1e8, 8],
  'mBTC'     : [1e5, 5],
  'bits'     : [1e2, 2],
  'satoshis' : [1, 0]
};

Object.keys(UNITS).forEach(function(key) {
  Unit[key] = key;
});

/**
 * Will return a Unit instance created from JSON string or object
 *
 * @param {String|Object} json - JSON with keys: amount and code
 * @returns {Unit} A Unit instance
 */
Unit.fromJSON = function fromJSON(json){
  if (JSUtil.isValidJSON(json)) {
    json = JSON.parse(json);
  }
  return new Unit(json.amount, json.code);
};

/**
 * Will return a Unit instance created from an amount in BTC
 *
 * @param {Number} amount - The amount in BTC
 * @returns {Unit} A Unit instance
 */
Unit.fromBTC = function(amount) {
  return new Unit(amount, Unit.BTC);
};

/**
 * Will return a Unit instance created from an amount in mBTC
 *
 * @param {Number} amount - The amount in mBTC
 * @returns {Unit} A Unit instance
 */
Unit.fromMilis = function(amount) {
  return new Unit(amount, Unit.mBTC);
};

/**
 * Will return a Unit instance created from an amount in bits
 *
 * @param {Number} amount - The amount in bits
 * @returns {Unit} A Unit instance
 */
Unit.fromBits = function(amount) {
  return new Unit(amount, Unit.bits);
};

/**
 * Will return a Unit instance created from an amount in satoshis
 *
 * @param {Number} amount - The amount in satoshis
 * @returns {Unit} A Unit instance
 */
Unit.fromSatoshis = function(amount) {
  return new Unit(amount, Unit.satoshis);
};

Unit.prototype._from = function(amount, code) {
  if (!UNITS[code]) throw Error('Unknown unit code');

  return parseInt((amount * UNITS[code][0]).toFixed());
};

/**
 * Will return the value represented in the specified unit
 *
 * @param {string} code - The unit code
 * @returns {Number} The converted value
 */
Unit.prototype.to = function(code) {
  if (!UNITS[code]) throw Error('Unknown unit code');

  var value = this._value / UNITS[code][0];
  return parseFloat(value.toFixed(UNITS[code][1]));
};

/**
 * Will return the value represented in BTC
 *
 * @returns {Number} The value converted to BTC
 */
Unit.prototype.toBTC = function() {
  return this.to(Unit.BTC);
};

/**
 *
 * Will return the value represented in mBTC
 *
 * @returns {Number} The value converted to mBTC
 */
Unit.prototype.toMilis = function(code) {
  return this.to(Unit.mBTC);
};

/**
 * Will return the value represented in bits
 *
 * @returns {Number} The value converted to bits
 */
Unit.prototype.toBits = function(code) {
  return this.to(Unit.bits);
};

/**
 * Will return the value represented in satoshis
 *
 * @returns {Number} The value converted to satoshis
 */
Unit.prototype.toSatoshis = function() {
  return this.to(Unit.satoshis);
};

/**
 * Will return a the string representation of the value in satoshis
 *
 * @returns {String} the value in satoshis
 */
Unit.prototype.toString = function() {
  return this.satoshis + ' satoshis';
};

/**
 * Will return a plain object representation of the Unit
 *
 * @returns {Object} An object with the keys: amount and code
 */
Unit.prototype.toObject = function toObject() {
  return {
    amount: this._amount,
    code: this._code
  };
};

Unit.prototype.toJSON = function toJSON() {
  return JSON.stringify(this.toObject());
};

/**
 * Will return a string formatted for the console
 *
 * @returns {String} the value in satoshis
 */
Unit.prototype.inspect = function() {
  return '<Unit: ' + this.toString() + '>';
};

module.exports = Unit;
