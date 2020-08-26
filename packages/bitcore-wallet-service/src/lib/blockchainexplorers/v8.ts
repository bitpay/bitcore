import * as async from 'async';
import _ from 'lodash';
import * as request from 'request-promise-native';
import io = require('socket.io-client');
import { ChainService } from '../chain/index';
import logger from '../logger';
import { Client } from './v8/client';

const $ = require('preconditions').singleton();
const Common = require('../common');
const Bitcore = require('bitcore-lib');
const Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash'),
  eth: Bitcore,
  xrp: Bitcore
};
const config = require('../../config');
const Constants = Common.Constants,
  Defaults = Common.Defaults,
  Utils = Common.Utils;

function v8network(bwsNetwork) {
  if (bwsNetwork == 'livenet') return 'mainnet';
  if (bwsNetwork == 'testnet' && config.blockchainExplorerOpts.btc.testnet.regtestEnabled) {
    return 'regtest';
  }
  return bwsNetwork;
}

export class V8 {
  chain: string;
  coin: string;
  network: string;
  v8network: string;
  // v8 is always cashaddr
  addressFormat: string;
  apiPrefix: string;
  host: string;
  userAgent: string;
  baseUrl: string;
  request: request;
  Client: typeof Client;

  constructor(opts) {
    $.checkArgument(opts);
    $.checkArgument(Utils.checkValueInCollection(opts.network, Constants.NETWORKS));
    $.checkArgument(Utils.checkValueInCollection(opts.coin, Constants.COINS));
    $.checkArgument(opts.url);

    this.apiPrefix = _.isUndefined(opts.apiPrefix) ? '/api' : opts.apiPrefix;
    this.chain = ChainService.getChain(opts.coin || Defaults.COIN);
    this.coin = this.chain.toLowerCase();

    this.network = opts.network || 'livenet';
    this.v8network = v8network(this.network);

    // v8 is always cashaddr
    this.addressFormat = this.coin == 'bch' ? 'cashaddr' : null;
    this.apiPrefix += `/${this.chain}/${this.v8network}`;

    this.host = opts.url;
    this.userAgent = opts.userAgent || 'bws';

    this.baseUrl = this.host + this.apiPrefix;

    // for testing
    //
    this.request = opts.request || request;
    this.Client = opts.client || Client || require('./v8/client');
  }

  _getClient() {
    return new this.Client({
      baseUrl: this.baseUrl
    });
  }

  _getAuthClient(wallet) {
    $.checkState(wallet.beAuthPrivateKey2);
    return new this.Client({
      baseUrl: this.baseUrl,
      authKey: Bitcore_[this.coin].PrivateKey(wallet.beAuthPrivateKey2)
    });
  }

