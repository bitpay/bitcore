'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var log = require('npmlog');
log.debug = log.verbose;

var Explorers = require('bitcore-explorers');
var request = require('request');
var io = require('socket.io-client');

var PROVIDERS = {
  'insight': {
    'livenet': 'https://insight.bitpay.com:443',
    'testnet': 'https://test-insight.bitpay.com:443',
  },
};

function BlockChainExplorer(opts) {
  $.checkArgument(opts);

  this.provider = opts.provider || 'insight';
  this.network = opts.network || 'livenet';

  $.checkState(PROVIDERS[this.provider], 'Provider ' + this.provider + ' not supported');
  $.checkState(PROVIDERS[this.provider][this.network], 'Network ' + this.network + ' not supported');

  this.url = opts.url || PROVIDERS[this.provider][this.network];

  switch (this.provider) {
    default:
    case 'insight':
      var explorer = new Explorers.Insight(this.url, this.network);
      explorer.getTransaction = _.bind(getTransactionInsight, explorer, this.url);
      explorer.getTransactions = _.bind(getTransactionsInsight, explorer, this.url);
      explorer.getAddressActivity = _.bind(getAddressActivityInsight, explorer, this.url);
      explorer.initSocket = _.bind(initSocketInsight, explorer, this.url);
      return explorer;
  };
};

BlockChainExplorer.prototype.getConnectionInfo = function() {
  return this.provider + ' (' + this.network + ') @ ' + this.url;
};

function getTransactionInsight(url, txid, cb) {
  var url = url + '/api/tx/' + txid;
  var args = {
    method: "GET",
    url: url,
  };

  request(args, function(err, res, tx) {
    if (err || res.statusCode != 200) return cb(err || res);
    return cb(null, tx);
  });
};

function getTransactionsInsight(url, addresses, from, to, cb) {
  var qs = [];
  if (_.isNumber(from)) qs.push('from=' + from);
  if (_.isNumber(to)) qs.push('to=' + to);

  var url = url + '/api/addrs/txs' + (qs.length > 0 ? '?' + qs.join('&') : '');
  var args = {
    method: "POST",
    url: url,
    json: {
      addrs: [].concat(addresses).join(',')
    },
  };

  request(args, function(err, res, txs) {
    if (err || res.statusCode != 200) return cb(err || res);
    // NOTE: Whenever Insight breaks communication with bitcoind, it returns invalid data but no error code.
    if (!_.isArray(txs) || (txs.length != _.compact(txs).length)) return cb(new Error('Could not retrieve transactions from blockchain. Request was:' + JSON.stringify(args)));

    return cb(null, txs);
  });
};

function getAddressActivityInsight(url, addresses, cb) {
  getTransactionsInsight(url, addresses, null, null, function(err, result) {
    if (err) return cb(err);
    return cb(null, result && result.length > 0);
  });
};

function initSocketInsight(url) {
  var socket = io.connect(url, {
    'reconnection': true,
  });
  return socket;
};

module.exports = BlockChainExplorer;
