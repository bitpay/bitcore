'use strict';

var _ = require('lodash');
var async = require('async');
var $ = require('preconditions').singleton();
var log = require('npmlog');
log.debug = log.verbose;
var io = require('socket.io-client');
var requestList = require('./request-list');
var Common = require('../common');
var AddressTranslator = require('../addresstranslator');
var Constants = Common.Constants,
  Defaults = Common.Defaults,
  Utils = Common.Utils;

function Insight(opts) {
  $.checkArgument(opts);
  $.checkArgument(Utils.checkValueInCollection(opts.network, Constants.NETWORKS));
  $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.COINS));
  $.checkArgument(opts.url);

  this.apiPrefix = _.isUndefined(opts.apiPrefix)? '/api' : opts.apiPrefix;
  this.coin = opts.coin || Defaults.COIN;
  this.network = opts.network || 'livenet';
  this.hosts = opts.url;
  this.userAgent = opts.userAgent || 'bws';
  this.shouldTranslateAddresses = _.isUndefined(opts.translateAddresses) ? this.coin == 'bch' : opts.translateAddresses;

  this.requestQueue = async.queue(this._doRequest.bind(this), Defaults.INSIGHT_REQUEST_POOL_SIZE);

}

var _parseErr = function(err, res) {
  if (err) {
    log.warn('Insight error: ', err);
    return "Insight Error";
  }
  log.warn("Insight " + res.request.href + " Returned Status: " + res.statusCode);
  return "Error querying the blockchain";
};


// Translate Request Address query
Insight.prototype.translateQueryAddresses = function(addresses) {
  if (!this.shouldTranslateAddresses) return addresses;

  // It is called 'translatedInput' from Cxxx to 1xxx because the
  // module was created for insight-api
  return AddressTranslator.translateInput(addresses);
};


// Translate Result Address
Insight.prototype.translateResultAddresses = function(addresses) {
  if (!this.shouldTranslateAddresses) return addresses;

  // It is called 'translateOutput' from 1xxx to Cxxx because the
  // module was created for insight-api
  return AddressTranslator.translateOutput(addresses);
};


Insight.prototype.translateTx = function(tx) {
  if (!this.shouldTranslateAddresses) return tx;

  _.each(tx.vin, function(x){
    if (x.addr) {
      x.addr =  AddressTranslator.translateOutput(x.addr);
    }
  });


  _.each(tx.vout, function(x){
    if (x.scriptPubKey && x.scriptPubKey.addresses) {
      x.scriptPubKey.addresses = AddressTranslator.translateOutput(x.scriptPubKey.addresses);
    }
  });

};


Insight.prototype._doRequest = function(args, cb) {
  var opts = {
    hosts: this.hosts,
    headers: {
      'User-Agent': this.userAgent,
    }
  };

  var s  = JSON.stringify(args);
//  if ( s.length > 100 )
//    s= s.substr(0,100) + '...';
  log.debug('', 'Insight Q: %s', s);

  requestList(_.defaults(args, opts), cb);
};

Insight.prototype.getConnectionInfo = function() {
  return 'Insight (' + this.coin + '/' + this.network + ') @ ' + this.hosts;
};

/**
 * Retrieve a list of unspent outputs associated with an address or set of addresses
 */
Insight.prototype.getUtxos = function(addresses, cb) {
  var self = this; 

  var url = this.url + this.apiPrefix + '/addrs/utxo';
  var args = {
    method: 'POST',
    path: this.apiPrefix + '/addrs/utxo',
    json: {
      addrs: this.translateQueryAddresses(_.uniq([].concat(addresses))).join(',')
    },
  };

  this.requestQueue.push(args, function(err, res, unspent) {
    if (err || res.statusCode !== 200) return cb(_parseErr(err, res));

    if (self.shouldTranslateAddresses) {
      _.each(unspent, function(x) {
        x.address = self.translateResultAddresses(x.address);
      });
    }
    return cb(null, unspent);
  });
};

/**
 * Broadcast a transaction to the bitcoin network
 */
