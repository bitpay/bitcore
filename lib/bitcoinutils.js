
var _ = require('lodash');

var Bitcore = require('bitcore');
var BitcoreAddress = Bitcore.Address;

function BitcoinUtils () {};

BitcoinUtils.deriveAddress = function(publicKeyRing, path, m, network) {

  var publicKeys = _.map(publicKeyRing, function(xPubKey) {
    var xpub = new Bitcore.HDPublicKey(xPubKey);
    return xpub.derive(path).publicKey;
  });

  var bitcoreAddress = BitcoreAddress.createMultisig(publicKeys, m, network);

  return {
    address: bitcoreAddress.toString(),
    path: path,
    publicKeys: _.invoke(publicKeys, 'toString'),
  };
};

module.exports = BitcoinUtils;
