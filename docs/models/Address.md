# > `bitcore.Address`

## Description

Represents a bitcoin Address. Addresses became the most popular way to make bitcoin transactions. See [the official Bitcoin Wiki](https://en.bitcoin.it/wiki/Address) for more information.

## Instantiate an Address

To be able to receive bitcoins an address is needed, but in order to spend them a private key is necessary. Take a look at the [`PrivateKey`](PrivateKey.md) docs for more information about exporting and saving a key.  

```javascript
var privateKey = new PrivateKey();
var address = privateKey.toAddress();
```

You can also instantiate an address from a String, [PublicKey](PublicKey.md), or [HDPublicKey](Hierarchical.md), in case you are not the owner of the private key.

```javascript
// from a string
var address = Address.fromString('mwkXG8NnB2snbqWTcpNiK6qqGHm1LebHDc');

// a default network address from a public key
var publicKey = PublicKey(privateKey);
var address = new Address(publicKey);
// alternative interface
var address = Address.fromPublicKey(publicKey);

// a testnet address from a public key
var publicKey = new PublicKey(privateKey);
var address = new Address(publicKey, Networks.testnet);
```

## Validating an Address

The main use that we expect you'll have for the `Address` class in bitcore is validating that an address is a valid one, what type of address it is (you may be interested on knowing if the address is a simple "pay to public key hash" address or a "pay to script hash" address) and what network does the address belong to.

The code to do these validations looks like this:

```javascript
// validate an address
if (Address.isValid(input){
  ...
}

// validate that an input field is a valid testnet address
if (Address.isValid(input, Networks.testnet){
  ...
}

// validate that an input field is a valid livenet pubkeyhash
if (Address.isValid(input, Networks.livenet, Address.Pay2PubKeyHash){
  ...
}

// get the specific validation error that can occurred
var error = Address.getValidationError(input, Networks.testnet);
  if (error) {
    // handle the error
  }
}
```

The errors are listed in the generated file in the [errors folder](https://github.com/bitpay/bitcore/tree/master/lib/errors). There's a structure to errors defined in the [spec.js file](https://github.com/bitpay/bitcore/tree/master/lib/errors/spec.js).
