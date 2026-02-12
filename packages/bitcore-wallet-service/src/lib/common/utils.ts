import {
  BitcoreLib,
  BitcoreLibCash,
  BitcoreLibDoge,
  BitcoreLibLtc,
  Constants as CWConstants
} from '@bitpay-labs/crypto-wallet-core';
import _ from 'lodash';
import { singleton } from 'preconditions';
import secp256k1 from 'secp256k1';
import Config from '../../config';
import { logger } from '../logger';
import { Constants } from './constants';
import { Defaults } from './defaults';

const $ = singleton();
const Bitcore_ = {
  btc: BitcoreLib,
  bch: BitcoreLibCash,
  doge: BitcoreLibDoge,
  ltc: BitcoreLibLtc
};

export const Utils = {

  /**
   * @deprecated
   * Moved from ChainService to prevent circular dependency
   */
  getChain(coin: string): string {
    try {
      if (coin === undefined) { // This happens frequently for very old btc wallets/addresses
        return Defaults.CHAIN;
      }
      // TODO add a warning that we are not including chain
      let normalizedChain = coin.toLowerCase();
      if (
        Constants.BITPAY_SUPPORTED_ETH_ERC20[normalizedChain.toUpperCase()] ||
        !Constants.CHAINS[normalizedChain.toUpperCase()]
      ) {
        // default to eth if it's an ETH ERC20 or if we don't know the chain
        normalizedChain = 'eth';
      }
      return normalizedChain;
    } catch (err) {
      logger.error(`Error getting chain for coin ${coin}: %o`, err.stack || err.message || err);
      return Defaults.CHAIN; // coin should always exist but most unit test don't have it -> return btc as default
    }
  },

  isObject(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj);
  },

  /**
   * Checks if val is numeric within the confines of Number
   * e.g. '1', 1, '1.1', -1, '-1', 0, '0' are all valid numbers. Null is not. BigInts are not.
   * @param val
   * @returns {boolean}
   */
  isNumber(val) {
    return val != null && !isNaN(val);
  },

  /**
   * Same as isNumber(), but also allows BigInts
   * @param val 
   * @returns {boolean}
   */
  isNumberish(val) {
    return Utils.isNumber(val) || typeof val === 'bigint';
  },

  getMissingFields(obj: object, args?: string | Array<string>): Array<string> {
    args = args || [];
    if (!Array.isArray(args)) args = [args];
    if (!Utils.isObject(obj)) return args;
    const missing = args.filter(arg => !Object.hasOwn(obj, arg));
    return missing;
  },

  /**
   *
   * @desc rounds a JAvascript number
   * @param number
   * @return {number}
   */
  strip(number) {
    return parseFloat(number.toPrecision(12));
  },

  /* TODO: It would be nice to be compatible with bitcoind signmessage. How
   * the hash is calculated there? */
  hashMessage(text, noReverse) {
    $.checkArgument(text);
    const buf = Buffer.from(text);
    let ret = BitcoreLib.crypto.Hash.sha256sha256(buf);
    if (!noReverse) {
      ret = new BitcoreLib.encoding.BufferReader(ret).readReverse();
    }
    return ret;
  },

  verifyMessage(message, signature, publicKey) {
    $.checkArgument(message);

    const flattenedMessage = Array.isArray(message) ? message.join(',') : message;
    const hash = Utils.hashMessage(flattenedMessage, true);

    const sig = Utils._tryImportSignature(signature);
    if (!sig) {
      return false;
    }

    const publicKeyBuffer = Utils._tryImportPublicKey(publicKey);
    if (!publicKeyBuffer) {
      return false;
    }

    return Utils._tryVerifyMessage(hash, sig, publicKeyBuffer);
  },

  _tryImportPublicKey(publicKey) {
    let publicKeyBuffer = publicKey;
    try {
      if (!Buffer.isBuffer(publicKey)) {
        publicKeyBuffer = Buffer.from(publicKey, 'hex');
      }
      return publicKeyBuffer;
    } catch (e) {
      logger.error('_tryImportPublicKey encountered an error: %o', e);
      return false;
    }
  },

  _tryImportSignature(signature) {
    try {
      let signatureBuffer = signature;
      if (!Buffer.isBuffer(signature)) {
        signatureBuffer = Buffer.from(signature, 'hex');
      }
      // uses the native module (c++) for performance vs bitcore lib (javascript)
      return secp256k1.signatureImport(signatureBuffer);
    } catch (e) {
      logger.error('_tryImportSignature encountered an error: %o', e);
      return false;
    }
  },

  _tryVerifyMessage(hash, sig, publicKeyBuffer) {
    try {
      // uses the native module (c++) for performance vs bitcore lib (javascript)
      return secp256k1.ecdsaVerify(sig, hash, publicKeyBuffer);
    } catch (e) {
      logger.error('_tryVerifyMessage encountered an error: %o', e);
      return false;
    }
  },

  formatAmount(satoshis, unit, opts) {
    const UNITS = Object.entries(CWConstants.UNITS).reduce((units, [currency, currencyConfig]) => {
      units[currency] = {
        toSatoshis: currencyConfig.toSatoshis,
        maxDecimals: currencyConfig.short.maxDecimals,
        minDecimals: currencyConfig.short.minDecimals
      };
      return units;
    }, {} as { [currency: string]: { toSatoshis: number; maxDecimals: number; minDecimals: number } });

    $.shouldBeNumber(satoshis);

    function addSeparators(nStr, thousands, decimal, minDecimals) {
      nStr = nStr.replace('.', decimal);
      const x = nStr.split(decimal);
      let x0 = x[0];
      let x1 = x[1];

      x1 = _.dropRightWhile(x1, (n, i) => {
        return n == '0' && i >= minDecimals;
      }).join('');
      const x2 = x.length > 1 ? decimal + x1 : '';

      x0 = x0.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return x0 + x2;
    }

    opts = opts || {};

    if (!UNITS[unit] && !opts.decimals && !opts.toSatoshis) {
      return Number(satoshis).toLocaleString();
    }

    const u = Object.assign({}, UNITS[unit], opts);
    const decimals = opts.decimals ? opts.decimals : u;
    const toSatoshis = opts.toSatoshis ? opts.toSatoshis : u.toSatoshis;

    const amount = (satoshis / toSatoshis).toFixed(decimals.maxDecimals);
    return addSeparators(amount, opts.thousandsSeparator || ',', opts.decimalSeparator || '.', decimals.minDecimals);
  },

  formatAmountInBtc(amount) {
    return (
      Utils.formatAmount(amount, 'btc', {
        minDecimals: 8,
        maxDecimals: 8
      }) + 'btc'
    );
  },

  formatUtxos(utxos) {
    if (!utxos?.length) return 'none';
    return utxos.map(i => {
      const amount = Utils.formatAmountInBtc(i.satoshis);
      const confirmations = i.confirmations ? i.confirmations + 'c' : 'u';
      return amount + '/' + confirmations;
    }).join(', ');
  },

  formatRatio(ratio) {
    return (ratio * 100).toFixed(4) + '%';
  },

  formatSize(size) {
    return (size / 1000).toFixed(4) + 'kB';
  },

  parseVersion(version) {
    const v: {
      agent?: string;
      major?: number;
      minor?: number;
      patch?: number;
    } = {};

    if (!version) return null;

    let x = version.split('-');
    if (x.length != 2) {
      v.agent = version;
      return v;
    }
    v.agent = ['bwc', 'bws'].includes(x[0]) ? 'bwc' : x[0];
    x = x[1].split('.');
    v.major = x[0] ? parseInt(x[0]) : null;
    v.minor = x[1] ? parseInt(x[1]) : null;
    v.patch = x[2] ? parseInt(x[2]) : null;

    return v;
  },

  parseAppVersion(agent) {
    const v: {
      app?: string;
      major?: number;
      minor?: number;
      patch?: number;
    } = {};
    if (!agent) return null;
    agent = agent.toLowerCase();

    let w;
    w = agent.indexOf('copay');
    if (w >= 0) {
      v.app = 'copay';
    } else {
      w = agent.indexOf('bitpay');
      if (w >= 0) {
        v.app = 'bitpay';
      } else {
        v.app = 'other';
        return v;
      }
    }

    const version = agent.substr(w + v.app.length);
    const x = version.split('.');
    v.major = x[0] ? parseInt(x[0].replace(/\D/g, '')) : null;
    v.minor = x[1] ? parseInt(x[1]) : null;
    v.patch = x[2] ? parseInt(x[2]) : null;

    return v;
  },

  getIpFromReq(req): string {
    if (req.headers) {
      if (req.headers['x-forwarded-for']) return req.headers['x-forwarded-for'].split(',')[0];
      if (req.headers['x-real-ip']) return req.headers['x-real-ip'].split(',')[0];
    }
    if (req.ip) return req.ip;
    if (req.connection && req.connection.remoteAddress) return req.connection.remoteAddress;
    return '';
  },

  checkValueInCollection(value, collection) {
    if (typeof value !== 'string') return false;
    return Object.values(collection).includes(value);
  },

  getAddressCoin(address) {
    try {
      new Bitcore_['btc'].Address(address);
      return 'btc';
    } catch {
      try {
        new Bitcore_['bch'].Address(address);
        return 'bch';
      } catch {
        try {
          new Bitcore_['doge'].Address(address);
          return 'doge';
        } catch {
          try {
            new Bitcore_['ltc'].Address(address);
            return 'ltc';
          } catch {
            return;
          }
        }
      }
    }
  },

  translateAddress(address, coin) {
    const origCoin = Utils.getAddressCoin(address);
    const origAddress = new Bitcore_[origCoin].Address(address);
    const origObj = origAddress.toObject();

    const result = Bitcore_[coin].Address.fromObject(origObj);
    return coin == 'bch' ? result.toLegacyAddress() : result.toString();
  },

  compareNetworks(network1, network2, chain) {
    network1 = network1 ? Utils.getNetworkName(chain, network1.toLowerCase()) : null;
    network2 = network2 ? Utils.getNetworkName(chain, network2.toLowerCase()) : null;

    if (network1 == network2) return true;
    if (Config.allowRegtest && ['testnet', 'regtest'].includes(Utils.getNetworkType(network1)) && ['testnet', 'regtest'].includes(Utils.getNetworkType(network2))) return true;
    return false;
  },

  // Good for going from generic 'testnet' to specific 'testnet3', 'sepolia', etc
  getNetworkName(chain, network) {
    const aliases = Constants.NETWORK_ALIASES[chain];
    if (aliases && aliases[network]) {
      return aliases[network];
    }
    return network;
  },

  // Good for going from specific 'testnet3', 'sepolia', etc to generic 'testnet'
  getGenericName(network) {
    if (network === 'mainnet') return 'livenet';
    const isTestnet = !!Object.keys(Constants.NETWORK_ALIASES).find(key => Constants.NETWORK_ALIASES[key].testnet === network);
    if (isTestnet) return 'testnet';
    return network;
  },

  getNetworkType(network) {
    if (['mainnet', 'livenet'].includes(network)) {
      return 'mainnet';
    }
    if (network === 'regtest') {
      return 'regtest';
    }
    return 'testnet';
  },

  castToBool(input: any) {
    input = input?.toString();
    if (input?.toLowerCase() === 'true' || input == '1') {
      return true;
    }
    return false;
  },

  /**
   * Sort array by keys in ascending order
   * @param {Array<T>} arr Array to be sorted
   * @param {...(string|string[])} keys Keys to sort by in order. If a key is an array, it will be treated as a nested key.
   *  e.g.: sortAsc(arr, 'a', 'b', ['c', 'd']) will sort by a, then b, then c.d
   * @returns 
   */
  sortAsc<T = any>(arr: Array<T>, ...keys: (string | string[])[]): Array<T> {
    function transformVals(val1, val2) {
      if (val1 === undefined) {
        val1 = '\uFFFF'; // highest possible string value, otherwise 'undefined' < 'xyz'
      } else if (val1 === null || val1 === false || val1.toString() === 'NaN') {
        val1 = '0';
      } else if (val1 === true) {
        val1 = '1';
      }

      if (val2 === undefined) {
        val2 = '\uFFFF'; // highest possible string value, otherwise 'undefined' < 'xyz'
      } else if (val2 === null || val2 === false || val2.toString() === 'NaN') {
        val2 = '0';
      } else if (val2 === true) {
        val2 = '1';
      }

      return [Buffer.from(val1.toString()), Buffer.from(val2.toString())];
    };

    if (!keys.length) {
      return arr.sort((a, b) => { const [_a, _b] = transformVals(a, b); return _a.compare(_b); });
    } else if (keys.length === 1 && !Array.isArray(keys[0])) {
      return arr.sort((a, b) => { const [_a, _b] = transformVals(a[keys[0] as string], b[keys[0] as string]); return _a.compare(_b); });
    }
    return arr.sort((a, b) => {
      // compare concatenated strings for multiple key sorting
      let aVal = '';
      let bVal = '';
      for (const k of keys) {
        const [aTemp, bTemp] = transformVals(
          Array.isArray(k) ? k.reduce((val, key) => val[key], a) : a[k],
          Array.isArray(k) ? k.reduce((val, key) => val[key], b) : b[k]
        );

        aVal += aTemp.toString();
        bVal += bTemp.toString();
      }
      return Buffer.from(aVal).compare(Buffer.from(bVal));
    });
  },

  /**
   * Sort array by keys in descending order
   * @param {Array<T>} arr Array to be sorted
   * @param {...(string|string[])} keys Keys to sort by in order. If a key is an array, it will be treated as a nested key.
   *  e.g.: sortDesc(arr, 'a', 'b', ['c', 'd']) will sort by a, then b, then c.d
   */
  sortDesc<T = any>(arr: Array<T>, ...keys: (string | string[])[]): Array<T> {
    return Utils.sortAsc(arr, ...keys).reverse();
  },

  /**
   * Return a new object with only the specified keys
   * E.g.: pick({a: 1, b: 2, c: 3, d: 4}, 'a', 'c') => {a: 1, c: 3}
   * 
   * Keys can be given as an array
   * E.g.: pick({a: 1, b: 2, c: 3, d: 4}, ['a', 'c']) => {a: 1, c: 3}
   * 
   * Keys are flattened
   * E.g.: pick({a: 1, b: 2, c: 3, d: 4}, ['a', ['c']], 'd') => {a: 1, c: 3, d: 4}
   * 
   * Properties that are defined but nullish will be included on result
   * E.g.: pick({a: 1, b: 2, c: null, d: undefined}, ['a', 'c', 'd']) => {a: 1, c: null, d: undefined}
   *
   * Non-existent properties will not exist on result
   * E.g.: pick({a: 1, b: 2, c: null, d: 4}, ['a', 'e']) => {a: 1}
   * @param {Object} obj Object to pick keys from
   * @param keys Keys to pick from obj
   * @returns {Object} New object with only the specified keys
   */
  pick<T>(obj: T, ...keys): Partial<T> {
    keys = keys.flat();
    const retval: Partial<T> = {};
    if (!obj) return retval;
    for (const key of keys) {
      if (Object.hasOwn(obj as object, key)) {
        retval[key] = obj[key];
      }
    }
    return retval;
  },

  /**
   * Takes an array of array-pairs and converts them to key-value map
   * @param {Array<Array<any, any>>} input e.g. [[a, 1], [b, 2]]
   * @returns {Object} e.g. { a: 1, b: 2 }
   */
  fromPairs(input: Array<[any, any]>) {
    return input.reduce((map, [k, v]) => {
      map[k] = v;
      return map;
    }, {});
  },

  /**
   * Returns the elements of arr1 that are NOT in arr2
   * @param {Array<any>} arr1 Elements to filter
   * @param {Array<any>} [arr2] Elements to remove from arr1 if they exist. If not provided, returns a copy of arr1.
   * @returns 
   */
  difference(arr1: any, arr2: any) {
    if (!Array.isArray(arr1)) return [];
    if (!Array.isArray(arr2)) arr2 = null;
    return arr1.filter(x => !arr2?.includes(x));
  },

  /**
   * Shuffles array using a Fisher-Yates shuffle
   * @param {Array<any>} array Array to shuffle
   * @returns New array of shuffled elements
   */
  shuffle(array: Array<any>) {
    const retval = [...array];
    for (let i = retval.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [retval[i], retval[j]] = [retval[j], retval[i]];
    }
    return retval;
  },

  sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
};