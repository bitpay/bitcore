var $ = require('preconditions').singleton();
var _ = require('lodash');

var Bitcore = require('bitcore-lib');
var Address = Bitcore.Address;
var crypto = Bitcore.crypto;
var encoding = Bitcore.encoding;

var Constants = require('./constants');
var Defaults = require('./defaults');

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
  return (parseFloat(number.toPrecision(12)));
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

Utils.newBitcoreTransaction = function() {
  return new Bitcore.Transaction();
};

Utils.buildTx = function(txp) {
  var t = Utils.newBitcoreTransaction();

  $.checkState(_.contains(_.values(Constants.SCRIPT_TYPES), txp.addressType));

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
      $.checkState(!o.script != !o.toAddress, 'Output should have either toAddress or script specified');
      if (o.script) {
        t.addOutput(new Bitcore.Transaction.Output({
          script: o.script,
          satoshis: o.amount
        }));
      } else {
        t.to(o.toAddress, o.amount);
      }
    });
  }

  if (_.startsWith(txp.version, '1.')) {
    Bitcore.Transaction.FEE_SECURITY_MARGIN = 1;
    t.feePerKb(txp.feePerKb);
  } else {
    t.fee(txp.fee);
  }

  t.change(txp.changeAddress.address);

  // Shuffle outputs for improved privacy
  if (t.outputs.length > 1) {
    $.checkState(t.outputs.length == txp.outputOrder.length);
    t.sortOutputs(function(outputs) {
      return _.map(txp.outputOrder, function(i) {
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

  $.checkState(totalInputs - totalOutputs <= Defaults.MAX_TX_FEE);

  return t;
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

  var u = UNITS[unit];
  var amount = (satoshis / u.toSatoshis).toFixed(u.maxDecimals);
  return addSeparators(amount, opts.thousandsSeparator || ',', opts.decimalSeparator || '.', u.minDecimals);
};


module.exports = Utils;