Insight.prototype.broadcast = function(rawTx, cb) {
  var args = {
    method: 'POST',
    path: this.apiPrefix + '/tx/send',
    json: {
      rawtx: rawTx
    },
  };

  this.requestQueue.push(args, function(err, res, body) {
    if (err || res.statusCode !== 200) return cb(_parseErr(err, res));
    return cb(null, body ? body.txid : null);
  });
};

Insight.prototype.getTransaction = function(txid, cb) {
  var self = this;
  var args = {
    method: 'GET',
    path: this.apiPrefix + '/tx/' + txid,
    json: true,
  };

  this.requestQueue.push(args, function(err, res, tx) {
    if (res && res.statusCode == 404) return cb();
    if (err || res.statusCode !== 200)
      return cb(_parseErr(err, res));

    self.translateTx(tx);

    return cb(null, tx);
  });
};

Insight.prototype.getTransactions = function(addresses, from, to, cb) {
  var self = this;


  var qs = [];
  var total;
  if (_.isNumber(from)) qs.push('from=' + from);
  if (_.isNumber(to)) qs.push('to=' + to);

  // Trim output
  qs.push('noAsm=1');
  qs.push('noScriptSig=1');
  qs.push('noSpent=1');

  var args = {
    method: 'POST',
    path: this.apiPrefix + '/addrs/txs' + (qs.length > 0 ? '?' + qs.join('&') : ''),
    json: {
      addrs: this.translateQueryAddresses(_.uniq([].concat(addresses))).join(',')
    },
    timeout: 120000,
  };


  this.requestQueue.push(args, function(err, res, txs) {
    if (err || res.statusCode !== 200) return cb(_parseErr(err, res));

    if (_.isObject(txs)) {
      if (txs.totalItems)
        total = txs.totalItems;

      if (txs.items)
        txs = txs.items;
    }

    // NOTE: Whenever Insight breaks communication with bitcoind, it returns invalid data but no error code.
    if (!_.isArray(txs) || (txs.length != _.compact(txs).length)) return cb(new Error('Could not retrieve transactions from blockchain. Request was:' + JSON.stringify(args)));

    if (self.shouldTranslateAddresses) {

      _.each(txs, function(tx){
        self.translateTx(tx);
      });
    }

    return cb(null, txs, total);
  });
};

Insight.prototype.getAddressActivity = function(address, cb) {
  var self = this;

  var args = {
    method: 'GET',
    path: self.apiPrefix + '/addr/' + this.translateQueryAddresses(address),
    json: true,
  };

  this.requestQueue.push(args, function(err, res, result) {
    if (res && res.statusCode == 404) return cb();
    if (err || res.statusCode !== 200)
      return cb(_parseErr(err, res));

    // note: result.addrStr is not translated, but not used.  

    var nbTxs = result.unconfirmedTxApperances + result.txApperances;
    return cb(null, nbTxs > 0);
  });
};

Insight.prototype.estimateFee = function(nbBlocks, cb) {
  var path = this.apiPrefix + '/utils/estimatefee';
  if (nbBlocks) {
    path += '?nbBlocks=' + [].concat(nbBlocks).join(',');
  }

  var args = {
    method: 'GET',
    path: path,
    json: true,
  };
  this.requestQueue.push(args, function(err, res, body) {
    if (err || res.statusCode !== 200) return cb(_parseErr(err, res));
    return cb(null, body);
  });
};

Insight.prototype.getBlockchainHeight = function(cb) {
  var path = this.apiPrefix + '/sync';

  var args = {
    method: 'GET',
    path: path,
    json: true,
  };
  this.requestQueue.push(args, function(err, res, body) {
    if (err || res.statusCode !== 200) return cb(_parseErr(err, res));
    return cb(null, body.blockChainHeight);
  });
};

Insight.prototype.getTxidsInBlock = function(blockHash, cb) {
  var self = this;

  var args = {
    method: 'GET',
    path: this.apiPrefix + '/block/' + blockHash,
    json: true,
  };

  this.requestQueue.push(args, function(err, res, body) {
    if (err || res.statusCode !== 200) return cb(_parseErr(err, res));
    return cb(null, body.tx);
  });
};

Insight.prototype.initSocket = function() {

  // sockets always use the first server on the pull
  var socket = io.connect(_.first([].concat(this.hosts)), {
    'reconnection': true,
  });
  return socket;
};

module.exports = Insight;
