var _ = require('lodash');
var Bitcore = require('bitcore');
var PrivateKey = Bitcore.PrivateKey;
var PublicKey = Bitcore.PublicKey;
var Signature = Bitcore.crypto.Signature;
var ECDSA = Bitcore.crypto.ECDSA;
var Hash = Bitcore.crypto.Hash;
var BufferReader = Bitcore.encoding.BufferReader;



var SignUtils = function() {};

/* TODO: It would be nice to be compatible with bitcoind signmessage. How
 * the hash is calculated there? */
SignUtils.hash = function(text) {
  var buf = new Buffer(text);
  var ret = Hash.sha256sha256(buf);
  ret = new BufferReader(ret).readReverse();
  return ret;
};


SignUtils.sign = function(text, privKey) {
  var priv = new PrivateKey(privKey);
  var hash = SignUtils.hash(text);
  return ECDSA.sign(hash, priv, 'little').toString();
};


SignUtils.verify = function(text, signature, pubKey) {
  var pub = new PublicKey(pubKey);
  var hash = SignUtils.hash(text);

  try {
    var sig = new Signature.fromString(signature);
    return ECDSA.verify(hash, sig, pub, 'little');
  } catch (e) {
    return false;
  }
};

module.exports = SignUtils;
