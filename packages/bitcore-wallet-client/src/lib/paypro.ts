import { BitcoreLib, BitcoreLibCash } from 'crypto-wallet-core';

var $ = require('preconditions').singleton();
const URL = require('url');
const _ = require('lodash');
const superagent = require('superagent');
const Bitcore = BitcoreLib;
const Errors = require('./errors');
var Bitcore_ = {
  btc: Bitcore,
  bch: BitcoreLibCash
};
// const request = require('request');
const JSON_PAYMENT_REQUEST_CONTENT_TYPE = 'application/payment-request';
const JSON_PAYMENT_VERIFY_CONTENT_TYPE = 'application/verify-payment';
const JSON_PAYMENT_CONTENT_TYPE = 'application/payment';
const JSON_PAYMENT_ACK_CONTENT_TYPE = 'application/payment-ack';

const dfltTrustedKeys = require('../util/JsonPaymentProtocolKeys.js');
const MAX_FEE_PER_KB = 500000;

export class PayPro {
  // static request: request;
  static r = superagent;
  constructor() {}
  // var PayPro = {
  //
  // };

  // /**
  // * Verifies the signature of a given payment request is both valid and from a trusted key
  // */
  static _verify(requestUrl, headers, network, trustedKeys, callback) {
    let hash = headers.digest.split('=')[1];
    let signature = headers.signature;
    let signatureType = headers['x-signature-type'];
    let identity = headers['x-identity'];
    let host;

    if (network == 'testnet') network = 'test';
    if (network == 'livenet') network = 'main';

    if (!requestUrl) {
      return callback(
        new Error('You must provide the original payment request url')
      );
    }
    if (!trustedKeys) {
      return callback(new Error('You must provide a set of trusted keys'));
    }

    try {
      host = URL.parse(requestUrl).hostname;
    } catch (e) {}

    if (!host) {
      return callback(new Error('Invalid requestUrl'));
    }
    if (!signatureType) {
      return callback(new Error('Response missing x-signature-type header'));
    }
    if (typeof signatureType !== 'string') {
      return callback(new Error('Invalid x-signature-type header'));
    }
    if (signatureType !== 'ecc') {
      return callback(new Error(`Unknown signature type ${signatureType}`));
    }
    if (!signature) {
      return callback(new Error('Response missing signature header'));
    }
    if (typeof signature !== 'string') {
      return callback(new Error('Invalid signature header'));
    }
    if (!identity) {
      return callback(new Error('Response missing x-identity header'));
    }
    if (typeof identity !== 'string') {
      return callback(new Error('Invalid identity header'));
    }
    if (!trustedKeys[identity]) {
      return callback(
        new Error(
          `Response signed by unknown key (${identity}), unable to validate`
        )
      );
    }

    let keyData = trustedKeys[identity];
    if (keyData.domains.indexOf(host) === -1) {
      return callback(
        new Error(
          `The key on the response (${identity}) is not trusted for domain ${host}`
        )
      );
    } else if (!keyData.networks.includes(network)) {
      return callback(
        new Error(
          `The key on the response is not trusted for transactions on the '${network}' network`
        )
      );
    }

    var hashbuf = Buffer.from(hash, 'hex');
    let sigbuf = Buffer.from(signature, 'hex');

    let s_r = Buffer.alloc(32);
    let s_s = Buffer.alloc(32);

    sigbuf.copy(s_r, 0, 0);
    sigbuf.copy(s_s, 0, 32);

    let s_rBN = Bitcore.crypto.BN.fromBuffer(s_r);
    let s_sBN = Bitcore.crypto.BN.fromBuffer(s_s);

    let pub = Bitcore.PublicKey.fromString(keyData.publicKey);

    let sig = new Bitcore.crypto.Signature();
    sig.set({ r: s_rBN, s: s_sBN });

    let valid = Bitcore.crypto.ECDSA.verify(hashbuf, sig, pub);

    if (!valid) {
      return callback(new Error('Response signature invalid'));
    }

    return callback(null, keyData.owner);
  }

  static runRequest(opts, cb) {
    $.checkArgument(opts.network, 'should pass network');
    var r = this.r[opts.method.toLowerCase()](opts.url);
    _.each(opts.headers, function (v, k) {
      if (v) r.set(k, v);
    });
    if (opts.args) {
      if (
        opts.method.toLowerCase() == 'post' ||
        opts.method.toLowerCase() == 'put'
      ) {
        r.send(opts.args);
      } else {
        r.query(opts.args);
      }
    }
    r.end((err, res) => {
      if (err) return cb(err);
      var body = res.text;
      if (!res || res.statusCode != 200) {
        // some know codes
        if (res.statusCode == 400) {
          return cb(new Errors.INVOICE_EXPIRED());
        } else if (res.statusCode == 404) {
          return cb(new Errors.INVOICE_NOT_AVAILABLE());
        } else if (res.statusCode == 422) {
          return cb(new Errors.UNCONFIRMED_INPUTS_NOT_ACCEPTED());
        }

        let m = res ? res.statusMessage || res.statusCode : '';
        return cb(new Error('Could not fetch invoice: ' + m));
      }

      // console.log('########################### SKIPPING VERIFICATION!!!!!!!!!!! ');
      // TODO TODO TODO
      //  return cb(null, body);

      if (opts.noVerify) return cb(null, body);

      if (!res.headers.digest) {
        return cb(new Error('Digest missing from response headers'));
      }

      //
      // Verification
      //

      // Step 1: Check digest from header
      let digest = res.headers.digest.toString().split('=')[1];
      let hash = Bitcore.crypto.Hash.sha256(Buffer.from(body, 'utf8')).toString(
        'hex'
      );

      if (digest !== hash) {
        return cb(
          new Error(
            `Response body hash does not match digest header. Actual: ${hash} Expected: ${digest}`
          )
        );
      }
      // Step 2: verify digest's signature
      PayPro._verify(
        opts.url,
        res.headers,
        opts.network,
        opts.trustedKeys,
        err => {
          if (err) return cb(err);

          let ret;
          try {
            ret = JSON.parse(body);
          } catch (e) {
            return cb(new Error('Could not payment request:' + body));
          }
          ret.verified = 1;
          return cb(null, ret);
        }
      );
    });
  }

