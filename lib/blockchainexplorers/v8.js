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
var Bitcore = require('bitcore-lib');
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

  var coin  = this.coin.toUpperCase();

  this.apiPrefix += `/${coin}/${this.network}`;

  this.host = opts.url;
  this.userAgent = opts.userAgent || 'bws';

  if (opts.addressFormat)  {
    $.checkArgument(Constants.ADDRESS_FORMATS.includes(opts.addressFormat), 'Unkown addr format:' + opts.addressFormat);
    this.addressFormat = opts.addressFormat != 'copay' ? opts.addressFormat : null;
  }

  this.baseUrl  = this.host + this.apiPrefix;

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

V8.prototype._getClient = function () {
  return new Client({
    baseUrl: this.baseUrl,
  });
};


V8.prototype._getAuthClient = function (wallet) {
  $.checkState(wallet.beAuthPrivateKey);
  return new Client({
    baseUrl: this.baseUrl,
    authKey: Bitcore.PrivateKey(wallet.beAuthPrivateKey),
  });
};



V8.prototype.addAddresses = function (wallet, addresses, cb) {
  var self = this;
  var client = this._getAuthClient(wallet);

  const payload = _.map(addresses,  a => {
    if (self.addressFormat) {
        a = self.translateQueryAddresses(a);
    }

    return {
      address: a,
    }
  }); 
   client.importAddresses({ 
      payload: payload, 
      pubKey: wallet.beAuthPublicKey,
    })
      .then( ret => {
      return cb(null, ret);
    })
      .catch (cb);
};



V8.prototype.register = function (wallet, cb) {
  if(wallet.coin != this.coin || wallet.network != this.network ) {
    return cb(new Error('Network coin or network mismatch'));
  }

  var client = this._getAuthClient(wallet);
  const payload = {
    name: wallet.id, 
    pubKey: wallet.beAuthPublicKey,
    network: this.network,
    chain: this.coin,
  };
  client.register({
    authKey: wallet.beAuthPrivateKey, 
    payload: payload}
  )
    .then((ret) => {
      return cb(null, ret);
    })
    .catch(cb);
};

V8.prototype.getBalance = async function (wallet, cb) {
  var client = this._getAuthClient(wallet);
  client.getBalance({pubKey: wallet.beAuthPublicKey, payload: {} })
    .then( (ret) => {
      return cb(null, ret);
    })
    .catch(cb);
};



V8.prototype.getConnectionInfo = function() {
  return 'V8 (' + this.coin + '/' + this.network + ') @ ' + this.hosts;
};

/**
 * Retrieve a list of unspent outputs associated with an address or set of addresses
 */
V8.prototype.getUtxos = function(wallet, cb) {
  var self = this;
  var client = this._getAuthClient(wallet);
  client.getCoins({pubKey: wallet.beAuthPublicKey, payload: {} })
    .then( (unspent) => {
      _.each(unspent, function(x) {
        if (self.addressFormat) {
          x.address = self.translateResultAddresses(x.address);
        }
        // v8 field name differences
        x.amount = x.value / 1e8;
      });
      return cb(null, unspent);
    })
    .catch(cb);
};
/**
 * Broadcast a transaction to the bitcoin network
 */
V8.prototype.broadcast = function(rawTx, cb) {
  throw "not implemented yet";

  var payload = {
    rawtx: rawTx,
    network: this.network,
    chain: this.coin,
  };

  var client = this._getClient();
  client.broadcast({payload: payload })
    .then( (ret) => {
      return cb(null, ret.txid);
    })
    .catch(cb);
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

V8.prototype.getTransactions = function(wallet, from, to, cb) {
  var self = this;
  var qs = [];
  var total;

  if (_.isNumber(from) || _.isNumber(to)) {
    log.warn('from/to not yet implemented on v8');
  }

  from = 0;
  to = 1535502964000;
  
  
  var client = this._getAuthClient(wallet);

  var txs = [], total;
  var txStream = client.listTransactions({pubKey: wallet.beAuthPublicKey, payload: {from ,to} });

console.log('[v8.js.237] STREAM:'); //TODO
//  txStream.pipe(process.stderr);
//  return cb(null, txs, total);

  txStream.on('data', (tx) => {
console.log('[v8.js.235:tx:]',tx); //TODO

  });

  txStream.on('end', () => {

console.log('[v8.js.241] DONE'); //TODO
    // TODO: total
    total = txs.length;
    return cb(null, txs, total);
  });

  txStream.on('error', (err) => {
console.log('[v8.js.247:err:]',err); //TODO
    return cb(err);
  });



 //     _.each(txs, function(x) {
       // if (self.addressFormat) {
          // TODO
          //self.translateTx(tx);
          //x.address = self.translateResultAddresses(x.address);
     //   }
        // v8 field name differences
   //     x.amount = x.value / 1e8;
 //     });

      //TODO: total
//      return cb(null, txs, txs.length);
}

V8.prototype.getAddressActivity = function(address, cb) {
  var self = this;

  log.info('', 'getAddressActivity not impremented in v8');
  return cb(null, true);

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
