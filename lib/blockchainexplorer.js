'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var log = require('npmlog');
log.debug = log.verbose;

var Explorers = require('bitcore-explorers');
var request = require('request');
var io = require('socket.io-client');


function BlockChainExplorer(opts) {
  $.checkArgument(opts);
  var provider = opts.provider || 'insight';
  var network = opts.network || 'livenet';
  var dfltUrl = network == 'livenet' ? 'https://insight.bitpay.com:443' :
    'https://test-insight.bitpay.com:443';
  var url = opts.url || dfltUrl;

  var url;
  switch (provider) {
    case 'insight':
      var explorer = new Explorers.Insight(url, network);
      explorer.getTransactions = _.bind(getTransactionsInsight, explorer, url);
      explorer.getAddressActivity = _.bind(getAddressActivityInsight, explorer, url);
      explorer.initSocket = _.bind(initSocketInsight, explorer, url);
      return explorer;
    default:
      throw new Error('Provider ' + provider + ' not supported');
  };
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
