# Address

Represents a bitcoin Address. Addresses became the most popular way to make
bitcoin transactions. See [the official Bitcoin
Wiki](https://en.bitcoin.it/wiki/Address) for more information.

The main use that we expect you'll have for the `Address` class in bitcore is
validating that an address is a valid one, what type of address it is (you may
be interested on knowning if the address is a simple "pay to public key hash"
address or a "pay to script hash" address) and what network does the address
belong to.

The code to do these validations looks like this:

```javascript
var address = new bitcore.Address('1BitcoinAddress...');
assert(address.network === bitcore.network.livenet);
// Detect the kind of the address...
assert(address.scriptType === bitcore.Address.Pay2PubKeyHash);
```

There are also static methods for this that work very similarly:

```javascript
var address = new bitcore.Address();
assert(bitcore.Address.isValid('1BitcoinAddress...'));
assert(bitcore.Address.network('1BitcoinAddress...') === bitcore.network.livenet);
assert(bitcore.Address.scriptType('1BitcoinAddress...') !== bitcore.Address.Pay2ScriptHash);
assert(bitcore.Address.scriptType('3MultisigP2SH...') === bitcore.Address.Pay2ScriptHash);
```
