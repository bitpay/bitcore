# bitcore-wallet-client

[![NPM Package](https://img.shields.io/npm/v/bitcore-wallet-client.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-wallet-client)
[![Build Status](https://img.shields.io/travis/bitpay/bitcore-wallet-client.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-wallet-client) 
[![Coverage Status](https://coveralls.io/repos/bitpay/bitcore-wallet-client/badge.svg)](https://coveralls.io/r/bitpay/bitcore-wallet-client)

The *official* client library for [bitcore-wallet-service] (https://github.com/bitpay/bitcore-wallet-service). 

## Description

This package communicates with BWS [Bitcore wallet service](https://github.com/bitpay/bitcore-wallet-service) using the REST API. All REST endpoints are wrapped as simple async methods. All relevant responses from BWS are checked independently by the peers, thus the importance of using this library when talking to a third party BWS instance.

See [Bitcore-wallet] (https://github.com/bitpay/bitcore-wallet) for a simple CLI wallet implementation that relays on BWS and uses bitcore-wallet-client.

## Get Started

You can start using bitcore-wallet-client in any of these two ways:

* via [Bower](http://bower.io/): by running `bower install bitcore-wallet-client` from your console
* or via [NPM](https://www.npmjs.com/package/bitcore-wallet-client): by running `npm install bitcore-wallet-client` from your console.

## Example

Start your own local [Bitcore wallet service](https://github.com/bitpay/bitcore-wallet-service) instance. In this example we assume you have `bitcore-wallet-service` running on your `localhost:3232`.

Then create two files `irene.js` and `thomas.js` with the content below:

**irene.js**

``` javascript
var Client = require('bitcore-wallet-client');
var fs = require('fs');
var BWS_INSTANCE_URL = 'http://localhost:3232/bws/api'

var client = new Client({
  baseUrl: BWS_INSTANCE_URL,
  verbose: false,
});

client.createWallet("My Wallet", "Irene", 2, 2, {network: 'testnet'}, function(err, secret) {
  // Handle err
  console.log('Wallet Created. Share this secret with your copayers: ' + secret);
  fs.writeFileSync('irene.dat', client.export());
});
```

**thomas.js**

``` javascript
var Client = require('bitcore-wallet-client');
var fs = require('fs');
var BWS_INSTANCE_URL = 'http://localhost:3232/bws/api'
var secret = process.argv[2];

var client = new Client({
  baseUrl: BWS_INSTANCE_URL,
  verbose: false,
});

client.joinWallet(secret,  "Thomas", function(err, wallet) {
  // Handle err
  console.log('Joined ' + wallet.name + '!');
  fs.writeFileSync('thomas.dat', client.export());
});
```

Install `bitcore-wallet-client` before start:

```
npm i bitcore-wallet-client
```

Create a new wallet with the first script:

```
$ node irene.js
info Generating new keys 
 Wallet Created. Share this secret with your copayers: JbTDjtUkvWS4c3mgAtJf4zKyRGzdQzZacfx2S7gRqPLcbeAWaSDEnazFJF6mKbzBvY1ZRwZCbvT
```

Join to this wallet with generated secret:

```
$ node thomas.js JbTDjtUkvWS4c3mgAtJf4zKyRGzdQzZacfx2S7gRqPLcbeAWaSDEnazFJF6mKbzBvY1ZRwZCbvT
Joined My Wallet!
```

Note that the scripts created two files named `irene.dat` and `thomas.dat`. With these files you can get status, generate addresses, create proposals, sign transactions, etc.

## API Client

* [new API(opts)](#new_API)
* [api.seedFromExtendedPrivateKey(xPrivKey)](#API#seedFromExtendedPrivateKey)
* [api.seedFromRandom(xPrivKey)](#API#seedFromRandom)
* [api.export(opts)](#API#export)
* [api.import(opts)](#API#import)
* [api.isComplete()](#API#isComplete)
* [api.openWallet(cb)](#API#openWallet)
* [api.createWallet(walletName, copayerName, m, n, opts, cb)](#API#createWallet)
* [api.joinWallet(secret, copayerName, cb)](#API#joinWallet)
* [api.getStatus(cb)](#API#getStatus)
* [api.sendTxProposal(opts)](#API#sendTxProposal)
* [api.getTx(id, cb)](#API#getTx)
* [api.createAddress(cb)](#API#createAddress)
* [api.getMainAddresses(opts, cb)](#API#getMainAddresses)
* [api.getBalance(cb)](#API#getBalance)
* [api.getTxProposals(opts)](#API#getTxProposals)
* [api.signTxProposal(txp, cb)](#API#signTxProposal)
* [api.rejectTxProposal(txp, reason, cb)](#API#rejectTxProposal)
* [api.broadcastTxProposal(txp, cb)](#API#broadcastTxProposal)
* [api.removeTxProposal(txp, cb)](#API#removeTxProposal)
* [api.getTxHistory(opts, cb)](#API#getTxHistory)
* [api.setPrivateKeyEncryption(password, opts)](#API#getTxHistory)
* [api.unlock(password)](#API#unlock)
* [api.lock()](#API#lock)
* [api.getUtxos()](#API#getUtxos)

<a name="new_API"></a>
###new API(opts)
ClientAPI constructor.

**Params**

- opts `Object`  

<a name="API#seedFromExtendedPrivateKey"></a>
###API.seedFromExtendedPrivateKey(xPrivKey)
Seed from extended private key

**Params**

- xPrivKey `String`  

<a name="API#seedFromRandom"></a>
###API.seedFromRandom(xPrivKey)
Seed from random

**Params**

- network `String`  

<a name="API#export"></a>
###API.export(opts)
Export wallet

**Params**

- opts `Object`  
  - compressed `Boolean`  
  - noSign `Boolean`  

<a name="API#import"></a>
###API.import(opts)
Import wallet

**Params**

- opts `Object`  
  - compressed `Boolean`  

<a name="API#isComplete"></a>
###API.isComplete()
Return if wallet is complete

<a name="API#openWallet"></a>
###API.openWallet(cb)
Open a wallet and try to complete the public key ring.

**Params**

- cb `Callback`  

**Returns**: `Callback` - cb - Returns an error and a flag indicating that the wallet has just been completed and needs to be persisted  
<a name="API#createWallet"></a>
###API.createWallet(walletName, copayerName, m, n, network, cb)
Create a wallet.

**Params**

- walletName `String`  
- copayerName `String`  
- m `Number`  
- n `Number`  
- opts `Object`
- opts.network `String` - 'livenet' or 'testnet'  
- opts.walletPrivKey `String` - Optional: Shared private key for the wallet (used by copayers). Default: create a random one
- opts.id `String` - Optional: ID for the wallet. Default: Create a random one
- cb `Callback`  

**Returns**: `Callback` - cb - Returns the wallet  
<a name="API#joinWallet"></a>
###API.joinWallet(secret, copayerName, cb)
Join to an existent wallet

**Params**

- secret `String`  
- copayerName `String`  
- cb `Callback`  

**Returns**: `Callback` - cb - Returns the wallet  
<a name="API#getStatus"></a>
###API.getStatus(cb)
Get status of the wallet

**Params**

- cb `Callback`  

**Returns**: `Callback` - cb - Returns error or an object with status information  
<a name="API#sendTxProposal"></a>
###API.sendTxProposal(opts)
Send a transaction proposal

**Params**

For a proposal with one output:

- opts `Object`
  - toAddress `String`
  - amount `Number`
  - message `String`

For a proposal with multiple outputs:

- opts `Object`
  - outputs `Array`
    - toAddress `String`
    - amount `Number`
    - message `String`

**Returns**: `Callback` - cb - Return error or the transaction proposal  
<a name="API#createAddress"></a>

<a name="API#getTx"></a>
###API.getTx(id, cb)
Gets a transaction proposal

**Params**

  - id `String`  

**Returns**: `Callback` - cb - Return error or the transaction proposal  
<a name="API#createAddress"></a>

###API.createAddress(cb)
Create a new address

**Params**

- cb `Callback`  

**Returns**: `Callback` - cb - Return error or the address  
<a name="API#getMainAddresses"></a>
###API.getMainAddresses(opts, cb)
Get your main addresses

**Params**

- opts `Object`  
  - doNotVerify `Boolean`  
- cb `Callback`  

**Returns**: `Callback` - cb - Return error or the array of addresses  
<a name="API#getBalance"></a>
###API.getBalance(cb)
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
<a name="API#signTxProposal"></a>
###API.signTxProposal(txp, cb)
Sign a transaction proposal

**Params**

- txp `Object`  
- cb `Callback`  

**Returns**: `Callback` - cb - Return error or object  
<a name="API#signTxProposalFromAirgapped"></a>
###API.signTxProposalFromAirGapped(txp, encryptedPkr, m, n)
Sign a transaction proposal from an airgapped device

**Params**

- txp `Object`  
- encryptedPkr `String`
- m `Number`
- n `Number`
- cb `Callback`  

**Returns**: `Callback` - cb - Return error or object  
<a name="API#rejectTxProposal"></a>
###API.rejectTxProposal(txp, reason, cb)
Reject a transaction proposal

**Params**

- txp `Object`  
- reason `String`  
- cb `Callback`  

**Returns**: `Callback` - cb - Return error or object  
<a name="API#broadcastTxProposal"></a>
###API.broadcastTxProposal(txp, cb)
Broadcast a transaction proposal

**Params**

- txp `Object`  
- cb `Callback`  

**Returns**: `Callback` - cb - Return error or object  
<a name="API#removeTxProposal"></a>
###API.removeTxProposal(txp, cb)
Remove a transaction proposal

**Params**

- txp `Object`  
- cb `Callback`  

**Returns**: `Callback` - cb - Return error or empty  
<a name="API#getTxHistory"></a>
###API.getTxHistory(opts, cb)
Get transaction history

**Params**

- opts `Object`  
  - skip `Number`  
  - limit `Number`  
- cb `Callback`  

**Returns**: `Callback` - cb - Return error or array of transactions

###API.setPrivateKeyEncryption(password, opts)

Sets up encryption for the extended private key

**params**

- password `string`  
- opts `Object`  Optional SJCL's encrypting options (like .iten and .salt) 

Usage example:    
``` javascript
  api.setPrivateKeyEncryption('mypassword');
  ...
  api.getTxProposals({}, function(err, txps) {
    api.unlock('mypassword');
    api.signTxProposal(txps[0], function (err){
      api.lock();
    });
  })
```


###api.unlock(password)

Tries to unlock (decrypt) the extened private key with the provided password.
(setprivatekeyencryption should be called first). `lock` must be called
afterwards to remove the uncrypted private key.

**params**

- password `string`  


###api.unlock()

Removes the unencrypted private key.

###api.getUtxos()
<a name="API#getUtxos"></a>
Get list of wallet's Unspent Transaction Outputs.
