import * as CWC from 'crypto-wallet-core';
import _ from 'lodash';
import 'source-map-support/register';
const $ = require('preconditions').singleton();
const bitcore = require('bitcore-lib');
const crypto = bitcore.crypto;
const secp256k1 = require('secp256k1');
const Bitcore = require('bitcore-lib');
const Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash')
};

export class Utils {
  static getMissingFields(obj, args) {
    args = [].concat(args);
    if (!_.isObject(obj)) return args;
    const missing = _.filter(args, arg => {
      return !obj.hasOwnProperty(arg);
    });
    return missing;
  }

  /**
   *
   * @desc rounds a JAvascript number
   * @param number
   * @return {number}
   */
  static strip(number) {
    return parseFloat(number.toPrecision(12));
  }

  // overrides lodash sumBy to return bigInt 0 if null results.
  static sumByB(array, it, doAbs?): BigInt {
    let ret = BigInt(_.sumBy(array, it) || 0);
    if (doAbs && ret < 0) ret = ret * BigInt(-1);
    return ret;
  }

  /* TODO: It would be nice to be compatible with bitcoind signmessage. How
   * the hash is calculated there? */
  static hashMessage(text, noReverse) {
    $.checkArgument(text);
    const buf = new Buffer(text);
    let ret = crypto.Hash.sha256sha256(buf);
    if (!noReverse) {
      ret = new bitcore.encoding.BufferReader(ret).readReverse();
    }
    return ret;
  }

  static verifyMessage(message, signature, publicKey) {
    $.checkArgument(message);

    const flattenedMessage = _.isArray(message) ? _.join(message) : message;
    const hash = Utils.hashMessage(flattenedMessage, true);
    const sig = this._tryImportSignature(signature);
    if (!sig) {
      return false;
    }

    const publicKeyBuffer = this._tryImportPublicKey(publicKey);
    if (!publicKeyBuffer) {
      return false;
    }

    return this._tryVerifyMessage(hash, sig, publicKeyBuffer);
  }

  static _tryImportPublicKey(publicKey) {
    let publicKeyBuffer = publicKey;
    try {
      if (!Buffer.isBuffer(publicKey)) {
        publicKeyBuffer = new Buffer(publicKey, 'hex');
      }
      return publicKeyBuffer;
    } catch (e) {
      return false;
    }
  }

  static _tryImportSignature(signature) {
    try {
      let signatureBuffer = signature;
      if (!Buffer.isBuffer(signature)) {
        signatureBuffer = new Buffer(signatureBuffer, 'hex');
      }
      const signatureA = new Uint8Array(signatureBuffer);
      return secp256k1.signatureImport(signatureA);
    } catch (e) {
      return false;
    }
  }

  static _tryVerifyMessage(hash, sig, publicKeyBuffer) {
    try {
      const hashA = new Uint8Array(hash);
      const sigA = new Uint8Array(sig);
      const publicKeyA = new Uint8Array(publicKeyBuffer);
      return secp256k1.ecdsaVerify(sigA, hashA, publicKeyA);
    } catch (e) {
      return false;
    }
  }

