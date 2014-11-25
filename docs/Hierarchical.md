# Hierarichically Derived Keys

Bitcore provides full support for
[BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki),
allowing for many key management schemas that benefit from this property.
Please be sure to read and understand the basic concepts and the warnings on
that BIP before using these classes.

## HDPrivateKey

This class initially meant to share the interface of
[PrivateKey](http://missing-link) but add the ability to derive new keys.
