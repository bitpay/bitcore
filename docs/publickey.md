---
title: Public Key
description: A simple interface for handling private keys.
---
# Public Key

## Description

Represents a bitcoin public key and is needed to be able to receive bitcoin, as is usually represented as a bitcoin [Address](address.md), see the official [Bitcoin Wiki](https://en.bitcoin.it/wiki/Technical_background_of_version_1_Bitcoin_addresses). A PublicKey in Bitcore is an immutable object and can be instantiated from a [Point](crypto.md), string, [PrivateKey](privatekey.md), Buffer and a [BN](crypto.md).

## Instantiate a Public Key

Here is how to instantiate a public key:

```javascript

var privateKey = new PrivateKey();

// from a private key
var publicKey = new PublicKey(privateKey);

// from a der hex encoded string
var publicKey2 = new PublicKey('02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc');

```

## Validating a Public Key

A public key point should be on the [secp256k1](https://en.bitcoin.it/wiki/Secp256k1) curve, instantiating a new PublicKey will validate this and will throw an error if it's invalid. To check that a public key is valid:

```javascript
if (PublicKey.isValid('02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc')){
  // valid public key
}
```

Note: It's important to note that there are two possible ways to represent public key, the standard is *compressed* and includes the x value and parity (as represented above in the documentation). There is also a longer version that is *uncompressed* which includes both x and y values, and using this can generate a different bitcoin address, so it's important to note this possibility, however it's discouraged to be used.
