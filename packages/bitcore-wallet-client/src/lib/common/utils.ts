'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var sjcl = require('sjcl');
var Stringify = require('json-stable-stringify');

var Bitcore = require('bitcore-lib');
var Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash'),
};
var PrivateKey = Bitcore.PrivateKey;
var PublicKey = Bitcore.PublicKey;
var crypto = Bitcore.crypto;

var Constants = require('./constants');
var Defaults = require('./defaults');
let SJCL = {};

export class Utils {

  encryptMessage(message, encryptingKey) {
    var key = sjcl.codec.base64.toBits(encryptingKey);
    return sjcl.encrypt(key, message, _.defaults({
      ks: 128,
      iter: 1,
    }, SJCL));
  }

  // Will throw if it can't decrypt
  decryptMessage(cyphertextJson, encryptingKey) {
    if (!cyphertextJson) return;

    if (!encryptingKey)
      throw new Error('No key');

    var key = sjcl.codec.base64.toBits(encryptingKey);
    return sjcl.decrypt(key, cyphertextJson);
  }

  decryptMessageNoThrow(cyphertextJson, encryptingKey) {
    function isJsonString(str) {
      var r;
      try {
        r = JSON.parse(str);
      } catch (e) {
        return false;
      }
      return r;
    }

    if (!encryptingKey)
      return '<ECANNOTDECRYPT>';

    if (!cyphertextJson)
      return '';

    // no sjcl encrypted json
    var r = isJsonString(cyphertextJson);
    if (!r || !r.iv || !r.ct) {
      return cyphertextJson;
    }

    try {
      return this.decryptMessage(cyphertextJson, encryptingKey);
    } catch (e) {
      return '<ECANNOTDECRYPT>';
    }
  }

  /* TODO: It would be nice to be compatible with bitcoind signmessage. How
   * the hash is calculated there? */
  hashMessage(text) {
    $.checkArgument(text);
    var buf = Buffer.from(text);
    var ret = crypto.Hash.sha256sha256(buf);
    ret = new Bitcore.encoding.BufferReader(ret).readReverse();
    return ret;
  }

  signMessage(text, privKey) {
    $.checkArgument(text);
    var priv = new PrivateKey(privKey);
    var hash = this.hashMessage(text);
    return crypto.ECDSA.sign(hash, priv, 'little').toString();
  }

  verifyMessage(text, signature, pubKey) {
    $.checkArgument(text);
    $.checkArgument(pubKey);

    if (!signature)
      return false;

    var pub = new PublicKey(pubKey);
    var hash = this.hashMessage(text);

    try {
      var sig = new crypto.Signature.fromString(signature);
      return crypto.ECDSA.verify(hash, sig, pub, 'little');
    } catch (e) {
      return false;
    }
  }

  privateKeyToAESKey(privKey) {
    $.checkArgument(privKey && _.isString(privKey));
    $.checkArgument(Bitcore.PrivateKey.isValid(privKey), 'The private key received is invalid');
    var pk = Bitcore.PrivateKey.fromString(privKey);
    return Bitcore.crypto.Hash.sha256(pk.toBuffer()).slice(0, 16).toString('base64');
  }

  getCopayerHash(name, xPubKey, requestPubKey) {
    return [name, xPubKey, requestPubKey].join('|');
  }

  getProposalHash(proposalHeader) {
    function getOldHash(toAddress, amount, message, payProUrl) {
      return [toAddress, amount, (message || ''), (payProUrl || '')].join('|');
    }

    // For backwards compatibility
    if (arguments.length > 1) {
      return getOldHash.apply(this, arguments);
    }

    return Stringify(proposalHeader);
  }

  deriveAddress(scriptType, publicKeyRing, path, m, network, coin) {
    $.checkArgument(_.includes(_.values(Constants.SCRIPT_TYPES), scriptType));

    coin = coin || 'btc';
    var bitcore = Bitcore_[coin];
    var publicKeys = _.map(publicKeyRing, function(item) {
      var xpub = new bitcore.HDPublicKey(item.xPubKey);
      return xpub.deriveChild(path).publicKey;
    });

    var bitcoreAddress;
    switch (scriptType) {
      case Constants.SCRIPT_TYPES.P2SH:
        bitcoreAddress = bitcore.Address.createMultisig(publicKeys, m, network);
        break;
      case Constants.SCRIPT_TYPES.P2PKH:
        $.checkState(_.isArray(publicKeys) && publicKeys.length == 1);
        bitcoreAddress = bitcore.Address.fromPublicKey(publicKeys[0], network);
        break;
    }

    return {
      address: bitcoreAddress.toString(true),
      path,
      publicKeys: _.invokeMap(publicKeys, 'toString'),
    };
  }

