var Key = require('./Key'),
  Point = require('./Point'),
  twoSha256 = require('../util').twoSha256,
  buffertools = require('buffertools'),
  bignum = require('bignum');

/**
 * Pre-BIP32 Electrum public key derivation (electrum <2.0)
 *
 * For now, this class can only understands master public keys.
 * It doesn't support derivation from a private master key (TODO).
 *
 * @example examples/ElectrumMPK.js
 */
function Electrum(master_public_key) {
  this.mpk = new Buffer(master_public_key, 'hex');
}

Electrum.prototype.getSequence = function(for_change, n) {
  var mode = for_change ? 1 : 0;
  var buf = Buffer.concat([new Buffer(n + ':' + mode + ':', 'utf8'), this.mpk]);
  return bignum.fromBuffer(twoSha256(buf));
};

Electrum.prototype.generatePubKey = function(n, for_change) {
  var x = bignum.fromBuffer(this.mpk.slice(0, 32), {
    size: 32
  });
  var y = bignum.fromBuffer(this.mpk.slice(32, 64), {
    size: 32
  });
  var mpk_pt = new Point(x, y);

  var sequence = this.getSequence(for_change, n);
  var sequence_key = new Key();
  sequence_key.private = sequence.toBuffer();
  sequence_key.regenerateSync();
  sequence_key.compressed = false;

  var sequence_pt = Point.fromUncompressedPubKey(sequence_key.public);

  pt = Point.add(mpk_pt, sequence_pt);

  var xbuf = pt.x.toBuffer({
    size: 32
  });
  var ybuf = pt.y.toBuffer({
    size: 32
  });
  var prefix = new Buffer([0x04]);

  var key = new Key();
  key.compressed = false;
  key.public = Buffer.concat([prefix, xbuf, ybuf]);

  return key.public;
};

Electrum.prototype.generateChangePubKey = function(sequence) {
  return this.generatePubKey(sequence, true);
};

module.exports = Electrum;
