var _ = require('lodash');
var Bitcore = require('bitcore');
var Address = Bitcore.Address;
var PrivateKey = Bitcore.PrivateKey;
var PublicKey = Bitcore.PublicKey;
var crypto = Bitcore.crypto;

function WalletUtils() {};

/* TODO: It would be nice to be compatible with bitcoind signmessage. How
 * the hash is calculated there? */
WalletUtils.hashMessage = function(text) {
  var buf = new Buffer(text);
  var ret = crypto.Hash.sha256sha256(buf);
  ret = new Bitcore.encoding.BufferReader(ret).readReverse();
  return ret;
};


WalletUtils.signMessage = function(text, privKey) {
  var priv = new PrivateKey(privKey);
  var hash = WalletUtils.hashMessage(text);
  return crypto.ECDSA.sign(hash, priv, 'little').toString();
};


WalletUtils.verifyMessage = function(text, signature, pubKey) {
  var pub = new PublicKey(pubKey);
  var hash = WalletUtils.hashMessage(text);

  try {
    var sig = new crypto.Signature.fromString(signature);
    return crypto.ECDSA.verify(hash, sig, pub, 'little');
  } catch (e) {
    return false;
  }
};

WalletUtils.deriveAddress = function(publicKeyRing, path, m, network) {

  var publicKeys = _.map(publicKeyRing, function(xPubKey) {
    var xpub = new Bitcore.HDPublicKey(xPubKey);
    return xpub.derive(path).publicKey;
  });

  var bitcoreAddress = Address.createMultisig(publicKeys, m, network);

  return {
    address: bitcoreAddress.toString(),
    path: path,
    publicKeys: _.invoke(publicKeys, 'toString'),
  };
};

WalletUtils.getProposalHash = function(toAddress, amount, message) {
  return toAddress + '|' + amount + '|' + (message || '');
};

module.exports = WalletUtils;