  xPubToCopayerId(coin, xpub) {

    // this is only because we allowed coin = 0' wallets for BCH
    // for the  "wallet duplication" feature

    var str = coin == 'btc' ? xpub : coin + xpub;

    var hash = sjcl.hash.sha256.hash(str);
    return sjcl.codec.hex.fromBits(hash);
  }

  signRequestPubKey(requestPubKey, xPrivKey) {
    var priv = new Bitcore.HDPrivateKey(xPrivKey).deriveChild(Constants.PATHS.REQUEST_KEY_AUTH).privateKey;
    return this.signMessage(requestPubKey, priv);
  }

  verifyRequestPubKey(requestPubKey, signature, xPubKey) {
    var pub = (new Bitcore.HDPublicKey(xPubKey)).deriveChild(Constants.PATHS.REQUEST_KEY_AUTH).publicKey;
    return this.verifyMessage(requestPubKey, signature, pub.toString());
  }

  formatAmount(satoshis, unit, opts) {
    $.shouldBeNumber(satoshis);
    $.checkArgument(_.includes(_.keys(Constants.UNITS), unit));

    function clipDecimals(number, decimals) {
      var x = number.toString().split('.');
      var d = (x[1] || '0').substring(0, decimals);
      return parseFloat(x[0] + '.' + d);
    }

    function addSeparators(nStr, thousands, decimal, minDecimals) {
      nStr = nStr.replace('.', decimal);
      var x = nStr.split(decimal);
      var x0 = x[0];
      var x1 = x[1];

      x1 = _.dropRightWhile(x1, function(n, i) {
        return n == '0' && i >= minDecimals;
      }).join('');
      var x2 = x.length > 1 ? decimal + x1 : '';

      x0 = x0.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return x0 + x2;
    }

    opts = opts || {};

    var u = Constants.UNITS[unit];
    var precision = opts.fullPrecision ? 'full' : 'short';
    var amount = clipDecimals((satoshis / u.toSatoshis), u[precision].maxDecimals).toFixed(u[precision].maxDecimals);
    return addSeparators(amount, opts.thousandsSeparator || ',', opts.decimalSeparator || '.', u[precision].minDecimals);
  }

  buildTx(txp) {
    var coin = txp.coin || 'btc';

    var bitcore = Bitcore_[coin];

    var t = new bitcore.Transaction();

    $.checkState(_.includes(_.values(Constants.SCRIPT_TYPES), txp.addressType));

    switch (txp.addressType) {
      case Constants.SCRIPT_TYPES.P2SH:
        _.each(txp.inputs, function(i) {
          t.from(i, i.publicKeys, txp.requiredSignatures);
        });
        break;
      case Constants.SCRIPT_TYPES.P2PKH:
        t.from(txp.inputs);
        break;
    }

    if (txp.toAddress && txp.amount && !txp.outputs) {
      t.to(txp.toAddress, txp.amount);
    } else if (txp.outputs) {
      _.each(txp.outputs, function(o) {
        $.checkState(o.script || o.toAddress, 'Output should have either toAddress or script specified');
        if (o.script) {
          t.addOutput(new bitcore.Transaction.Output({
            script: o.script,
            satoshis: o.amount
          }));
        } else {
          t.to(o.toAddress, o.amount);
        }
      });
    }

    t.fee(txp.fee);
    t.change(txp.changeAddress.address);

    // Shuffle outputs for improved privacy
    if (t.outputs.length > 1) {
      var outputOrder = _.reject(txp.outputOrder, function(order) {
        return order >= t.outputs.length;
      });
      $.checkState(t.outputs.length == outputOrder.length);
      t.sortOutputs(function(outputs) {
        return _.map(outputOrder, function(i) {
          return outputs[i];
        });
      });
    }

    // Validate inputs vs outputs independently of Bitcore
    var totalInputs = _.reduce(txp.inputs, function(memo, i) {
      return +i.satoshis + memo;
    }, 0);
    var totalOutputs = _.reduce(t.outputs, function(memo, o) {
      return +o.satoshis + memo;
    }, 0);

    $.checkState(totalInputs - totalOutputs >= 0);
    $.checkState(totalInputs - totalOutputs <= Defaults.MAX_TX_FEE);

    return t;
  }
}

module.exports = Utils;
