var Put = require('bufferput');
var buffertools = require('buffertools');
var hex = function(hex) {return new Buffer(hex, 'hex');};

exports.livenet = {
  name: 'livenet',
  addressVersion: 0x00,
  magic: hex('f9beb4d9'),
  genesisBlock: {
    height: 0,
    nonce: 2083236893,
    version: 1,
    hash: hex('6FE28C0AB6F1B372C1A6A246AE63F74F931E8365E15A089C68D6190000000000'),
    prev_hash: buffertools.fill(new Buffer(32), 0),
    timestamp: 1231006505,
    merkle_root: hex('3BA3EDFD7A7B12B27AC72C3E67768F617FC81BC3888A51323A9FB8AA4B1E5E4A'),
    bits: 486604799
  },
  genesisBlockTx: {
    outs: [{
      v: hex('00F2052A01000000'), // 50 BTC
      s: new Put()
        .word8(65) // 65 bytes of data follow
        .put(hex('04678AFDB0FE5548271967F1A67130B7105CD6A828E03909A67962E0EA1F61DEB649F6BC3F4CEF38C4F35504E51EC112DE5C384DF7BA0B8D578A4C702B6BF11D5F'))
        .word8(0xAC) // OP_CHECKSIG
        .buffer()
    }],
    lock_time: 0,
    version: 1,
    hash: hex('3BA3EDFD7A7B12B27AC72C3E67768F617FC81BC3888A51323A9FB8AA4B1E5E4A'),
    ins: [{
      q: 0xFFFFFFFF,
      o: hex("0000000000000000000000000000000000000000000000000000000000000000FFFFFFFF"),
      s: new Put()
        .put(hex('04FFFF001D010445'))
        .put(new Buffer('The Times 03/Jan/2009 Chancellor on brink of ' +
                        'second bailout for banks', 'ascii'))
        .buffer()
    }]
  },
  proofOfWorkLimit: hex("00000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
  checkpoints: [], // need to put checkpoint blocks here
  addressPubkey: 0,
  addressScript: 5,
  bip32public: 0x0488b21e,
  bip32private: 0x0488ade4,
  keySecret: 128,
};

exports.testnet = {
  name: 'testnet',
  addressVersion: 0x6f,
  magic: hex('0b110907'),
  genesisBlock: {
    height: 0,
    nonce: 414098458,
    version: 1,
    hash: hex('43497FD7F826957108F4A30FD9CEC3AEBA79972084E90EAD01EA330900000000'),
    prev_hash: buffertools.fill(new Buffer(32), 0),
    timestamp: 1296688602,
    merkle_root: hex('3BA3EDFD7A7B12B27AC72C3E67768F617FC81BC3888A51323A9FB8AA4B1E5E4A'),
    bits: 486604799,
  },
  genesisBlockTx: module.exports.livenet.genesisBlockTx,
  proofOfWorkLimit: module.exports.livenet.proofOfWorkLimit,
  checkpoints: [], // need to put checkput blocks here
  addressPubkey: 111,
  addressScript: 196,
  bip32public: 0x043587cf,
  bip32private: 0x04358394,
  keySecret: 239,
};
