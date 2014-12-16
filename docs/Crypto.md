# Crypto

The cryptographic primitives (ECDSA and HMAC) implementations in this package have been audited bythe BitPay engineering team. More review and certifications are always welcomed.

## random

The `bitcore.Crypto.Random` namespace contains a single function, named `getRandomBuffer(size)` that returns a `Buffer` instance with random bytes. It may not work depending on the engine that bitcore is running on (doesn't work with IE versions lesser than 11).

## bn

The `bitcore.Crypto.BN` class contains a wrapper around [bn.js](https://github.com/indutny/bn.js), the bignum library used internally in bitcore.

## point

The `bitcore.Crypto.Point` class contains a wrapper around the class Point of [elliptic.js](https://github.com/indutny/elliptic.js), the elliptic curve library used internally in bitcore.

## hash

The `bitcore.Crypto.Hash` namespace contains a set of hashes and utilities. These are either the native `crypto` hash functions from `node.js` or their respective browser shims as provided by the `browserify` library.

## ecdsa

`bitcore.Crypto.ECDSA` contains a pure javascript implementation of the elliptic curve DSA signature scheme. 
