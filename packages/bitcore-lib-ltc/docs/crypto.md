# Bitcoin Crypto
The cryptographic primitives (ECDSA and HMAC) implementations in this package have been reviewed by the BitPay engineering team. More audits and reviews are welcomed.

## Random
The `litecore.crypto.Random` namespace contains a single function, named `getRandomBuffer(size)` that returns a `Buffer` instance with random bytes. It may not work depending on the engine that litecore is running on (doesn't work with IE versions lesser than 11).

## BN
The `litecore.Crypto.BN` class contains a wrapper around [bn.js](https://github.com/indutny/bn.js), the bignum library used internally in litecore.

## Point
The `litecore.Crypto.Point` class contains a wrapper around the class Point of [elliptic.js](https://github.com/indutny/elliptic), the elliptic curve library used internally in litecore.

## Hash
The `litecore.Crypto.Hash` namespace contains a set of hashes and utilities. These are either the native `crypto` hash functions from `node.js` or their respective browser shims as provided by the `browserify` library.

## ECDSA
`litecore.Crypto.ECDSA` contains a pure JavaScript implementation of the elliptic curve DSA signature scheme based on [elliptic.js](https://github.com/indutny/elliptic).
