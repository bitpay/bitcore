'use strict';

import * as request from 'request-promise-native';
import { Client } from './v8/client';
var _ = require('lodash');
var async = require('async');
var $ = require('preconditions').singleton();
var log = require('npmlog');
log.debug = log.verbose;
var io = require('socket.io-client');
var Common = require('../common');
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
}

export class V8 {
  coin: string;
  network: string;
  v8network: string;
  //v8 is always cashaddr
  addressFormat: string;
  apiPrefix: string;
  host: string;
  userAgent: string;
  baseUrl: string;
  request: request;
  Client: Client;

  constructor(opts) {
    $.checkArgument(opts);
    $.checkArgument(
      Utils.checkValueInCollection(opts.network, Constants.NETWORKS)
    );
    $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.COINS));
    $.checkArgument(opts.url);

    this.apiPrefix = _.isUndefined(opts.apiPrefix) ? '/api' : opts.apiPrefix;
    this.coin = opts.coin || Defaults.COIN;
    this.network = opts.network || 'livenet';
    this.v8network = v8network(this.network);

    //v8 is always cashaddr
    this.addressFormat = this.coin == 'bch' ? 'cashaddr' : null;

    var coin = this.coin.toUpperCase();

    this.apiPrefix += `/${coin}/${this.v8network}`;

    this.host = opts.url;
    this.userAgent = opts.userAgent || 'bws';

    this.baseUrl = this.host + this.apiPrefix;

    // for testing
    //
    this.request = opts.request || request;
    this.Client = opts.client || Client || require('./v8/client');
  }

  // Translate Request Address query
  translateQueryAddresses(addresses) {
    if (!this.addressFormat) return addresses;

    return BCHAddressTranslator.translate(
      addresses,
      this.addressFormat,
      'copay'
    );
  }

  // Translate Result Address
  translateResultAddresses(addresses) {
    if (!this.addressFormat) return addresses;

    return BCHAddressTranslator.translate(
      addresses,
      'copay',
      this.addressFormat
    );
  }

  translateTx(tx) {
    var self = this;
    if (!this.addressFormat) return tx;

    _.each(tx.vin, function(x) {
      if (x.addr) {
        x.addr = self.translateResultAddresses(x.addr);
      }
    });

    _.each(tx.vout, function(x) {
      if (x.scriptPubKey && x.scriptPubKey.addresses) {
        x.scriptPubKey.addresses = self.translateResultAddresses(
          x.scriptPubKey.addresses
        );
      }
    });
  }

  _getClient() {
    return new Client({
      baseUrl: this.baseUrl
    });
  }

  _getAuthClient(wallet) {
    $.checkState(wallet.beAuthPrivateKey2);
    return new Client({
      baseUrl: this.baseUrl,
      authKey: Bitcore_[this.coin].PrivateKey(wallet.beAuthPrivateKey2)
    });
  }

  addAddresses(wallet, addresses, cb) {
    var self = this;
    var client = this._getAuthClient(wallet);

    const payload = _.map(addresses, a => {
      return {
        address: a
      };
    });

    var k = 'addAddresses' + addresses.length;
    console.time(k);
    client
      .importAddresses({
        payload: payload,
        pubKey: wallet.beAuthPublicKey2
      })
      .then(ret => {
        console.timeEnd(k);
        return cb(null, ret);
      })
      .catch(err => {
        return cb(err);
      });
  }

  register(wallet, cb) {
    if (wallet.coin != this.coin || wallet.network != this.network) {
      return cb(new Error('Network coin or network mismatch'));
    }

    var client = this._getAuthClient(wallet);
    const payload = {
      name: wallet.id,
      pubKey: wallet.beAuthPublicKey2,
      network: this.v8network,
      chain: this.coin
    };
    client
      .register({
        authKey: wallet.beAuthPrivateKey2,
        payload: payload
      })
      .then(ret => {
        return cb(null, ret);
      })
      .catch(cb);
  }

  getBalance = async function(wallet, cb) {
    var client = this._getAuthClient(wallet);
    client
      .getBalance({ pubKey: wallet.beAuthPublicKey2, payload: {} })
      .then(ret => {
        return cb(null, ret);
      })
      .catch(cb);
  };

  getConnectionInfo() {
    return 'V8 (' + this.coin + '/' + this.v8network + ') @ ' + this.host;
  }

  _transformUtxos(unspent, bcheight) {
    $.checkState(bcheight > 0, 'No BC height passed to _transformUtxos');
    var self = this;

    let ret = _.map(
      _.reject(unspent, x => {
        return x.spentHeight && x.spentHeight <= -3;
      }),
      x => {
        var u = {
          address: x.address,
          satoshis: x.value,
          amount: x.value / 1e8,
          scriptPubKey: x.script,
          txid: x.mintTxid,
          vout: x.mintIndex,
          locked: false,
          confirmations: x.mintHeight > 0 ? bcheight - x.mintHeight + 1 : 0
        };

        // v8 field name differences
        return u;
      }
    );

    return ret;
  }

  /**
   * Retrieve a list of unspent outputs associated with an address or set of addresses
   *
   *
   * This is for internal usage, address should be on internal representaion
   */
  getUtxos(wallet, height, cb) {
    $.checkArgument(cb);
    var self = this;
    var client = this._getAuthClient(wallet);
    console.time('V8getUtxos');
    client
      .getCoins({ pubKey: wallet.beAuthPublicKey2, payload: {} })
      .then(unspent => {
        console.timeEnd('V8getUtxos');
        return cb(null, self._transformUtxos(unspent, height));
      })
      .catch(cb);
  }

  /**
   * Check wallet addresses
   */
  getCheckData(wallet, cb) {
    var self = this;
    var client = this._getAuthClient(wallet);
    console.time('WalletCheck');
    client
      .getCheckData({ pubKey: wallet.beAuthPublicKey2, payload: {} })
      .then(checkInfo => {
        console.timeEnd('WalletCheck');
        return cb(null, checkInfo);
      })
      .catch(cb);
  }

  /**
   * Broadcast a transaction to the bitcoin network
   */
  broadcast(rawTx, cb) {
    const payload = {
      rawTx: rawTx,
      network: this.v8network,
      chain: this.coin.toUpperCase()
    };

    var client = this._getClient();
    client
      .broadcast({ payload })
      .then(ret => {
        if (!ret.txid) {
          return cb(new Error('Error broadcasting'));
        }
        return cb(null, ret.txid);
      })
      .catch(err => {
        console.log('[v8.js.221:err:]', err); //TODO
        return cb(err);
      });
  }

  // This is for internal usage, addresses should be returned on internal representation
  getTransaction(txid, cb) {
    var self = this;
    console.log('[v8.js.207] GET TX', txid); //TODO
    var client = this._getClient();
    client
      .getTx({ txid: txid })
      .then(tx => {
        if (!tx || _.isEmpty(tx)) {
          return cb();
        }
        return cb(null, tx);
      })
      .catch(err => {
        // The TX was not found
        if (err.statusCode == '404') {
          return cb();
        } else {
          return cb(err);
        }
      });
  }

  getAddressUtxos(address, height, cb) {
    var self = this;
    console.log(' GET ADDR UTXO', address, height); //TODO
    var client = this._getClient();

    client
      .getAddressTxos({ address: address, unspent: true })
      .then(utxos => {
        return cb(null, self._transformUtxos(utxos, height));
      })
      .catch(cb);
  }

  getTransactions(wallet, startBlock, cb) {
    console.time('V8 getTxs');
    if (startBlock) {
      log.debug(`getTxs: startBlock ${startBlock}`);
    } else {
      log.debug(`getTxs: from 0`);
    }
    var self = this;

    var client = this._getAuthClient(wallet);
    var acum = '',
      broken;

    let opts = {
      includeMempool: true,
      pubKey: wallet.beAuthPublicKey2,
      payload: {},
      startBlock: undefined
    };

    if (_.isNumber(startBlock)) opts.startBlock = startBlock;

    var txStream = client.listTransactions(opts);
    txStream.on('data', raw => {
      acum = acum + raw.toString();
    });

    txStream.on('end', () => {
      if (broken) {
        return;
      }

      let txs = [],
        unconf = [],
        err;
      _.each(acum.split(/\r?\n/), rawTx => {
        if (!rawTx) return;

        let tx;
        try {
          tx = JSON.parse(rawTx);
        } catch (e) {
          log.error('v8 error at JSON.parse:' + e + ' Parsing:' + rawTx + ':');
          return cb(e);
        }
        // v8 field name differences
        if (tx.value) tx.amount = tx.satoshis / 1e8;

        if (tx.height >= 0) txs.push(tx);
        else unconf.push(tx);
      });
      console.timeEnd('V8 getTxs');
      // blockTime on unconf is 'seenTime';
      return cb(
        null,
        _.flatten(_.orderBy(unconf, 'blockTime', 'desc').concat(txs.reverse()))
      );
    });

    txStream.on('error', e => {
      log.error('v8 error:' + e);
      broken = true;
      return cb(e);
    });
  }

  getAddressActivity(address, cb) {
    var self = this;

    var url = this.baseUrl + '/address/' + address + '/txs?limit=1';
    console.log('[v8.js.328:url:] CHECKING ADDRESS ACTIVITY', url); //TODO
    this.request
      .get(url, {})
      .then(ret => {
        return cb(null, ret !== '[]');
      })
      .catch(err => {
        return cb(err);
      });
  }

  estimateFee(nbBlocks, cb) {
    var self = this;
    nbBlocks = nbBlocks || [1, 2, 6, 24];
    var result = {};

    async.each(
      nbBlocks,
      function(x, icb) {
        var url = self.baseUrl + '/fee/' + x;
        self.request
          .get(url, {})
          .then(ret => {
            try {
              ret = JSON.parse(ret);

              // only process right responses.
              if (!_.isUndefined(ret.blocks) && ret.blocks != x) {
                log.info(`Ignoring response for ${x}:` + JSON.stringify(ret));
                return icb();
              }

              result[x] = ret.feerate;
            } catch (e) {
              log.warn('fee error:', e);
            }

            return icb();
          })
          .catch(err => {
            return icb(err);
          });
      },
      function(err) {
        if (err) {
          return cb(err);
        }
        // TODO: normalize result
        return cb(null, result);
      }
    );
  }

  getBlockchainHeight(cb) {
    var url = this.baseUrl + '/block/tip';

    this.request
      .get(url, {})
      .then(ret => {
        try {
          ret = JSON.parse(ret);
          return cb(null, ret.height, ret.hash);
        } catch (err) {
          return cb(new Error('Could not get height from block explorer'));
        }
      })
      .catch(cb);
  }

  getTxidsInBlock(blockHash, cb) {
    var url = this.baseUrl + '/tx/?blockHash=' + blockHash;
    this.request
      .get(url, {})
      .then(ret => {
        try {
          ret = JSON.parse(ret);
          var res = _.map(ret, 'txid');
          return cb(null, res);
        } catch (err) {
          return cb(new Error('Could not get height from block explorer'));
        }
      })
      .catch(cb);
  }

  initSocket(callbacks) {
    var self = this;
    log.info('V8 connecting socket at:' + this.host);
    // sockets always use the first server on the pull
    var socket = io.connect(
      this.host,
      { transports: ['websocket'] }
    );

    socket.on('connect', function() {
      log.info('Connected to ' + self.getConnectionInfo());
      socket.emit(
        'room',
        '/' + self.coin.toUpperCase() + '/' + self.v8network + '/inv'
      );
    });

    socket.on('connect_error', function() {
      log.error('Error connecting to ' + self.getConnectionInfo());
    });
    socket.on('tx', _.bind(callbacks.onTx));
    socket.on('block', function(data) {
      return callbacks.onBlock(data.hash);
    });
    socket.on('coin', data => {
      // script output, or similar.
      if (!data.address) return;
      var out;
      try {
        let addr =
          self.coin == 'bch'
            ? BCHAddressTranslator.translate(data.address, 'copay', 'cashaddr')
            : data.address;
        out = {
          address: data.address,
          amount: data.value / 1e8
        };
      } catch (e) {
        // non parsable address
        return;
      }
      return callbacks.onIncomingPayments({ outs: [out], txid: data.mintTxid });
    });

    return socket;
  }
}

var _parseErr = function(err, res) {
  if (err) {
    log.warn('V8 error: ', err);
    return 'V8 Error';
  }
  log.warn('V8 ' + res.request.href + ' Returned Status: ' + res.statusCode);
  return 'Error querying the blockchain';
};
