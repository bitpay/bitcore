var Point = require('./Point'),
  Key = require('./Key'),
  sha256 = require('../util').sha256,
  twoSha256 = require('../util').twoSha256;

/**
 * For now, this class can only supports derivation from public key
 * It doesn't support private key derivation (TODO).
 *
 * @example examples/Armory.js
 */
function Armory(chaincode, pubkey) {
  this.chaincode = new Buffer(chaincode, 'hex');
  this.pubkey = new Buffer(pubkey, 'hex');
}

Armory.prototype.generatePubKey = function() {
  var pubKey = this.pubkey;
  var chainCode = this.chaincode;
  var chainXor = twoSha256(pubKey);

  for (var i = 0; i < 32; i++)
    chainXor[i] ^= chainCode[i];

  var pt = Point.fromUncompressedPubKey(pubKey);
  pt = Point.multiply(pt, chainXor);

  var new_pubkey = pt.toUncompressedPubKey();

  return new_pubkey;
};

Armory.prototype.next = function() {
  var next_pubkey = this.generatePubKey();
  return new Armory(this.chaincode, next_pubkey);
};

/**
 * PS: MPK here represents the pubkey concatenated
 * with the chain code. It is an unofficial standard.
 *
 * Armory will soon release an officially supported
 * format:
 *
 * https://github.com/etotheipi/BitcoinArmory/issues/204#issuecomment-42217801
 */
Armory.fromMasterPublicKey = function(mpk) {
  var pubkey = mpk.substr(0, 130);
  var chaincode = mpk.substr(130, mpk.length);
  return new Armory(chaincode, pubkey);
};

function decode(str) {
  var from = '0123456789abcdef';
  var to = 'asdfghjkwertuion';
  var res = '';
  for (var i = 0; i < str.length; i++)
    res += from.charAt(to.indexOf(str.charAt(i)));
  return res;
}

Armory.decodeSeed = function(seed) {
  var keys = seed.trim().split('\n');
  var lines = [];

  for (var i = 0; i < keys.length; i++) {
    var k = keys[i].replace(' ', '');
    var raw = new Buffer(decode(k), 'hex');
    var data = raw.slice(0, 16);
    lines.push(data);
  }

  var privKey = Buffer.concat([lines[0], lines[1]]);
  var chainCode = (lines.length == 4) ?
    Buffer.concat([lines[2], lines[3]]) : Armory.deriveChaincode(privKey);

  return {
    privKey: privKey,
    chainCode: chainCode
  };
};

// Derive chain code from root key
Armory.fromSeed = function(seed) {
  var res = Armory.decodeSeed(seed);
  // generate first public key
  var key = new Key();
  key.private = res.privKey;
  key.compressed = false;
  key.regenerateSync();

  return new Armory(res.chainCode, key.public);
};

Armory.deriveChaincode = function(root) {
  var msg = 'Derive Chaincode from Root Key';
  var hash = twoSha256(root);

  var okey = [];
  var ikey = [];
  for (var i = 0; i < hash.length; i++) {
    okey.push(0x5c ^ hash[i]);
    ikey.push(0x36 ^ hash[i]);
  }

  okey = new Buffer(okey);
  ikey = new Buffer(ikey);

  var m = new Buffer(msg, 'utf8');
  var a = sha256(Buffer.concat([ikey, m]));
  var b = sha256(Buffer.concat([okey, a]));
  return b;
};

module.exports = Armory;