  addAddresses(wallet, addresses, cb) {
    const client = this._getAuthClient(wallet);

    const payload = _.map(addresses, a => {
      return {
        address: a
      };
    });

    const k = 'addAddresses' + addresses.length;
    console.time(k);
    client
      .importAddresses({
        payload,
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

    const client = this._getAuthClient(wallet);
    const payload = {
      name: wallet.id,
      pubKey: wallet.beAuthPublicKey2
    };
    client
      .register({
        authKey: wallet.beAuthPrivateKey2,
        payload
      })
      .then(ret => {
        return cb(null, ret);
      })
      .catch(cb);
  }

  async getBalance(wallet, cb) {
    const client = this._getAuthClient(wallet);
    const { tokenAddress, multisigContractAddress } = wallet;
    client
      .getBalance({ pubKey: wallet.beAuthPublicKey2, payload: {}, tokenAddress, multisigContractAddress })
      .then(ret => {
        return cb(null, ret);
      })
      .catch(cb);
  }

  getConnectionInfo() {
    return 'V8 (' + this.coin + '/' + this.v8network + ') @ ' + this.host;
  }

  _transformUtxos(unspent, bcheight) {
    $.checkState(bcheight > 0, 'No BC height passed to _transformUtxos');
    const ret = _.map(
      _.reject(unspent, x => {
        return x.spentHeight && x.spentHeight <= -3;
      }),
      x => {
        const u = {
          address: x.address,
          satoshis: x.value,
          amount: x.value / 1e8,
          scriptPubKey: x.script,
          txid: x.mintTxid,
          vout: x.mintIndex,
          locked: false,
          confirmations: x.mintHeight > 0 && bcheight >= x.mintHeight ? bcheight - x.mintHeight + 1 : 0
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
    const client = this._getAuthClient(wallet);
    console.time('V8getUtxos');
    client
      .getCoins({ pubKey: wallet.beAuthPublicKey2, payload: {} })
      .then(unspent => {
        console.timeEnd('V8getUtxos');
        return cb(null, this._transformUtxos(unspent, height));
      })
      .catch(cb);
  }

  getCoinsForTx(txId, cb) {
    $.checkArgument(cb);
    const client = this._getClient();
    console.time('V8getCoinsForTx');
    client
      .getCoinsForTx({ txId, payload: {} })
      .then(coins => {
        console.timeEnd('V8getCoinsForTx');
        return cb(null, coins);
      })
      .catch(cb);
  }

  /**
   * Check wallet addresses
   */
  getCheckData(wallet, cb) {
    const client = this._getAuthClient(wallet);
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
  broadcast(rawTx, cb, count: number = 0) {
    const payload = {
      rawTx,
      network: this.v8network,
      chain: this.chain
    };

    const client = this._getClient();
    client
      .broadcast({ payload })
      .then(ret => {
        if (!ret.txid) {
          return cb(new Error('Error broadcasting'));
        }
        return cb(null, ret.txid);
      })
      .catch(err => {
        if (count > 3) {
          logger.error('FINAL Broadcast error:', err);
          return cb(err);
        } else {
          count++;
          // retry
          setTimeout(() => {
            logger.info('Retrying broadcast after', count * Defaults.BROADCAST_RETRY_TIME);
            return this.broadcast(rawTx, cb, count);
          }, count * Defaults.BROADCAST_RETRY_TIME);
        }
      });
  }

  // This is for internal usage, addresses should be returned on internal representation
  getTransaction(txid, cb) {
    console.log('[v8.js.207] GET TX', txid); // TODO
    const client = this._getClient();
    client
      .getTx({ txid })
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
    console.log(' GET ADDR UTXO', address, height); // TODO
    const client = this._getClient();

    client
      .getAddressTxos({ address, unspent: true })
      .then(utxos => {
        return cb(null, this._transformUtxos(utxos, height));
      })
      .catch(cb);
  }

  getTransactions(wallet, startBlock, cb) {
    console.time('V8 getTxs');
    if (startBlock) {
      logger.debug(`getTxs: startBlock ${startBlock}`);
    } else {
      logger.debug('getTxs: from 0');
    }

    const client = this._getAuthClient(wallet);
    let acum = '',
      broken;

    const opts = {
      includeMempool: true,
      pubKey: wallet.beAuthPublicKey2,
      payload: {},
      startBlock: undefined,
      tokenAddress: wallet.tokenAddress,
      multisigContractAddress: wallet.multisigContractAddress
    };

    if (_.isNumber(startBlock)) opts.startBlock = startBlock;

    const txStream = client.listTransactions(opts);
    txStream.on('data', raw => {
      acum = acum + raw.toString();
    });

    txStream.on('end', () => {
      if (broken) {
        return;
      }

      const txs = [],
        unconf = [];
      _.each(acum.split(/\r?\n/), rawTx => {
        if (!rawTx) return;

        let tx;
        try {
          tx = JSON.parse(rawTx);
        } catch (e) {
          logger.error('v8 error at JSON.parse:' + e + ' Parsing:' + rawTx + ':');
          return cb(e);
        }
        // v8 field name differences
        if (tx.value) tx.amount = tx.satoshis / 1e8;

        if (tx.height >= 0) txs.push(tx);
        else unconf.push(tx);
      });
      console.timeEnd('V8 getTxs');
      // blockTime on unconf is 'seenTime';
      return cb(null, _.flatten(_.orderBy(unconf, 'blockTime', 'desc').concat(txs.reverse())));
    });

    txStream.on('error', e => {
      logger.error('v8 error:' + e);
      broken = true;
      return cb(e);
    });
  }

  getAddressActivity(address, cb) {
    const url = this.baseUrl + '/address/' + address + '/txs?limit=1';
    console.log('[v8.js.328:url:] CHECKING ADDRESS ACTIVITY', url); // TODO
    this.request
      .get(url, {})
      .then(ret => {
        return cb(null, ret !== '[]');
      })
      .catch(err => {
        return cb(err);
      });
  }

  getTransactionCount(address, cb) {
    const url = this.baseUrl + '/address/' + address + '/txs/count';
    console.log('[v8.js.364:url:] CHECKING ADDRESS NONCE', url);
    this.request
      .get(url, {})
      .then(ret => {
        ret = JSON.parse(ret);
        return cb(null, ret.nonce);
      })
      .catch(err => {
        return cb(err);
      });
  }

  estimateGas(opts, cb) {
    const url = this.baseUrl + '/gas';
    console.log('[v8.js.378:url:] CHECKING GAS LIMIT', url);
    this.request
      .post(url, { body: opts, json: true })
      .then(gasLimit => {
        gasLimit = JSON.parse(gasLimit);
        return cb(null, gasLimit);
      })
      .catch(err => {
        return cb(err);
      });
  }

  getMultisigContractInstantiationInfo(opts, cb) {
    const url = `${this.baseUrl}/ethmultisig/${opts.sender}/instantiation/${opts.txId}`;
    console.log('[v8.js.378:url:] CHECKING CONTRACT INSTANTIATION INFO', url);
    this.request
      .get(url, {})
      .then(contractInstantiationInfo => {
        contractInstantiationInfo = JSON.parse(contractInstantiationInfo);
        return cb(null, contractInstantiationInfo);
      })
      .catch(err => {
        return cb(err);
      });
  }

  getMultisigContractInfo(opts, cb) {
    const url = this.baseUrl + '/ethmultisig/info/' + opts.multisigContractAddress;
    console.log('[v8.js.378:url:] CHECKING CONTRACT INFO', url);
    this.request
      .get(url, {})
      .then(contractInfo => {
        contractInfo = JSON.parse(contractInfo);
        return cb(null, contractInfo);
      })
      .catch(err => {
        return cb(err);
      });
  }

  getMultisigTxpsInfo(opts, cb) {
    const url = this.baseUrl + '/ethmultisig/txps/' + opts.multisigContractAddress;
    console.log('[v8.js.378:url:] CHECKING CONTRACT TXPS INFO', url);
    this.request
      .get(url, {})
      .then(multisigTxpsInfo => {
        multisigTxpsInfo = JSON.parse(multisigTxpsInfo);
        return cb(null, multisigTxpsInfo);
      })
      .catch(err => {
        return cb(err);
      });
  }

  estimateFee(nbBlocks, cb) {
    nbBlocks = nbBlocks || [1, 2, 6, 24];
    const result = {};

    async.each(
      nbBlocks,
      (x: string, icb) => {
        const url = this.baseUrl + '/fee/' + x;
        this.request
          .get(url, {})
          .then(ret => {
            try {
              ret = JSON.parse(ret);

              // only process right responses.
              if (!_.isUndefined(ret.blocks) && ret.blocks != x) {
                logger.info(`Ignoring response for ${x}:` + JSON.stringify(ret));
                return icb();
              }

              result[x] = ret.feerate;
            } catch (e) {
              logger.warn('fee error:', e);
            }

            return icb();
          })
          .catch(err => {
            return icb(err);
          });
      },
      err => {
        if (err) {
          return cb(err);
        }
        // TODO: normalize result
        return cb(null, result);
      }
    );
  }

  getBlockchainHeight(cb) {
    const url = this.baseUrl + '/block/tip';

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
    const url = this.baseUrl + '/tx/?blockHash=' + blockHash;
    this.request
      .get(url, {})
      .then(ret => {
        try {
          ret = JSON.parse(ret);
          const res = _.map(ret, 'txid');
          return cb(null, res);
        } catch (err) {
          return cb(new Error('Could not get height from block explorer'));
        }
      })
      .catch(cb);
  }

  initSocket(callbacks) {
    logger.info('V8 connecting socket at:' + this.host);
    // sockets always use the first server on the pull
    const walletsSocket = io.connect(this.host, { transports: ['websocket'] });

    const blockSocket = io.connect(this.host, { transports: ['websocket'] });

    const getAuthPayload = host => {
      const authKey = config.blockchainExplorerOpts.socketApiKey;

      if (!authKey) throw new Error('provide authKey');

      const authKeyObj = new Bitcore.PrivateKey(authKey);
      const pubKey = authKeyObj.toPublicKey().toString();
      const authClient = new Client({ baseUrl: host, authKey: authKeyObj });
      const payload = { method: 'socket', url: host };
      const authPayload = { pubKey, message: authClient.getMessage(payload), signature: authClient.sign(payload) };
      return authPayload;
    };

    blockSocket.on('connect', () => {
      logger.info(`Connected to block ${this.getConnectionInfo()}`);
      blockSocket.emit('room', `/${this.chain}/${this.v8network}/inv`);
    });

    blockSocket.on('connect_error', () => {
      logger.error(`Error connecting to ${this.getConnectionInfo()}`);
    });

    blockSocket.on('block', data => {
      return callbacks.onBlock(data.hash);
    });

    walletsSocket.on('connect', () => {
      logger.info(`Connected to wallets ${this.getConnectionInfo()}`);
      walletsSocket.emit('room', `/${this.chain}/${this.v8network}/wallets`, getAuthPayload(this.host));
    });

    walletsSocket.on('connect_error', () => {
      logger.error(`Error connecting to ${this.getConnectionInfo()}  ${this.chain}/${this.v8network}`);
    });

    walletsSocket.on('failure', err => {
      logger.error(`Error joining room ${err.message} ${this.chain}/${this.v8network}`);
    });

    walletsSocket.on('coin', data => {
      if (!data || !data.coin) return;

      const notification = ChainService.onCoin(this.coin, data.coin);
      if (!notification) return;

      return callbacks.onIncomingPayments(notification);
    });

    walletsSocket.on('tx', data => {
      if (!data || !data.tx) return;

      const notification = ChainService.onTx(this.coin, data.tx);
      if (!notification) return;

      return callbacks.onIncomingPayments(notification);
    });
  }
}

const _parseErr = (err, res) => {
  if (err) {
    logger.warn('V8 error: ', err);
    return 'V8 Error';
  }
  logger.warn('V8 ' + res.request.href + ' Returned Status: ' + res.statusCode);
  return 'Error querying the blockchain';
};
