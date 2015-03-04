
# bitcore-wallet-client

[![Build Status](https://img.shields.io/travis/bitpay/bitcore-wallet-client.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-wallet-client) 
[![Coverage Status](https://coveralls.io/repos/bitpay/bitcore-wallet-client/badge.svg)](https://coveralls.io/r/bitpay/bitcore-wallet-client)


The *official* client library for [bitcore-wallet-service] (https://github.com/bitpay/bitcore-wallet-service). 

# Description

This package communicated to BWS (Bitcore wallet service) using its REST API. All REST endpoints are wrapped on simple async call. All relevant responses from BWS are checked independently by the peers, thus the importance of using this library with talking with a third party BWS instance.

See [Bitcore-wallet] (https://github.com/bitpay/bitcore-wallet) for a simple CLI wallet implementation that relays on BWS and uses bitcore-wallet-client.


# Quick Start

``` javascript
  var client = new Client({
    baseUrl: bws_instance_url,
    verbose: true,
  });

 client.createWallet("my Wallet", "Irene", 2, 3, 'testnet', function(err, secret) {
    // Handle err
    console.log(' Wallet Created. Share this secret with your copayers:' + secret);
    fs.writeFileSync('wallet.dat', client.export());
 });
 
 // Then, from other Copayer
 
   var client = new Client({
    baseUrl: bws_instance_url,
    verbose: true,
  });

 client.joinWallet(secret,  "Thomas", function(err, secret) {
    // Handle err
    console.log(' Wallet Joined!);
    fs.writeFileSync('wallet.dat', client.export());
 });
 
```

# API Client

* [class: API](#API)
  * [new API(opts)](#new_API)
  * [API.seedFromExtendedPrivateKey(xPrivKey)](#API#seedFromExtendedPrivateKey)
  * [API.seedFromAirGapped(xPrivKey)](#API#seedFromAirGapped)
  * [ApI.export(opts)](#API#export)
  * [ApI.import(opts)](#API#import)
  * [ApI.toString()](#API#toString)
  * [ApI.fromString(str)](#API#fromString)
  * [ApI._doRequest(method, url, args, cb)](#API#_doRequest)
  * [ApI._doPostRequest(url, args, cb)](#API#_doPostRequest)
  * [ApI._doGetRequest(url, cb)](#API#_doGetRequest)
  * [API._doDeleteRequest(url, cb)](#API#_doDeleteRequest)
  * [API._doJoinWallet(walletId, walletPrivKey, xPubKey, copayerName, cb)](#API#_doJoinWallet)
  * [API.isComplete()](#API#isComplete)
  * [API.openWallet(cb)](#API#openWallet)
  * [API.createWallet(walletName, copayerName, m, n, network, cb)](#API#createWallet)
  * [API.joinWallet(secret, copayerName, cb)](#API#joinWallet)
  * [API.getStatus(cb)](#API#getStatus)
  * [API.sendTxProposal(opts)](#API#sendTxProposal)
  * [API.createAddress(cb)](#API#createAddress)
  * [API.getMainAddresses(opts, cb)](#API#getMainAddresses)
  * [API.getBalance(cb)](#API#getBalance)
  * [API.getTxProposals(opts)](#API#getTxProposals)
  * [API.getSignatures(opts)](#API#getSignatures)
  * [API.signTxProposal(txp, cb)](#API#signTxProposal)
  * [API.rejectTxProposal(txp, reason, cb)](#API#rejectTxProposal)
  * [API.broadcastTxProposal(txp, cb)](#API#broadcastTxProposal)
  * [API.removeTxProposal(txp, cb)](#API#removeTxProposal)
  * [API.getTxHistory(opts, cb)](#API#getTxHistory)

<a name="new_API"></a>
##new API(opts)
ClientAPI constructor.

**Params**

- opts `Object`  

<a name="API#seedFromExtendedPrivateKey"></a>
##API.seedFromExtendedPrivateKey(xPrivKey)
Seed from extended private key

**Params**

- xPrivKey `String`  

<a name="API#seedFromAirGapped"></a>
##API.seedFromAirGapped(xPrivKey)
Seed from extended private key

**Params**

- xPrivKey `String`  

<a name="API#export"></a>
##API.export(opts)
Export wallet

**Params**

- opts `Object`  
  - compressed `Boolean`  
  - password `String`  

<a name="API#import"></a>
##API.import(opts)
Import wallet

**Params**

- opts `Object`  
  - compressed `Boolean`  
  - password `String`  

<a name="API#toString"></a>
##API.toString()
Return a serialized object with credentials

<a name="API#fromString"></a>
##API.fromString(str)
Get credentials from an object

**Params**

- str `Object`  

<a name="API#_doRequest"></a>
##API._doRequest(method, url, args, cb)
Do a request

**Params**

- method `Object`  
- url `String`  
- args `Object`  
- cb `Callback`  

<a name="API#_doPostRequest"></a>
##API._doPostRequest(url, args, cb)
Post a request

**Params**

- url `String`  
- args `Object`  
- cb `Callback`  

<a name="API#_doGetRequest"></a>
##API._doGetRequest(url, cb)
Get a request

**Params**

- url `String`  
- cb `Callback`  

<a name="API#_doDeleteRequest"></a>
##API._doDeleteRequest(url, cb)
Delete a request

**Params**

- url `String`  
- cb `Callback`  

<a name="API#_doJoinWallet"></a>
##API._doJoinWallet(walletId, walletPrivKey, xPubKey, copayerName, cb)
Join

**Params**

- walletId `String`  
- walletPrivKey `String`  
- xPubKey `String`  
- copayerName `String`  
- cb `Callback`  

<a name="API#isComplete"></a>
##API.isComplete()
Return if wallet is complete

<a name="API#openWallet"></a>
##API.openWallet(cb)
Opens a wallet and tries to complete the public key ring.

**Params**

- cb `Callback`  

**Returns**: `Callback` - cb - Returns an error and a flag indicating that the wallet has just been completed and needs to be persisted  
<a name="API#createWallet"></a>
##API.createWallet(walletName, copayerName, m, n, network, cb)
Create a wallet.

**Params**

- walletName `String`  
- copayerName `String`  
- m `Number`  
- n `Number`  
- network `String` - 'livenet' or 'testnet'  
- cb `Callback`  

**Returns**: `Callback` - cb - Returns the wallet  
<a name="API#joinWallet"></a>
##API.joinWallet(secret, copayerName, cb)
Join to an existent wallet

**Params**

- secret `String`  
- copayerName `String`  
- cb `Callback`  

**Returns**: `Callback` - cb - Returns the wallet  
<a name="API#getStatus"></a>
##API.getStatus(cb)
Get status of the wallet

**Params**

- cb `Callback`  

**Returns**: `Callback` - cb - Returns error or an object with status information  
<a name="API#sendTxProposal"></a>
##API.sendTxProposal(opts)
Send a transaction proposal

**Params**

- opts `Object`  
  - toAddress `String`  
  - amount `Number`  
  - message `String`  

**Returns**: `Callback` - cb - Return error or the transaction proposal  
<a name="API#createAddress"></a>
##API.createAddress(cb)
Create a new address

**Params**

- cb `Callback`  

**Returns**: `Callback` - cb - Return error or the address  
<a name="API#getMainAddresses"></a>
##API.getMainAddresses(opts, cb)
Get your main addresses

**Params**

- opts `Object`  
  - doNotVerify `Boolean`  
- cb `Callback`  

**Returns**: `Callback` - cb - Return error or the array of addresses  
<a name="API#getBalance"></a>
##API.getBalance(cb)
Update wallet balance

**Params**

- cb `Callback`  

<a name="API#getTxProposals"></a>
##API.getTxProposals(opts)
Get list of transactions proposals

**Params**

- opts `Object`  
  - doNotVerify `Boolean`  
  - forAirGapped `Boolean`  

**Returns**: `Callback` - cb - Return error or array of transactions proposals  
<a name="API#getSignatures"></a>
##API.getSignatures(opts)
Get list of transactions proposals

**Params**

- opts `Object`  
  - doNotVerify `Boolean`  
  - forAirGapped `Boolean`  

**Returns**: `Callback` - cb - Return error or array of transactions proposals  
<a name="API#signTxProposal"></a>
##API.signTxProposal(txp, cb)
Sign a transaction proposal

**Params**

- txp `Object`  
- cb `Callback`  

**Returns**: `Callback` - cb - Return error or object  
<a name="API#rejectTxProposal"></a>
##API.rejectTxProposal(txp, reason, cb)
Reject a transaction proposal

**Params**

- txp `Object`  
- reason `String`  
- cb `Callback`  

**Returns**: `Callback` - cb - Return error or object  
<a name="API#broadcastTxProposal"></a>
##API.broadcastTxProposal(txp, cb)
Broadcast a transaction proposal

**Params**

- txp `Object`  
- cb `Callback`  

**Returns**: `Callback` - cb - Return error or object  
<a name="API#removeTxProposal"></a>
##API.removeTxProposal(txp, cb)
Remove a transaction proposal

**Params**

- txp `Object`  
- cb `Callback`  

**Returns**: `Callback` - cb - Return error or empty  
<a name="API#getTxHistory"></a>
##API.getTxHistory(opts, cb)
Get transaction history

**Params**

- opts `Object`  
- cb `Callback`  

**Returns**: `Callback` - cb - Return error or array of transactions

