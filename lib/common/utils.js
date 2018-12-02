var $ = require('preconditions').singleton();
var _ = require('lodash');

var bitcore = require('bitcore-lib');
var crypto = bitcore.crypto;
var encoding = bitcore.encoding;
var secp256k1 = require('secp256k1');

var Utils = {};
var Bitcore = require('bitcore-lib');
var Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash')
};



Utils.getMissingFields = function(obj, args) {
  args = [].concat(args);
  if (!_.isObject(obj)) return args;
  var missing = _.filter(args, function(arg) {
    return !obj.hasOwnProperty(arg);
  });
  return missing;
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
Utils.hashMessage = function(text, noReverse) {
  $.checkArgument(text);
  var buf = new Buffer(text);
  var ret = crypto.Hash.sha256sha256(buf);
  if (!noReverse) {
    ret = new bitcore.encoding.BufferReader(ret).readReverse();
  }
  return ret;
};

Utils.verifyMessage = function(text, signature, publicKey) {
  $.checkArgument(text);

  var hash = Utils.hashMessage(text, true);

  var sig = this._tryImportSignature(signature);
  if (!sig) {
    return false;
  }

  var publicKeyBuffer = this._tryImportPublicKey(publicKey);
  if (!publicKeyBuffer) {
    return false;
  }

  return this._tryVerifyMessage(hash, sig, publicKeyBuffer);
};

Utils._tryImportPublicKey = function(publicKey) {
  var publicKeyBuffer = publicKey;
  try {
    if (!Buffer.isBuffer(publicKey)) {
      publicKeyBuffer = new Buffer(publicKey, 'hex');
    }
    return publicKeyBuffer;
  } catch (e) {
    return false;
  }
};

Utils._tryImportSignature = function(signature) {
  try {
    var signatureBuffer = signature;
    if (!Buffer.isBuffer(signature)) {
      signatureBuffer = new Buffer(signature, 'hex');
    }
    return secp256k1.signatureImport(signatureBuffer);
  } catch (e) {
    return false;
  }
};

Utils._tryVerifyMessage = function(hash, sig, publicKeyBuffer) {
  try {
    return secp256k1.verify(hash, sig, publicKeyBuffer);
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
    },
    bch: {
      toSatoshis: 100000000,
      maxDecimals: 6,
      minDecimals: 2,
    },
  };

  $.shouldBeNumber(satoshis);
  $.checkArgument(_.includes(_.keys(UNITS), unit));

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

Utils.parseVersion = function(version) {
  var v = {};

  if (!version) return null;

  var x = version.split('-');
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
};

Utils.parseAppVersion = function(agent) {
  var v = {};
  if (!agent) return null;
  agent = agent.toLowerCase();

  var w;
  if ( (w=agent.indexOf('copay')) >=0) {
    v.app = 'copay';
  } else if (  (w=agent.indexOf('bitpay')) >=0) {
    v.app = 'bitpay';
  } else {
    v.app = 'other';
    return v;
  }

  var version = agent.substr(w+ v.app.length);
  x = version.split('.');
  v.major = x[0] ? parseInt(x[0].replace(/\D/g,'')) : null;
  v.minor = x[1] ? parseInt(x[1]) : null;
  v.patch = x[2] ? parseInt(x[2]) : null;

  return v;
};



Utils.checkValueInCollection = function(value, collection) {
  if (!value || !_.isString(value)) return false;
  return _.includes(_.values(collection), value);
};


Utils.getAddressCoin = function(address) {
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
};

Utils.translateAddress = function(address, coin) {
  var origCoin = Utils.getAddressCoin(address);
  var origAddress = new Bitcore_[origCoin].Address(address);
  var origObj = origAddress.toObject();

  var result = Bitcore_[coin].Address.fromObject(origObj)
  return coin == 'bch' ? result.toLegacyAddress() : result.toString();
};



module.exports = Utils;
