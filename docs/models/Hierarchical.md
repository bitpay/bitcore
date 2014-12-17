# > `bitcore.HDKeys`

## Hierarichically Derived Keys

Bitcore provides full support for [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki), allowing for many key management schemas that benefit from this property.  Please be sure to read and understand the basic concepts and the warnings on that BIP before using these classes.

## HDPrivateKey

An instance of a [PrivateKey](PrivateKey.md) that also contains information required to derive child keys.

Sample usage:

```javascript
var hdPrivateKey = new HDPrivateKey();
var retrieved = new HDPrivateKey('xpriv...');
var derived = privateKey.derive("m/0'");
var derivedByNumber = privateKey.derive(1).derive(2, true);
var derivedByArgument = privateKey.derive("m/1/2'");
assert(derivedByNumber.xprivkey === derivedByArgument.xprivkey);

var address = new Address(privateKey.publicKey, Networks.livenet);
var redeem = new Transaction().from(output).to(target, 10000).sign(derived.privateKey);
```

## HDPublicKey

An instance of a PublicKey that can be derived to build extended public keys. Note that hardened paths are not available when deriving an HDPublicKey.

```javascript
var hdPrivateKey = new HDPrivateKey();
var hdPublicKey = privateKey.hdPublicKey;
try {
  new HDPublicKey();
} catch(e) {
  console.log("Can't generate a public key without a private key");
}

var address = new Address(hdPublicKey.publicKey, Networks.livenet);
var derivedAddress = new Address(hdPublicKey.derive(100).publicKey, Networks.testnet);
```
