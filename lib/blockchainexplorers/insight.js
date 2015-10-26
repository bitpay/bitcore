'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var log = require('npmlog');
log.debug = log.verbose;
var request = require('request');
var io = require('socket.io-client');

function Insight(opts) {
  $.checkArgument(opts);
  $.checkArgument(_.contains(['livenet', 'testnet'], opts.network));
  $.checkArgument(opts.url);

  this.apiPrefix = opts.apiPrefix || '/api';
  this.network = opts.network || 'livenet';
  this.url = opts.url;
};


var _parseErr = function(err, res) {
  if (err) {
    log.warn('Insight error: ', err);
    return "Insight Error";
  }
  log.warn("Insight " + res.request.href + " Returned Status: " + res.statusCode);
  return "Error querying the blockchain";
};

Insight.prototype.getConnectionInfo = function() {
  return 'Insight (' + this.network + ') @ ' + this.url;
};

/**
 * Retrieve a list of unspent outputs associated with an address or set of addresses
 */
Insight.prototype.getUnspentUtxos = function(addresses, cb) {
  var url = this.url + this.apiPrefix + '/addrs/utxo';
  var args = {
    method: 'POST',
    url: url,
    json: {
      addrs: [].concat(addresses).join(',')
    },
  };

  request(args, function(err, res, unspent) {
    if (err || res.statusCode !== 200) return cb(_parseErr(err, res));
    return cb(null, unspent);
  });
};

/**
 * Broadcast a transaction to the bitcoin network
 */
Insight.prototype.broadcast = function(rawTx, cb) {
  var url = this.url + this.apiPrefix + '/tx/send';
  var args = {
    method: 'POST',
    url: url,
    json: {
      rawtx: rawTx
    },
  };

  request(args, function(err, res, body) {
    if (err || res.statusCode !== 200) return cb(_parseErr(err, res));
    return cb(null, body ? body.txid : null);
  });
};

Insight.prototype.getTransaction = function(txid, cb) {
  var url = this.url + this.apiPrefix + '/tx/' + txid;
  var args = {
    method: 'GET',
    url: url,
  };

  request(args, function(err, res, tx) {
    if (res && res.statusCode == 404) return cb();
    if (err || res.statusCode !== 200)
      return cb(_parseErr(err, res));

    return cb(null, tx);
  });
};

Insight.prototype.getTransactions = function(addresses, from, to, cb) {
  var qs = [];
  if (_.isNumber(from)) qs.push('from=' + from);
  if (_.isNumber(to)) qs.push('to=' + to);

  var url = this.url + this.apiPrefix + '/addrs/txs' + (qs.length > 0 ? '?' + qs.join('&') : '');
  var args = {
    method: 'POST',
    url: url,
    json: {
      addrs: [].concat(addresses).join(',')
    },
  };

  request(args, function(err, res, txs) {
    if (err || res.statusCode !== 200) return cb(_parseErr(err, res));

    if (_.isObject(txs) && txs.items)
      txs = txs.items;

    // NOTE: Whenever Insight breaks communication with bitcoind, it returns invalid data but no error code.
    if (!_.isArray(txs) || (txs.length != _.compact(txs).length)) return cb(new Error('Could not retrieve transactions from blockchain. Request was:' + JSON.stringify(args)));

    return cb(null, txs);
  });
};

Insight.prototype.getAddressActivity = function(address, cb) {
  var url = this.url + this.apiPrefix + '/addr/' + address;
  var args = {
    method: 'GET',
    url: url,
  };

  request(args, function(err, res, result) {
    if (res && res.statusCode == 404) return cb();
    if (err || res.statusCode !== 200)
      return cb(_parseErr(err, res));

    var nbTxs = result.unconfirmedTxApperances + result.txApperances;
    return cb(null, nbTxs > 0);
  });
};

Insight.prototype.estimateFee = function(nbBlocks, cb) {
  var url = this.url + this.apiPrefix + '/utils/estimatefee';
  if (nbBlocks) {
    url += '?nbBlocks=' + [].concat(nbBlocks).join(',');
  }

  var args = {
    method: 'GET',
    url: url,
    json: true,
  };
  request(args, function(err, res, body) {
    if (err || res.statusCode !== 200) return cb(_parseErr(err, res));
    return cb(null, body);
  });
};

Insight.prototype.initSocket = function() {
  var socket = io.connect(this.url, {
    'reconnection': true,
  });
  return socket;
};

module.exports = Insight;
