title: Bitcore Examples
description: Sample code for the most common task in any bitcoin application.
---
# Examples

## Create a Private Key

```
var privKey = new bitcore.PrivateKey();
```

## Create an Address
```
var privKey = new bitcore.PrivateKey();
var address = privKey.toAddress();
```

## Create a Multisig Address
```
// Build a 2-of-3 address from public keys
var P2SHAddress = new bitcore.Address([publicKey1, publicKey2, publicKey3], 2);
```

## Request a Payment
```
var paymentInfo = {
  address: '1DNtTk4PUCGAdiNETAzQFWZiy2fCHtGnPx',
  amount: 120000 //satoshis
};
var uri = new bitcore.URI(paymentInfo).toString();
```

## Create a Transaction
```
var transaction = new Transaction()
    .from(utxos)          // Feed information about what unspend outputs one can use
    .to(address, amount)  // Add an output with the given amount of satoshis
    .change(address)      // Sets up a change address where the rest of the funds will go
    .sign(privkeySet)     // Signs all the inputs it can
```

## Connect to the Network
```
var peer = new Peer('5.9.85.34');

peer.on('inv', function(message) {
  // new invetory
});

peer.connect();
```
