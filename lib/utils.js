var $ = require('preconditions').singleton();
var _ = require('lodash');

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


Utils.signMessage = function(text, privKey) {
  $.checkArgument(text);
  var priv = new PrivateKey(privKey);
  var hash = Utils.hashMessage(text);
  return crypto.ECDSA.sign(hash, priv, 'little').toString();
};


Utils.verifyMessage = function(text, signature, pubKey) {
  $.checkArgument(text);
  $.checkArgument(pubKey);

  if (!signature)
    return false;

  var pub = new PublicKey(pubKey);
  var hash = Utils.hashMessage(text);

  try {
    var sig = new crypto.Signature.fromString(signature);
    return crypto.ECDSA.verify(hash, sig, pub, 'little');
  } catch (e) {
    return false;
  }
};


module.exports = Utils;