  static get(opts, cb) {
    $.checkArgument(opts && opts.url);
    opts.trustedKeys = opts.trustedKeys || dfltTrustedKeys;

    var coin = opts.coin || 'btc';
    var bitcore = Bitcore_[coin];

    var COIN = coin.toUpperCase();
    opts.headers = opts.headers || {
      Accept: JSON_PAYMENT_REQUEST_CONTENT_TYPE,
      'Content-Type': 'application/octet-stream'
    };
    opts.method = 'GET';
    opts.network = opts.network || 'livenet';

    PayPro.runRequest(opts, function (err, data) {
      if (err) return cb(err);

      var ret: any = {};

      // otherwise, it returns err.
      ret.verified = true;

      // network
      if (data.network == 'test') ret.network = 'testnet';

      if (data.network == 'main') ret.network = 'livenet';

      if (!data.network) return cb(new Error('No network at payment request'));

      // currency
      if (data.currency != COIN)
        return cb(new Error('Currency mismatch. Expecting:' + COIN));

      ret.coin = coin;

      // fee
      if (data.requiredFeeRate > MAX_FEE_PER_KB)
        return cb(new Error('Fee rate too high:' + data.requiredFeeRate));

      ret.requiredFeeRate = data.requiredFeeRate;

      // outputs
      if (!data.outputs || data.outputs.length != 1) {
        return cb(new Error('Must have 1 output'));
      }

      if (!_.isNumber(data.outputs[0].amount)) {
        return cb(new Error('Bad output amount'));
      }
      ret.amount = data.outputs[0].amount;

      try {
        ret.toAddress = new bitcore.Address(data.outputs[0].address).toString(
          true
        );
      } catch (e) {
        return cb(new Error('Bad output address ' + e));
      }

      ret.memo = data.memo;
      ret.paymentId = data.paymentId;
      try {
        ret.expires = new Date(data.expires).toISOString();
      } catch (e) {
        return cb(new Error('Bad expiration'));
      }
      return cb(null, ret);
    });
  }

  static send(opts, cb) {
    $.checkArgument(opts.rawTxUnsigned)
      .checkArgument(opts.url)
      .checkArgument(opts.rawTx);

    var coin = opts.coin || 'btc';
    var COIN = coin.toUpperCase();

    opts.network = opts.network || 'livenet';
    opts.method = 'POST';
    opts.headers = opts.headers || {
      'Content-Type': JSON_PAYMENT_VERIFY_CONTENT_TYPE
    };
    let size = opts.rawTx.length / 2;
    opts.args = JSON.stringify({
      currency: COIN,
      unsignedTransaction: opts.rawTxUnsigned,
      weightedSize: size
    });

    // Do not verify verify-payment message's response
    opts.noVerify = true;

    // verify request
    PayPro.runRequest(opts, function (err, rawData) {
      if (err) {
        console.log(
          'Error at verify-payment:',
          err.message ? err.message : '',
          opts
        );
        return cb(err);
      }

      opts.headers = {
        'Content-Type': JSON_PAYMENT_CONTENT_TYPE,
        Accept: JSON_PAYMENT_ACK_CONTENT_TYPE
      };

      if (opts.bp_partner) {
        opts.headers['BP_PARTNER'] = opts.bp_partner;
        if (opts.bp_partner_version) {
          opts.headers['BP_PARTNER_VERSION'] = opts.bp_partner_version;
        }
      }

      opts.args = JSON.stringify({
        currency: COIN,
        transactions: [opts.rawTx]
      });

      // Do not verify payment message's response
      opts.noVerify = true;

      PayPro.runRequest(opts, function (err, rawData) {
        if (err) {
          console.log(
            'Error at payment:',
            err.message ? err.message : '',
            opts
          );
          return cb(err);
        }

        var memo;
        if (rawData) {
          try {
            var data = JSON.parse(rawData.toString());
            memo = data.memo;
          } catch (e) {
            console.log('Could not decode paymentACK');
          }
        }
        return cb(null, rawData, memo);
      });
    });
  }
}
