var Put = require('bufferput');
var buffertools = require('buffertools');
var hex = function(hex) {
  return new Buffer(hex, 'hex');
};

exports.btc = {
    name:'Bitcoin',
    livenet : {
        name: 'livenet',
        magic: hex('f9beb4d9'),
        addressVersion: 0x00,
        privKeyVersion: 128,
        P2SHVersion: 5,
        hkeyPublicVersion: 0x0488b21e,
        hkeyPrivateVersion: 0x0488ade4,
        genesisBlock: {
          hash: hex('6FE28C0AB6F1B372C1A6A246AE63F74F931E8365E15A089C68D6190000000000'),
          merkle_root: hex('3BA3EDFD7A7B12B27AC72C3E67768F617FC81BC3888A51323A9FB8AA4B1E5E4A'),
          height: 0,
          nonce: 2083236893,
          version: 1,
          prev_hash: buffertools.fill(new Buffer(32), 0),
          timestamp: 1231006505,
          bits: 486604799,
        },
        dnsSeeds: [
                   'seed.bitcoin.sipa.be',
                   'dnsseed.bluematt.me',
                   'dnsseed.bitcoin.dashjr.org',
                   'seed.bitcoinstats.com',
                   'seed.bitnodes.io',
                   'bitseed.xf2.org'
                   ],
                   defaultClientPort: 8333
    },
    testnet : {
        name: 'testnet',
        magic: hex('0b110907'),
        addressVersion: 0x6f,
        privKeyVersion: 239,
        P2SHVersion: 196,
        hkeyPublicVersion: 0x043587cf,
        hkeyPrivateVersion: 0x04358394,
        genesisBlock: {
          hash: hex('43497FD7F826957108F4A30FD9CEC3AEBA79972084E90EAD01EA330900000000'),
          merkle_root: hex('3BA3EDFD7A7B12B27AC72C3E67768F617FC81BC3888A51323A9FB8AA4B1E5E4A'),
          height: 0,
          nonce: 414098458,
          version: 1,
          prev_hash: buffertools.fill(new Buffer(32), 0),
          timestamp: 1296688602,
          bits: 486604799,
        },
        dnsSeeds: [
                   'testnet-seed.bitcoin.petertodd.org',
                   'testnet-seed.bluematt.me'
                   ],
                   defaultClientPort: 18333
    }
}

exports.doge = {
    name:'Dogecoin',
    livenet : {
      name: 'livenet',
      magic: hex('c0c0c0c0'),
      addressVersion: 0x1E,
      privKeyVersion: 128,
      P2SHVersion: 5,
      hkeyPublicVersion: 0x0488b21e,
      hkeyPrivateVersion: 0x0488ade4,
      genesisBlock: {
        hash: hex('9156352C1818B32E90C9E792EFD6A11A82FE7956A630F03BBEE236CEDAE3911A'),
        merkle_root: hex('696AD20E2DD4365C7459B4A4A5AF743D5E92C6DA3229E6532CD605F6533F2A5B'),
        height: 0,
        nonce: 99943,
        version: 1,
        prev_hash: buffertools.fill(new Buffer(32), 0),
        timestamp: 1231006505,
        bits: 486604799,
      },
      dnsSeeds: [
        'seed.dogecoin.com',
        'seed.mophides.com',
        'seed.dglibrary.org',
        'seed.dogechain.info'
      ],
      defaultClientPort: 22556
    },
    testnet : {
      name: 'testnet',
      magic: hex('0b110907'),
      addressVersion: 0x71,
      privKeyVersion: 239,
      P2SHVersion: 196,
      hkeyPublicVersion: 0x043587cf,
      hkeyPrivateVersion: 0x04358394,
      genesisBlock: {
        hash: hex('43497FD7F826957108F4A30FD9CEC3AEBA79972084E90EAD01EA330900000000'),
        merkle_root: hex('3BA3EDFD7A7B12B27AC72C3E67768F617FC81BC3888A51323A9FB8AA4B1E5E4A'),
        height: 0,
        nonce: 414098458,
        version: 1,
        prev_hash: buffertools.fill(new Buffer(32), 0),
        timestamp: 1296688602,
        bits: 486604799,
      },
      dnsSeeds: [
        'testnet-seed.bitcoin.petertodd.org',
        'testnet-seed.bluematt.me'
      ],
      defaultClientPort: 18333
    }
}

exports.mainnet = exports['btc'].livenet;

