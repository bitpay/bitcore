'use strict';

var Networks = require('../networks');
var JSUtil = require('../util/js');
var $ = require('../util/preconditions');
var _ = require('lodash');
var Address = require('../address');
var Transaction = require('../transaction');
var UTXO = require('../utxo');

var request = require('request');

// var insight = new Insight(Networks.livenet);

function Insight(url, network) {
  if (!url && !network) {
    return new Insight(Networks.defaultNetwork);
  }
  if (Networks.get(url)) {
    network = Networks.get(url);
    if (network === Networks.livenet) {
      url = 'https://insight.bitpay.com';
    } else {
      url = 'https://test-insight.bitpay.com';
    }
  }
  JSUtil.defineImmutable(this, {
    url: url,
    network: Networks.get(network) || Networks.defaultNetwork
  });
  return this;
}

Insight.prototype.getUnspentUtxos = function(addresses, callback) {
  $.checkArgument(_.isFunction(callback));
  if (!_.isArray(addresses)) {
    addresses = [addresses];
  }
  addresses = _.map(addresses, function(address) { return new Address(address); });

  this.requestPost('/api/addrs/utxo', {
    addrs: _.map(addresses, function(address) { return address.toString(); }).join(',')
  }, function(err, res, unspent) {
    if (err || res.statusCode !== 200) {
      return callback(err || res);
    }
    unspent = _.map(unspent, UTXO);

    return callback(null, unspent);
  });
};

Insight.prototype.broadcast = function(transaction, callback) {
  $.checkArgument(JSUtil.isHexa(transaction) || transaction instanceof Transaction);
  $.checkArgument(_.isFunction(callback));
  if (transaction instanceof Transaction) {
    transaction = transaction.serialize();
  }

  this.requestPost('/api/tx/send', {
    rawtx: transaction
  }, function(err, res, body) {
    if (err || res.statusCode !== 200) {
      return callback(err || body);
    }
    return callback(null, body ? body.txid : null);
  });
};

Insight.prototype.requestPost = function(path, data, callback) {
  $.checkArgument(_.isString(path));
  $.checkArgument(_.isFunction(callback));
  request({
    method: 'POST',
    url: this.url + path,
    json: data
  }, callback);
};

module.exports = Insight;
