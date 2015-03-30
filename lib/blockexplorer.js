'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var log = require('npmlog');
log.debug = log.verbose;

var Explorers = require('bitcore-explorers');
var request = require('request');


function BlockExplorer(opts) {
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
      var bc = new Explorers.Insight(url, network);
      bc.getTransactions = _.bind(getTransactionsInsight, bc, url);
      this.blockExplorer = bc;
      break;
    default:
      throw new Error('Provider ' + provider + ' not supported');
      break;
  };
};


function getTransactionsInsight(url, addresses, cb) {
  request({
    method: "POST",
    url: url + '/api/addrs/txs',
    json: {
      addrs: [].concat(addresses).join(',')
    }
  }, function(err, res, body) {
    if (err || res.statusCode != 200) return cb(err || res);
    return cb(null, body);
  });
};

module.exports = BlockExplorer;
