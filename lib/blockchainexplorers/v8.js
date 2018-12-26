'use strict';

var _ = require('lodash');
var async = require('async');
var $ = require('preconditions').singleton();
var log = require('npmlog');
log.debug = log.verbose;
var io = require('socket.io-client');
const request = require('request-promise-native');
var Common = require('../common');
var Client;
var BCHAddressTranslator = require('../bchaddresstranslator');
var Bitcore = require('bitcore-lib');
var Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash')
};

var Constants = Common.Constants,
  Defaults = Common.Defaults,
  Utils = Common.Utils;


function v8network(bwsNetwork) {
  if (bwsNetwork == 'livenet') return 'mainnet';
  return bwsNetwork;
};

function V8(opts) {
  $.checkArgument(opts);
  $.checkArgument(Utils.checkValueInCollection(opts.network, Constants.NETWORKS));
  $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.COINS));
  $.checkArgument(opts.url);

  this.apiPrefix = _.isUndefined(opts.apiPrefix)? '/api' : opts.apiPrefix; 
  this.coin = opts.coin || Defaults.COIN;
  this.network = opts.network || 'livenet';
  this.v8network = v8network(this.network);

  //v8 is always cashaddr
  this.addressFormat =  this.coin == 'bch' ? 'cashaddr' : null;


  var coin  = this.coin.toUpperCase();

  this.apiPrefix += `/${coin}/${this.v8network}`;

  this.host = opts.url;
  this.userAgent = opts.userAgent || 'bws';

  this.baseUrl  = this.host + this.apiPrefix;
  Client = opts.client ||Client ||  require('./v8/client');
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
  $.checkState(wallet.beAuthPrivateKey2);
  return new Client({
    baseUrl: this.baseUrl,
    authKey: Bitcore_[this.coin].PrivateKey(wallet.beAuthPrivateKey2),
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

  var k = 'addAddresses '+addresses.length;
  console.time(k);
  client.importAddresses({ 
    payload: payload, 
    pubKey: wallet.beAuthPublicKey2,
  })
    .then( ret => {
      console.timeEnd(k);
      return cb(null, ret);
    })
      .catch ((err) => {
        return cb(err) 
      });
};



V8.prototype.register = function (wallet, cb) {
  if(wallet.coin != this.coin || wallet.network != this.network ) {
    return cb(new Error('Network coin or network mismatch'));
  }

  var client = this._getAuthClient(wallet);
  const payload = {
    name: wallet.id, 
    pubKey: wallet.beAuthPublicKey2,
    network: this.v8network,
    chain: this.coin,
  };
  client.register({
    authKey: wallet.beAuthPrivateKey2, 
    payload: payload}
  )
    .then((ret) => {
      return cb(null, ret);
    })
    .catch(cb);
};

V8.prototype.getBalance = async function (wallet, cb) {
  var client = this._getAuthClient(wallet);
  client.getBalance({pubKey: wallet.beAuthPublicKey2, payload: {} })
    .then( (ret) => {
      return cb(null, ret);
    })
    .catch(cb);
};



V8.prototype.getConnectionInfo = function() {
  return 'V8 (' + this.coin + '/' + this.v8network + ') @ ' + this.host;
};

/**
 * Retrieve a list of unspent outputs associated with an address or set of addresses
 */
V8.prototype.getUtxos = function(wallet, cb) {
  var self = this;
  var client = this._getAuthClient(wallet);
  console.time('V8getUtxos');
  client.getCoins({pubKey: wallet.beAuthPublicKey2, payload: {} })
    .then( (unspent) => {
      _.each(unspent, function(x) {
        if (self.addressFormat) {
          x.address = self.translateResultAddresses(x.address);
        }
        // v8 field name differences
        x.satoshis = x.value;
        x.amount = x.value / 1e8;
        x.scriptPubKey = x.script;
        x.txid = x.mintTxid;
        x.vout = x.mintIndex;
      });
      console.timeEnd('V8getUtxos');
      return cb(null, unspent);
    })
    .catch(cb);
};
/**
 * Broadcast a transaction to the bitcoin network
 */
V8.prototype.broadcast = function(rawTx, cb) {

console.log('[v8.js.207] BROADCAST'); //TODO
  const payload = {
    rawTx: rawTx,
    network: this.v8network,
    chain: this.coin.toUpperCase(),
  };

console.log('[v8.js.209:payload:]',payload); //TODO
  var client = this._getClient();
  client.broadcast({ payload })
    .then( (ret) => {
console.log('[v8.js.218:ret:]',ret); //TODO
      if (!ret.txid) {
        return cb(new Error('Error broadcasting'));
      }
      return cb(null, ret.txid);
    })
    .catch(err => {
console.log('[v8.js.221:err:]',err); //TODO
        return cb(err);
    });
};

V8.prototype.getTransaction = function(txid, cb) {
  var self = this;
console.log('[v8.js.207] GET TX', txid); //TODO
  var client = this._getClient();
  client.getTx({txid: txid })
    .then( (tx) => {
      if (!tx || _.isEmpty(tx)) {
        return cb();
      }
      self.translateTx(tx);
      return cb(null, tx);
    })
    .catch((err) =>{ 
      // The TX was not found
      if (err.statusCode == '404') {
        return cb();
      } else {
        return cb(err);
      }
      
    });
};

V8.prototype.getTransactions = function(wallet, startBlock , cb) {
console.time('V8 getTxs');
  if (startBlock) {
    log.debug(`getTxs: startBlock ${startBlock}`);
  } else {
    log.debug(`getTxs: from 0`);
  }
   var self = this;

   var client = this._getAuthClient(wallet);
  var acum = '', broken;

  let opts = {
    includeMempool: true,
    pubKey: wallet.beAuthPublicKey2,
    payload: {},
  }

  if (_.isNumber(startBlock))
    opts.startBlock = startBlock;

  var txStream = client.listTransactions(opts);
  txStream.on('data', (raw) => {
    acum = acum + raw.toString();
  });

  txStream.on('end', () => {
    if (broken)  {
      return;
    }

    let txs = [], unconf= [], err;
    _.each(acum.split(/\r?\n/), (rawTx) => {
     if (!rawTx)
      return;

      let tx;
      try {
        tx = JSON.parse(rawTx);
      } catch (e) {
        log.error('v8 error at JSON.parse:' + e  + ' Parsing:' + rawTx + ":");
        return cb(e);
      }
      if (tx.address && self.addressFormat) {
        tx.address = self.translateResultAddresses(tx.address);
      }
      // v8 field name differences
      if (tx.value)
        tx.amount = tx.satoshis / 1e8;

      if (tx.height>=0)
        txs.push(tx);
      else 
        unconf.push(tx);
    })
    console.timeEnd("V8 getTxs");
    // blockTime on unconf is 'seenTime';
    return cb(null, _.flatten(_.orderBy(unconf,'blockTime', 'desc').concat(txs.reverse())));
  });

  txStream.on('error', (e) => {
    log.error('v8 error:' +  e );
    broken = true;
    return cb(e);
  });
}


V8.prototype.getAddressActivity = function(address, cb) {
  var self = this;

  var url = this.baseUrl + '/address/' + this.translateQueryAddresses(address) + '/txs?limit=1';
console.log('[v8.js.328:url:] CHECKING ADDRESS ACTIVITY',url); //TODO
  request.get(url, {})
    .then( (ret) => {
      return cb(null, ret !== '[]');
    })
      .catch((err) => {
console.log('[v8.js.335:err:]',err); //TODO
        return cb(err);
      } );
};

V8.prototype.estimateFee = function(nbBlocks, cb) {
  var self = this;
  nbBlocks = nbBlocks || [1,2,6,24];
  var result = {};

  async.each(nbBlocks, function(x, icb) {
    var url = self.baseUrl + '/fee/' + x;
    request.get(url, {})
      .then( (ret) => {
        result[x] = ret;
        return icb();
      })
      .catch((err) => {return icb(err)} );
  }, function(err) {
    if (err) {
      return cb(err);
    }
    // TODO: normalize result
    return cb(null, result);
  });
};

V8.prototype.getBlockchainHeight = function(cb) {
  var url = this.baseUrl + '/block/tip';

  request.get(url, {})
    .then( (ret) => {
      try {
        ret = JSON.parse(ret);
        return cb(null, ret.height, ret.hash);
      } catch (err) {
        return cb(new Error('Could not get height from block explorer'));
      }
    })
    .catch(cb);
};

V8.prototype.getTxidsInBlock = function(blockHash, cb) {
  var url = this.baseUrl + '/tx/?blockHash=' + blockHash;
  request.get(url, {})
    .then( (ret) => {
      try {
        ret = JSON.parse(ret);
        var res =  _.map(ret,'txid');
        return cb(null,res);
      } catch (err) {
        return cb(new Error('Could not get height from block explorer'));
      }
    })
    .catch(cb);

};

V8.prototype.initSocket = function(callbacks) {
  var self = this;
  log.info('V8 connecting socket at:' + this.host);;
  // sockets always use the first server on the pull
  var socket = io.connect(this.host, {transports: ['websocket']});

  socket.on('connect', function() {
    log.info('Connected to ' +self.getConnectionInfo());
    socket.emit('room', '/' + self.coin.toUpperCase() +'/'  + self.v8network + '/inv');
  });

  socket.on('connect_error', function() {
    log.error('Error connecting to ' + self.getConnectionInfo());
  });
  socket.on('tx', _.bind(callbacks.onTx));
  socket.on('block', function(data) {
    return callbacks.onBlock(data.hash); }
  );
  socket.on('coin', (data) => {
    // script output, or similar.
    if (!data.address) return;
    var out;
    let addr = self.coin == 'bch' ? BCHAddressTranslator.translate(data.address, 'copay', 'cashaddr') : data.address;
    try {
      out = { 
        address: addr,
        amount: data.value / 1e8,
      };
    } catch (e) {
      // non parsable address
      return;
    }
    return callbacks.onIncomingPayments({outs: [out], txid: data.mintTxid}); 
  });
 
  return socket;
};

module.exports = V8;
