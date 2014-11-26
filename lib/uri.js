'use strict';

var _ = require('lodash');

var URL = require('url');
var Address = require('./address');

var URI = function(arg, knownArgs) {
  this.extras = {};
  this.knownArgs = knownArgs || [];
  this.address = this.network = this.amount = this.message = null;

  if (typeof(arg) == 'string') {
    var params = URI.parse(arg);
    this._fromObject(params);
  } else if (typeof(arg) == 'object') {
    this._fromObject(arg);
  } else {
    throw new TypeError('Unrecognized data format.');
  }
};

URI.isValid = function(arg, knownArgs) {
  try {
    var uri = new URI(arg, knownArgs);
    return true;
  } catch(err) {
    return false;
  }
};

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


URI.prototype._fromObject = function(obj) {
  var members = ['address', 'amount', 'message', 'label'];

  if (!Address.isValid(obj.address)) throw new TypeError('Invalid bitcoin address');

  this.address = new Address(obj.address);
  this.network = this.address.network;

  if (obj.amount) this.amount = this._parseAmount(obj.amount);

  for (var key in obj) {
    if (key === 'address' || key === 'amount') continue;

    if (/^req-/.exec(key) && this.knownArgs.indexOf(key) === -1) {
      throw Error('Unknown required argument ' + key);
    }

    var destination = members.indexOf(key) > -1 ? this : this.extras;
    destination[key] = obj[key];
  }
};

URI.prototype._parseAmount = function(amount) {
  var amount = Number(amount);
  if (isNaN(amount)) throw new TypeError('Invalid amount');
  return amount; // TODO: Convert to Satoshis (yemel)
};


URI.prototype.toString = function() {
  var query = _.clone(this.extras);
  if (this.amount) query.amount = this.amount; // TODO: Convert to BTC (yemel)
  if (this.message) query.message = this.message;

  return URL.format({
    protocol: 'bitcoin:',
    host: this.address,
    query: query
  });
};

URI.prototype.inspect = function() {
  return '<URI: ' + this.toString()+ '>';
}

module.exports = URI;
