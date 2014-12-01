'use strict';

var _ = require('lodash');
var URL = require('url');

var Address = require('./address');
var Unit = require('./unit');

/**
 *
 * Bitcore URI
 *
 * Instantiate an URI from a bitcoin URI String or an Object. An URI instance
 * can be created with a bitcoin uri string or an object. All instances of
 * URI are valid, the static method isValid allows checking before instanciation.
 *
 * All standard parameters can be found as members of the class, the address
 * is represented using an {Address} instance and the amount is represented in
 * satoshis. Any other non-standard parameters can be found under the extra member.
 *
 * @example
 *
 * var uri = new URI('bitcoin:12A1MyfXbW6RhdRAZEqofac5jCQQjwEPBu?amount=1.2');
 * console.log(uri.address, uri.amount);
 *
 * @param {string|Object} data - A bitcoin URI string or an Object
 * @param {Array.<string>} [knownParams] - Required non-standard params
 * @throws {TypeError} Invalid bitcoin address
 * @throws {TypeError} Invalid amount
 * @throws {Error} Unknown required argument
 * @returns {URI} A new valid and frozen instance of URI
 */
var URI = function(data, knownParams) {
  this.extras = {};
  this.knownParams = knownParams || [];
  this.address = this.network = this.amount = this.message = null;

  if (typeof(data) == 'string') {
    var params = URI.parse(data);
    if (params.amount) params.amount = this._parseAmount(params.amount);
    this._fromObject(params);
  } else if (typeof(data) == 'object') {
    this._fromObject(data);
  } else {
    throw new TypeError('Unrecognized data format.');
  }
};

/**
 *
 * Check if an bitcoin URI string is valid
 *
 * @example
 *
 * var valid = URI.isValid('bitcoin:12A1MyfXbW6RhdRAZEqofac5jCQQjwEPBu');
 * // true
 *
 * @param {string|Object} data - A bitcoin URI string or an Object
 * @param {Array.<string>} [knownParams] - Required non-standard params
 * @returns {boolean} Result of uri validation
 */
URI.isValid = function(arg, knownParams) {
  try {
    var uri = new URI(arg, knownParams);
    return true;
  } catch(err) {
    return false;
  }
};

/**
 *
 * Convert a bitcoin URI string into a simple object.
 *
 * @param {string} uri - A bitcoin URI string
 * @throws {TypeError} Invalid bitcoin URI
 * @returns {Object} An object with the parsed params
 */
URI.parse = function(uri) {
  var info = URL.parse(uri, true);

  if (info.protocol != 'bitcoin:') {
    throw new TypeError('Invalid bitcoin URI');
  }

  // workaround to host insensitiveness
  var group = /[^:]*:\/?\/?([^?]*)/.exec(uri);
  info.query.address = group && group[1] || undefined;

  return info.query;
};

/**
 *
 * Internal function to load the URI instance with an object.
 *
 * @param {Object} obj - Object with the information
 * @throws {TypeError} Invalid bitcoin address
 * @throws {TypeError} Invalid amount
 * @throws {Error} Unknown required argument
 */
URI.prototype._fromObject = function(obj) {
  var members = ['address', 'amount', 'message', 'label', 'r'];

  if (!Address.isValid(obj.address)) throw new TypeError('Invalid bitcoin address');

  this.address = new Address(obj.address);
  this.network = this.address.network;
  this.amount = obj.amount;

  for (var key in obj) {
    if (key === 'address' || key === 'amount') continue;

    if (/^req-/.exec(key) && this.knownParams.indexOf(key) === -1) {
      throw Error('Unknown required argument ' + key);
    }

    var destination = members.indexOf(key) > -1 ? this : this.extras;
    destination[key] = obj[key];
  }
};

/**
 *
 * Internal function to transform a BTC string amount into satoshis
 *
 * @param {String} amount - Amount BTC string
 * @throws {TypeError} Invalid amount
 * @returns {Object} Amount represented in satoshis
 */
URI.prototype._parseAmount = function(amount) {
  var amount = Number(amount);
  if (isNaN(amount)) throw new TypeError('Invalid amount');
  return Unit.fromBTC(amount).toSatoshis();
};

/**
 *
 * Will return a the string representation of the URI
 *
 * @returns {String} Bitcoin URI string
 */
URI.prototype.toString = function() {
  var query = _.clone(this.extras);
  if (this.amount) query.amount = Unit.fromSatoshis(this.amount).toBTC();
  if (this.message) query.message = this.message;

  return URL.format({
    protocol: 'bitcoin:',
    host: this.address,
    query: query
  });
};

/**
 *
 * Will return a string formatted for the console
 *
 * @returns {String} Bitcoin URI
 */
URI.prototype.inspect = function() {
  return '<URI: ' + this.toString()+ '>';
}

module.exports = URI;
