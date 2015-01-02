# Bitcore v0.8

## Principles

Bitcoin is a powerful new peer-to-peer platform for the next generation of financial technology. The decentralized nature of the Bitcoin network allows for highly resilient bitcoin infrastructure, and the developer community needs reliable, open-source tools to implement bitcoin apps and services. Bitcore provides a reliable API for javascript apps that need to interface with Bitcoin.

To get started, just `npm install bitcore` or `bower install bitcore`.

# Documentation Index

## Addresses and Key Management

* [Addresses](address.md)
* [Using different networks](networks.md)
* [Private Keys](privatekey.md) and [Public Keys](publickey.md)
* [Hierarchically-derived Private and Public Keys](hierarchical.md)

## Payment handling
* [Using different Units](unit.md)
* [Acknowledging and Requesting payments: Bitcoin URIs](uri.md)
* [Payment Protocol Support](paymentprotocol.md)
* [The Transaction Class](transaction.md)

## Bitcoin internals
* [Scripts](script.md)
* [Block](block.md)

## Networking
* [Interface to the Bitcoin P2P network](peer.md)
* [Managing a pool of peers](pool.md)
* [Connecting to a bitcoind instance through JSON-RPC](jsonrpc.md)
* [Connecting to a Insight instance to retrieve informetion](insight.md)

## Extra
* [Crypto](crypto.md)
* [Encoding](encoding.md)
* [ECIES](ecies.md)

## Module Development
* [Browser Builds](browser.md)

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
    .from(utxos)          // Feed information about what unspent outputs one can use
    .to(address, amount)  // Add an output with the given amount of satoshis
    .change(address)      // Sets up a change address where the rest of the funds will go
    .sign(privkeySet)     // Signs all the inputs it can
```

## Connect to the Network
```
var peer = new Peer('5.9.85.34');

peer.on('inv', function(message) {
  // new inventory
});

peer.connect();
```
