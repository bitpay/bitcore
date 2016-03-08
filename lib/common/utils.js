var $ = require('preconditions').singleton();
var _ = require('lodash');

var Bitcore = require('bitcore-lib');
var crypto = Bitcore.crypto;
var encoding = Bitcore.encoding;

var Utils = {};

Utils.checkRequired = function(obj, args) {
  args = [].concat(args);
  if (!_.isObject(obj)) return false;
  for (var i = 0; i < args.length; i++) {
    if (!obj.hasOwnProperty(args[i])) return false;
  }
  return true;
};

/**
 *
 * @desc rounds a JAvascript number
 * @param number
 * @return {number}
 */
Utils.strip = function(number) {
  return parseFloat(number.toPrecision(12));
}

/* TODO: It would be nice to be compatible with bitcoind signmessage. How
 * the hash is calculated there? */
Utils.hashMessage = function(text) {
  $.checkArgument(text);
  var buf = new Buffer(text);
  var ret = crypto.Hash.sha256sha256(buf);
  ret = new Bitcore.encoding.BufferReader(ret).readReverse();
  return ret;
};

Utils.verifyMessage = function(text, signature, pubKey) {
  $.checkArgument(text);
  $.checkArgument(pubKey);

  if (!signature)
    return false;

  var pub = new Bitcore.PublicKey(pubKey);
  var hash = Utils.hashMessage(text);

  try {
    var sig = new crypto.Signature.fromString(signature);
    return crypto.ECDSA.verify(hash, sig, pub, 'little');
  } catch (e) {
    return false;
  }
};

Utils.formatAmount = function(satoshis, unit, opts) {
  var UNITS = {
    btc: {
      toSatoshis: 100000000,
      maxDecimals: 6,
      minDecimals: 2,
    },
    bit: {
      toSatoshis: 100,
      maxDecimals: 0,
      minDecimals: 0,
    },
    sat: {
      toSatoshis: 1,
      maxDecimals: 0,
      minDecimals: 0,
    }
  };

  $.shouldBeNumber(satoshis);
  $.checkArgument(_.contains(_.keys(UNITS), unit));

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

  var u = _.assign(UNITS[unit], opts);
  var amount = (satoshis / u.toSatoshis).toFixed(u.maxDecimals);
  return addSeparators(amount, opts.thousandsSeparator || ',', opts.decimalSeparator || '.', u.minDecimals);
};

Utils.formatAmountInBtc = function(amount) {
  return Utils.formatAmount(amount, 'btc', {
    minDecimals: 8,
    maxDecimals: 8,
  }) + 'btc';
};

Utils.formatUtxos = function(utxos) {
  if (_.isEmpty(utxos)) return 'none';
  return _.map([].concat(utxos), function(i) {
    var amount = Utils.formatAmountInBtc(i.satoshis);
    var confirmations = i.confirmations ? i.confirmations + 'c' : 'u';
    return amount + '/' + confirmations;
  }).join(', ');
};

Utils.formatRatio = function(ratio) {
  return (ratio * 100.).toFixed(4) + '%';
};

Utils.formatSize = function(size) {
  return (size / 1000.).toFixed(4) + 'kB';
};

module.exports = Utils;
