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

  var url;
  switch (provider) {
    case 'insight':
      switch (network) {
        default:
        case 'livenet':
          url = 'https://insight.bitpay.com:443';
          break;
        case 'testnet':
          url = 'https://test-insight.bitpay.com:443'
          break;
      }
      var explorer = new Explorers.Insight(url, network);
      explorer.getTransactions = _.bind(getTransactionsInsight, explorer, url);
      explorer.getActivity = _.bind(getActivityInsight, explorer, url);
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

  request({
    method: "POST",
    url: url,
    json: {
      addrs: [].concat(addresses).join(',')
    }
  }, function(err, res, body) {
    if (err || res.statusCode != 200) return cb(err || res);
    return cb(null, body);
  });
};

function getActivityInsight(url, addresses, cb) {
  getTransactionsInsight(url, addresses, 0, 0, function(err, result) {
    if (err) return cb(err);
    return cb(null, result.items > 0);
  });
};

function initSocketInsight(url) {
  var socket = io.connect(url, {});
  return socket;
};

module.exports = BlockChainExplorer;