  static formatAmount(satoshis, unit, opts) {
    const UNITS = Object.entries(CWC.Constants.UNITS).reduce((units, [currency, currencyConfig]) => {
      units[currency] = {
        toSatoshis: currencyConfig.toSatoshis,
        maxDecimals: currencyConfig.short.maxDecimals,
        minDecimals: currencyConfig.short.minDecimals
      };
      return units;
    }, {} as { [currency: string]: { toSatoshis: number; maxDecimals: number; minDecimals: number } });

    if (typeof satoshis == 'number') {
      satoshis = BigInt(Math.round(satoshis));
    }

    $.checkArgument(typeof satoshis == 'bigint');
    $.checkArgument(_.includes(_.keys(UNITS), unit));
    opts = opts || {};

    if (!UNITS[unit]) {
      return satoshis.toLocaleString();
    }
    const u = _.assign(UNITS[unit], opts);
    const decimal = u.decimalSeparator || '.';
    const thousands = u.thousandsSeparator || ',';

    function getAmount(sats) {
      const toSatoshis = BigInt(u.toSatoshis);

      // This is to round the last digit:
      const decForRounding = 3;
      const decForRoundingPlus = 3 + u.maxDecimals;
      let decForRounding10 = BigInt(10 ** (decForRounding + u.maxDecimals));
      if (decForRounding10 > toSatoshis) decForRounding10 = toSatoshis;

      let divisor = toSatoshis / decForRounding10;
      const amountWithRounding = (sats / divisor).toString();
      const extra = amountWithRounding.substr(amountWithRounding.length - decForRounding + 1);

      let half = '5';
      half = _.padEnd(half, extra.length, '0');

      let maxDec10 = BigInt(10 ** u.maxDecimals);
      let amount = sats / (toSatoshis / maxDec10);
      if (BigInt(extra) > BigInt(half)) amount++;

      let ret = amount.toString();
      if (!u.maxDecimals) {
        return ret;
      }

      // add dec separator
      // 1.  pad with 0s.
      ret = _.padStart(ret, ret.length + u.maxDecimals, '0');

      // 2. move separator
      const l = ret.length - u.maxDecimals;
      ret = ret.substr(0, l) + (l > 0 ? decimal + ret.substr(l) : '');

      // 3. remove leading ceros
      let i = 0;
      while (ret.charAt(i) == '0') i++;
      if (ret.charAt(i) == decimal || ret.length == 1) i--;
      ret = ret.substr(i);

      // 4. remove endnig ceros
      if (ret.indexOf(decimal)) {
        let i = ret.length - 1;
        while (ret.charAt(i) == '0') i--;
        ret = ret.substr(0, i + 1);
      }
      return ret;
    }

    function addMinDecimals(nStr) {
      const x = nStr.split(decimal);
      if (!u.minDecimals || (x[1] && x[1].length >= u.minDecimals)) {
        return nStr;
      }

      let toAdd = '';
      let l = x[1] ? x[1].length : 0;
      toAdd = _.padEnd(x[1], u.minDecimals - l, '0');
      return x[0] + decimal + toAdd;
    }

    function addSeparators(nStr) {
      const x = nStr.split(decimal);
      x[0] = x[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      const x1 = x.length > 1 ? decimal + x[1] : '';
      return x[0] + x1;
    }

    let ret = getAmount(satoshis);
    ret = addSeparators(ret);
    ret = addMinDecimals(ret);
    return ret;
  }

  static formatAmountInBtc(amount) {
    return (
      Utils.formatAmount(amount, 'btc', {
        minDecimals: 8,
        maxDecimals: 8
      }) + 'btc'
    );
  }

  static formatUtxos(utxos) {
    if (_.isEmpty(utxos)) return 'none';
    return _.map([].concat(utxos), i => {
      const amount = Utils.formatAmountInBtc(i.satoshis);
      const confirmations = i.confirmations ? i.confirmations + 'c' : 'u';
      return amount + '/' + confirmations;
    }).join(', ');
  }

  static formatRatio(ratio) {
    return (ratio * 100).toFixed(4) + '%';
  }

  static formatSize(size) {
    return (size / 1000).toFixed(4) + 'kB';
  }

  static parseVersion(version) {
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
    v.agent = _.includes(['bwc', 'bws'], x[0]) ? 'bwc' : x[0];
    x = x[1].split('.');
    v.major = x[0] ? parseInt(x[0]) : null;
    v.minor = x[1] ? parseInt(x[1]) : null;
    v.patch = x[2] ? parseInt(x[2]) : null;

    return v;
  }

  static parseAppVersion(agent) {
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
  }

  static getIpFromReq(req): string {
    if (req.headers) {
      if (req.headers['x-forwarded-for']) return req.headers['x-forwarded-for'].split(',')[0];
      if (req.headers['x-real-ip']) return req.headers['x-real-ip'].split(',')[0];
    }
    if (req.ip) return req.ip;
    if (req.connection && req.connection.remoteAddress) return req.connection.remoteAddress;
    return '';
  }

  static checkValueInCollection(value, collection) {
    if (!value || !_.isString(value)) return false;
    return _.includes(_.values(collection), value);
  }

  static getAddressCoin(address) {
    try {
      new Bitcore_['btc'].Address(address);
      return 'btc';
    } catch (e) {
      try {
        new Bitcore_['bch'].Address(address);
        return 'bch';
      } catch (e) {
        return;
      }
    }
  }

  static translateAddress(address, coin) {
    const origCoin = Utils.getAddressCoin(address);
    const origAddress = new Bitcore_[origCoin].Address(address);
    const origObj = origAddress.toObject();

    const result = Bitcore_[coin].Address.fromObject(origObj);
    return coin == 'bch' ? result.toLegacyAddress() : result.toString();
  }
}
module.exports = Utils;
