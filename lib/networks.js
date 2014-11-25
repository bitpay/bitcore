'use strict';

exports.mainnet = {
  pubkeyhash:   0x00,
  identity:     0x0f,
  identephem:   0x02,
  identpersist: 0x01,
  privatekey:   0x80,
  scripthash:   0x05,
  bip32pubkey:  0x0488b21e,
  bip32privkey: 0x0488ade4,
};

exports.testnet = {
  pubkeyhash:   0x6f,
  identity:     0x0f,
  identephem:   0x02,
  identpersist: 0x11,
  privatekey:   0xef,
  scripthash:   0xc4,
  bip32pubkey:  0x043587cf,
  bip32privkey: 0x04358394,
};

exports.livenet = exports.mainnet;
