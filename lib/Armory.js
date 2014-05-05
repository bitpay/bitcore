var Point = require('./browser/Point'),
  twoSha256 = require('../util').twoSha256,
  BigInteger = require('../browser/vendor-bundle.js').BigInteger;

// TODO: use native modules instead of browser libraries

/**
 * For now, this class can only supports derivation from public key
 * It doesn't support private key derivation (TODO).
 *
 * @example examples/Armory.js
 */
function Armory (chaincode, pubkey) {
  this.chaincode = new Buffer(chaincode, 'hex');
  this.pubkey = new Buffer(pubkey, 'hex');
}

Armory.prototype.generatePubKey = function () {
  var pubKey = this.pubkey;
  var chainCode = this.chaincode;
  var chainXor = twoSha256(pubKey);

  for (var i = 0; i < 32; i++)
    chainXor[i] ^= chainCode[i];

  var A = new BigInteger(chainXor.toString('hex'), 16);

  var pt = Point.fromUncompressedPubKey(pubKey);
  pt = Point.multiply(pt, A);

  var new_pubkey = pt.toUncompressedPubKey();

  return new_pubkey;
};

Armory.prototype.next = function () {
  var next_pubkey = this.generatePubKey();
  return new Armory(this.chaincode, next_pubkey);
};

module.exports = Armory;
