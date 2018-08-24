'use strict';

var _ = require('lodash');
var async = require('async');
var $ = require('preconditions').singleton();
var log = require('npmlog');
log.debug = log.verbose;
var io = require('socket.io-client');
var Common = require('../common');
var Client = require('./v8/client');
var BCHAddressTranslator = require('../bchaddresstranslator');
var Constants = Common.Constants,
  Defaults = Common.Defaults,
  Utils = Common.Utils;

function V8(opts) {
  $.checkArgument(opts);
  $.checkArgument(Utils.checkValueInCollection(opts.network, Constants.NETWORKS));
  $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.COINS));
  $.checkArgument(opts.url);

  this.apiPrefix = _.isUndefined(opts.apiPrefix)? '/api' : opts.apiPrefix; 
  this.coin = opts.coin || Defaults.COIN;
  this.network = opts.network || 'livenet';

  this.apiPrefix += `/${this.coin}/${this.network}`;

  this.host = opts.url;
  this.userAgent = opts.userAgent || 'bws';

  if (opts.addressFormat)  {
    $.checkArgument(Constants.ADDRESS_FORMATS.includes(opts.addressFormat), 'Unkown addr format:' + opts.addressFormat);
    this.addressFormat = opts.addressFormat != 'copay' ? opts.addressFormat : null;
  }

    this.client = new Client({
      baseUrl: this.baseUrl,
      authKey: this.getAuthSigningKey()
    });
 

}

var _parseErr = function(err, res) {
  if (err) {
    log.warn('V8 error: ', err);
    return "V8 Error";
  }
  log.warn("V8 " + res.request.href + " Returned Status: " + res.statusCode);
  return "Error querying the blockchain";
};


// Translate Request Address query
V8.prototype.translateQueryAddresses = function(addresses) {
  if (!this.addressFormat) return addresses;
  return BCHAddressTranslator.translate(addresses, this.addressFormat, 'copay');
};


// Translate Result Address
V8.prototype.translateResultAddresses = function(addresses) {
  if (!this.addressFormat) return addresses;

  return BCHAddressTranslator.translate(addresses, 'copay', this.addressFormat);
};


V8.prototype.translateTx = function(tx) {
  var self = this;
  if (!this.addressFormat) return tx;

  _.each(tx.vin, function(x){
    if (x.addr) {
      x.addr =  self.translateResultAddresses(x.addr);
    }
  });


  _.each(tx.vout, function(x){
    if (x.scriptPubKey && x.scriptPubKey.addresses) {
      x.scriptPubKey.addresses = self.translateResultAddresses(x.scriptPubKey.addresses);
    }
  });

};

V8.prototype.supportsGrouping = function () {
  return true;
};


V8.prototype.addAddress = function () {
};



V8.prototype.register = function (name, xPubKey) {
  
Client.prototype.register = async function (params) {
  /*
    const payload = {
      path: this.derivationPath,
    };
*/


  const payload = {
    name: walletId,
    pubKey: xPubKey,
    network: this.network,
    chain: this.coin,
  };
console.log('[v8.js.161:payload:]',payload); //TODO


  return request.post(url, {
    body: payload,
    json: true
  });
};

V8.prototype.getBalance = async function (params) {
  const { payload, pubKey } = params;
  const url = `${this.baseUrl}/wallet/${pubKey}/balance`;
  const signature = this.sign({ method: 'GET', url, payload });
  return request.get(url, {
    headers: { 'x-signature': signature },
    body: payload,
    json: true
  });
};



V8.prototype.getConnectionInfo = function() {
  return 'V8 (' + this.coin + '/' + this.network + ') @ ' + this.hosts;
};

V8.prototype.addWalletAddresses = function(walletV8Id, addresses, cb) {
};

V8.prototype.createWallet = function( cb) {
}

/**
 * Retrieve a list of unspent outputs associated with an address or set of addresses
 */
V8.prototype.getUtxos = function(walletName, cb, walletId) {
  var self = this; 

  var url = this.url + this.apiPrefix + '/addrs/utxo';
  var args = {
    method: 'POST',
    path: this.apiPrefix + '/addrs/utxo',
    json: {
    },
  };

  this._doRequest(args, function(err, res, unspent) {
    if (err || res.statusCode !== 200) return cb(_parseErr(err, res));

    if (self.addressFormat) {

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
V8.prototype.broadcast = function(rawTx, cb) {
  throw "not implemented yet";

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

V8.prototype.getTransaction = function(txid, cb) {
  throw "not implemented yet";

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

V8.prototype.getTransactions = function(addresses, from, to, cb, walletId) {
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
    timeout: Defaults.INSIGHT_TIMEOUT * 1.2 , // little extra time
    walletId: walletId, //only to report
  };


  this.requestQueue.push(args, function(err, res, txs) {
    if (err || res.statusCode !== 200) return cb(_parseErr(err, res));

    if (_.isObject(txs)) {
      if (txs.totalItems)
        total = txs.totalItems;

      if (txs.items)
        txs = txs.items;
    }

    // NOTE: Whenever V8 breaks communication with bitcoind, it returns invalid data but no error code.
    if (!_.isArray(txs) || (txs.length != _.compact(txs).length)) return cb(new Error('Could not retrieve transactions from blockchain. Request was:' + JSON.stringify(args)));

    if (self.addressFormat) {

      _.each(txs, function(tx){
        self.translateTx(tx);
      });
    }

    return cb(null, txs, total);
  });
};

V8.prototype.getAddressActivity = function(address, cb) {
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

V8.prototype.estimateFee = function(nbBlocks, cb) {
  throw "not implemented yet";
  var path = this.apiPrefix + '/fee/:target';

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

V8.prototype.getBlockchainHeight = function(cb) {
  var path = this.apiPrefix + '/block/tip';

  var args = {
    method: 'GET',
    path: path,
    json: true,
  };
  this.requestQueue.push(args, function(err, res, body) {
    if (err || res.statusCode !== 200) return cb(_parseErr(err, res));
    return cb(null, body.height);
  });
};

V8.prototype.getTxidsInBlock = function(blockHash, cb) {
  throw "not implemented yet";
};

V8.prototype.initSocket = function() {
  throw "not implemented yet";
};

module.exports = V8;
