# > `bitcore-ecies`

## Description

Bitcore implements [Elliptic Curve Integrated Encryption Scheme (ECIES)](http://en.wikipedia.org/wiki/Integrated_Encryption_Scheme), which is a public key encryption system that performs bulk encryption on data usinc a symmetric cipher and a random key.

For more information refer to the [bitcore-ecies](https://github.com/bitpay/bitcore-ecies) github repo.

## Instalation

ECIES is implemented as a separate module and you must add it to your dependencies:

```
npm install bitcore-ecies --save
```

```
bower install bitcore-ecies --save
```

## Example

```
var bitcore = require('bitcore');
var ECIES = require('bitcore-ecies');

var alicePrivateKey = new bitcore.PrivateKey();
var bobPrivateKey = new bitcore.PrivateKey();

var data = new Buffer('The is a raw data example');

// Encrypt data
var cypher1 = ECIES.privateKey(alicePrivateKey).publicKey(bobPrivateKey.publicKey);
var encrypted = cypher.encrypt(data);

// Decrypt data
var cypher2 = ECIES.privateKey(bobPrivateKey).publicKey(alicePrivateKey.publicKey);
var decrypted = cypher.decrypt(encrypted);

assert(data.toString(), decrypted.toString());
```
