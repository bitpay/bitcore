# HDKeys
Create and derive extended public and private keys according to the BIP32 standard for Hierarchical Deterministic (HD) keys.

## Hierarchically Derived Keys
Bitcore provides full support for [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki), allowing for many key management schemas that benefit from this property. Please be sure to read and understand the basic concepts and the warnings on that BIP before using these classes.

## HDPrivateKey
An instance of a [PrivateKey](privatekey.md) that also contains information required to derive child keys.

Sample usage:

```javascript
var bitcore = require('bitcore');
var HDPrivateKey = bitcore.HDPrivateKey;

var hdPrivateKey = new HDPrivateKey();
var retrieved = new HDPrivateKey('xpriv...');
var derived = hdPrivateKey.derive("m/0'"); // see deprecation warning for derive
var derivedByNumber = hdPrivateKey.derive(1).derive(2, true);
var derivedByArgument = hdPrivateKey.derive("m/1/2'");
assert(derivedByNumber.xprivkey === derivedByArgument.xprivkey);

var address = derived.privateKey.toAddress();

// obtain HDPublicKey
var hdPublicKey = hdPrivateKey.hdPublicKey;
```

## HDPublicKey
An instance of a PublicKey that can be derived to build extended public keys. Note that hardened paths are not available when deriving an HDPublicKey.

```javascript
var hdPrivateKey = new HDPrivateKey();
var hdPublicKey = hdPrivateKey.hdPublicKey;
try {
  new HDPublicKey();
} catch(e) {
  console.log("Can't generate a public key without a private key");
}

var address = new Address(hdPublicKey.publicKey, Networks.livenet);
var derivedAddress = new Address(hdPublicKey.derive(100).publicKey, Networks.testnet); // see deprecation warning for derive
```

## Deprecation Warning for `HDPublicKey.derive()` and `HDPrivateKey.derive()`


There was a bug that was discovered with derivation that would incorrectly calculate the child key against the [BIP32 specification](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki).
The bug only affected hardened derivations using an extended private key, and did not affect public key derivation. It also did not affect every derivation and would happen 1 in 256 times where where the private key for the extended private key had a leading zero *(e.g. any private key less than or equal to '0fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')*. The leading zero was not included in serialization before hashing to derive a child key, as it should have been.

As a result, `HDPublicKey.derive()` and `HDPrivateKey.derive()` are now deprecated. These methods will throw an error in the next major release.
`HDPublicKey.deriveChild()`, `HDPrivateKey.deriveChild()`, and `HDPrivateKey.deriveNonCompliantChild()` have been implemented as alternatives. Note that these new methods will not be officially supported until v1.0.0.  `deriveNonCompliantChild` will derive using the non-BIP32 derivation and is equivalent to the buggy version, `derive`. The `deriveNonCompliantChild` method should not be used unless you're upgrading and need to maintain compatibility with the old derivation.
