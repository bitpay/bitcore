import * as async from 'async';
import * as crypto from 'crypto';
import _ from 'lodash';
import * as request from 'request-promise-native';
import io = require('socket.io-client');
import config from '../../config';
import { ChainService } from '../chain/index';
import { Common } from '../common';
import logger from '../logger';
import { Client } from './v8/client';

const $ = require('preconditions').singleton();
const Bitcore = require('bitcore-lib');
const Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash'),
  eth: Bitcore,
  matic: Bitcore,
  xrp: Bitcore,
  doge: require('bitcore-lib-doge'),
  ltc: require('bitcore-lib-ltc')
};

const Constants = Common.Constants,
  Defaults = Common.Defaults,
  Utils = Common.Utils;

function v8network(bwsNetwork, chain = 'btc') {
  if (bwsNetwork == 'livenet') return 'mainnet';
  if (bwsNetwork == 'testnet' && config.blockchainExplorerOpts?.[chain.toLowerCase()]?.testnet?.regtestEnabled) {
    return 'regtest';
  }
  return bwsNetwork;
}

export class V8 {
  chain: string;
  network: string;
  v8network: string;
  // v8 is always cashaddr
  addressFormat: string;
  apiPrefix: string;
  chainNetwork: string;
  host: string;
  userAgent: string;
  baseUrl: string;
  request: request;
  Client: typeof Client;

