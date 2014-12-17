# > `bitcore.Networks`

## Description

Bitcore provides support for both the main bitcoin network as well as for `testnet3`, the current test blockchain. We encourage the use of `Networks.livenet` and `Networks.testnet` as constants. Note that the library sometimes may check for equality against this object. Avoid creating a deep copy of this object and using that.

The `Network` namespace has a function, `get(...)` that returns an instance of a `Network` or `undefined`. The only argument to this function is some kind of identifier of the network: either its name, a reference to a Network object, or a number used as a magic constant to identify the network (for example, the value `0` that gives bitcoin addresses the distinctive `'1'` at its beginning on livenet, is a `0x6F` for testnet).

## Setting the default network

Most project will only need to work in one of either networks. The value of `Networks.defaultNetwork` can be set to `Networks.testnet` if the project will needs only to work on testnet (the default is `Networks.livenet`).

## Network constants

The functionality of testnet and livenet is mostly similar (except for some relaxed block validation rules on testnet). They differ in the constants being used for human representation of base58 encoded strings. These are sometimes referred to as "version" constants.

Take a look at this modified snippet from [networks.js](https://github.com/bitpay/bitcore/blob/master/lib/networks.js)
```javascript
var livenet = new Network();
_.extend(livenet, {
  name: 'livenet',
  alias: 'mainnet',
  pubkeyhash: 0x00,
  privatekey: 0x80,
  scripthash: 0x05,
  xpubkey:  0x0488b21e,
  xprivkey: 0x0488ade4,
  port: 8333
});

var testnet = new Network();
_.extend(testnet, {
  name: 'testnet',
  alias: 'testnet',
  pubkeyhash: 0x6f,
  privatekey: 0xef,
  scripthash: 0xc4,
  xpubkey: 0x043587cf,
  xprivkey: 0x04358394,
  port: 18333
});
```