  constructor(opts) {
    $.checkArgument(opts);
    $.checkArgument(Utils.checkValueInCollection(opts.network, Constants.NETWORKS));
    $.checkArgument(Utils.checkValueInCollection(opts.chain, Constants.CHAINS));
    $.checkArgument(opts.url);

    this.apiPrefix = opts.apiPrefix == null ? '/api' : opts.apiPrefix;
    this.chain = opts.chain;

    this.network = opts.network || 'livenet';
    this.v8network = v8network(this.network, this.chain);

    // v8 is always cashaddr
    this.addressFormat = this.chain == 'bch' ? 'cashaddr' : null;
    this.chainNetwork = `/${this.chain.toUpperCase()}/${this.v8network}`;
    this.apiPrefix += this.chainNetwork;

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
    $.checkState(wallet.beAuthPrivateKey2, 'Failed state: wallet.beAuthPrivateKey2 at <_getAuthClient()>');
    return new this.Client({
      baseUrl: this.baseUrl,
      authKey: Bitcore_[this.chain].PrivateKey(wallet.beAuthPrivateKey2)
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
    const perfKey = getPerformanceKey(k);
    console.time(perfKey);
    client
      .importAddresses({
        payload,
        pubKey: wallet.beAuthPublicKey2
      })
      .then(ret => {
        console.timeEnd(perfKey);
        return cb(null, ret);
      })
      .catch(err => {
        return cb(err);
      });
  }

  register(wallet, cb) {
    if (wallet.chain != this.chain || wallet.network != this.network) {
      return cb(new Error('Network chain or network mismatch'));
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
    return 'V8 (' + this.chain + '/' + this.v8network + ') @ ' + this.host;
  }

  _transformUtxos(utxos, bcheight) {
    $.checkState(bcheight > 0, 'Failed state: No BC height passed to _transformUtxos()');
    const ret = _.map(
      _.reject(utxos, x => {
        return x.spentHeight && x.spentHeight <= -3; // -3 is conflicted status
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
          confirmations: x.mintHeight > 0 && bcheight >= x.mintHeight ? bcheight - x.mintHeight + 1 : 0,
          spent: x.spentHeight != -2 // -2 is unspent status
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
  getUtxos(wallet, height, cb, params: { includeSpent?: boolean } = {}) {
    $.checkArgument(cb);
    const client = this._getAuthClient(wallet);
    const perfKey = getPerformanceKey('V8getUtxos');
    console.time(perfKey);
    client
      .getCoins({
        pubKey: wallet.beAuthPublicKey2,
        payload: {},
        ...params
      })
      .then(utxos => {
        console.timeEnd(perfKey);
        return cb(null, this._transformUtxos(utxos, height));
      })
      .catch(cb);
  }

  getCoinsForTx(txId, cb) {
    $.checkArgument(cb);
    const client = this._getClient();
    const perfKey = getPerformanceKey('V8getCoinsForTx');
    console.time(perfKey);
    client
      .getCoinsForTx({ txId, payload: {} })
      .then(coins => {
        console.timeEnd(perfKey);
        return cb(null, coins);
      })
      .catch(cb);
  }

  /**
   * Check wallet addresses
   */
  getCheckData(wallet, cb) {
    const client = this._getAuthClient(wallet);
    const perfKey = getPerformanceKey('WalletCheck');
    console.time(perfKey);
    client
      .getCheckData({ pubKey: wallet.beAuthPublicKey2, payload: {} })
      .then(checkInfo => {
        console.timeEnd(perfKey);
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
      chain: this.chain.toUpperCase()
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
          logger.error('[v8.js] FINAL Broadcast error: %o', err);
          return cb(err);
        } else {
          count++;
          // retry
          setTimeout(() => {
            logger.info('[v8.js] Retrying broadcast after %o', count * Defaults.BROADCAST_RETRY_TIME);
            return this.broadcast(rawTx, cb, count);
          }, count * Defaults.BROADCAST_RETRY_TIME);
        }
      });
  }

  // This is for internal usage, addresses should be returned on internal representation
  getTransaction(txid, cb) {
    logger.debug('[v8.js] GET TX %o', txid);
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
    logger.debug('[v8.js] GET ADDR UTXO, %o, %o', address, height); // TODO
    const client = this._getClient();

    client
      .getAddressTxos({ address, unspent: true })
      .then(utxos => {
        return cb(null, this._transformUtxos(utxos, height));
      })
      .catch(cb);
  }

  getTransactions(wallet, startBlock, cb) {
    const perfKey = getPerformanceKey('V8getTxs');
    console.time(perfKey);
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
          logger.error('[v8.js] Error at JSON.parse:' + e + ' Parsing:' + rawTx + ':');
          return cb(e);
        }
        // v8 field name differences
        if (tx.value) tx.amount = tx.satoshis / 1e8;

        if (tx.height >= 0) txs.push(tx);
        else if (tx.height >= -2) unconf.push(tx);
      });
      console.timeEnd(perfKey);
      // blockTime on unconf is 'seenTime';
      return cb(null, _.flatten(_.orderBy(unconf, 'blockTime', 'desc').concat(txs.reverse())));
    });

    txStream.on('error', e => {
      logger.error('[v8.js] Error: %o', e);
      broken = true;
      return cb(e);
    });
  }

  getAddressActivity(address, cb) {
    const url = this.baseUrl + '/address/' + address + '/txs?limit=1';
    logger.debug('[v8.js] CHECKING ADDRESS ACTIVITY %o', url);
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
    logger.debug('[v8.js] CHECKING ADDRESS NONCE %o', url);
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
    logger.debug('[v8.js] CHECKING GAS LIMIT %o', url);
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
    logger.debug('[v8.js] CHECKING CONTRACT INSTANTIATION INFO %o', url);
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
    logger.debug('[v8.js] CHECKING CONTRACT INFO %o', url);
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

  getTokenContractInfo(opts, cb) {
    const url = this.baseUrl + '/token/' + opts.tokenAddress;
    logger.debug('[v8.js] CHECKING CONTRACT INFO %o', url);
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

  getTokenAllowance(opts, cb) {
    const url =
      this.baseUrl + '/token/' + opts.tokenAddress + '/allowance/' + opts.ownerAddress + '/for/' + opts.spenderAddress;
    logger.debug('[v8.js] CHECKING TOKEN ALLOWANCE %o', url);
    this.request
      .get(url, {})
      .then(allowance => {
        allowance = JSON.parse(allowance);
        return cb(null, allowance);
      })
      .catch(err => {
        return cb(err);
      });
  }

  getMultisigTxpsInfo(opts, cb) {
    const url = this.baseUrl + '/ethmultisig/txps/' + opts.multisigContractAddress;
    logger.debug('[v8.js] CHECKING CONTRACT TXPS INFO %o', url);
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
                logger.info(`[v8.js] Ignoring response for ${x}: %o`, ret?.body || ret);
                return icb();
              }

              result[x] = ret.feerate;
            } catch (e) {
              logger.warn('[v8.js] Fee error: %o', e);
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
      blockSocket.emit('room', `${this.chainNetwork}/inv`);
    });

    blockSocket.on('connect_error', () => {
      logger.error(`Error connecting to ${this.getConnectionInfo()}`);
    });

    blockSocket.on('block', data => {
      return callbacks.onBlock(data.hash);
    });

    walletsSocket.on('connect', () => {
      logger.info(`Connected to wallets ${this.getConnectionInfo()}`);
      walletsSocket.emit('room', `${this.chainNetwork}/wallets`, getAuthPayload(this.host));
    });

    walletsSocket.on('connect_error', () => {
      logger.error(`Error connecting to ${this.getConnectionInfo()} ${this.chainNetwork}`);
    });

    walletsSocket.on('failure', err => {
      logger.error(`Error joining room ${err.message} ${this.chainNetwork}`);
    });

    walletsSocket.on('coin', data => {
      if (!data || !data.coin) return;

      const notification = ChainService.onCoin(this.chain, data.coin);
      if (!notification) return;

      return callbacks.onIncomingPayments(notification);
    });

    walletsSocket.on('tx', data => {
      if (!data || !data.tx) return;

      const notification = ChainService.onTx(this.chain, data.tx);
      if (!notification) return;

      return callbacks.onIncomingPayments(notification);
    });
  }
}

const _parseErr = (err, res) => {
  if (err) {
    logger.warn('[v8.js] V8 raw error: %o', err);
    return 'V8 Error';
  }
  logger.warn('[v8.js] ' + res.request.href + ' Returned Status: ' + res.statusCode);
  return 'Error querying the blockchain';
};

const getPerformanceKey = (name: string) => {
  return name + '-' + crypto.randomBytes(5).toString('hex');
};