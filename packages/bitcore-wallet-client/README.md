# bitcore-wallet-client

[![NPM Package](https://img.shields.io/npm/v/bitcore-wallet-client.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-wallet-client)
[![Build Status](https://img.shields.io/travis/bitpay/bitcore-wallet-client.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-wallet-client)
[![Coverage Status](https://coveralls.io/repos/bitpay/bitcore-wallet-client/badge.svg)](https://coveralls.io/r/bitpay/bitcore-wallet-client)

The *official* client library for [bitcore-wallet-service](https://github.com/bitpay/bitcore-wallet-service).

## Description

This package communicates with BWS [Bitcore wallet service](https://github.com/bitpay/bitcore-wallet-service) using the REST API. All REST endpoints are wrapped as simple async methods. All relevant responses from BWS are checked independently by the peers, thus the importance of using this library when talking to a third party BWS instance.

See [Bitcore-wallet](https://github.com/bitpay/bitcore-wallet) for a simple CLI wallet implementation that relays on BWS and uses bitcore-wallet-client.

## Get Started

You can start using bitcore-wallet-client in any of these two ways:

* via [Bower](http://bower.io/): by running `bower install bitcore-wallet-client` from your console
* or via [NPM](https://www.npmjs.com/package/bitcore-wallet-client): by running `npm install bitcore-wallet-client` from your console.

## Example

Start your own local [Bitcore wallet service](https://github.com/bitpay/bitcore-wallet-service) instance. In this example we assume you have `bitcore-wallet-service` running on your `localhost:3232`.

Install `bitcore-wallet-client` before start:

```
npm i bitcore-wallet-client
```

### **Create and join a shared wallet**
---
Create two files `irene.js` and `tomas.js` with the content below:

**irene.js**

``` javascript
var Client = require('bitcore-wallet-client');


var fs = require('fs');
var BWS_INSTANCE_URL = 'https://bws.bitpay.com/bws/api'

var client = new Client({
  baseUrl: BWS_INSTANCE_URL,
  verbose: false,
});

client.createWallet("My Wallet", "Irene", 2, 2, {network: 'testnet'}, function(err, secret) {
  if (err) {
    console.log('error: ',err);
    return
  };
  // Handle err
  console.log('Wallet Created. Share this secret with your copayers: ' + secret);
  fs.writeFileSync('irene.dat', client.export());
});
```

**tomas.js**

``` javascript

var Client = require('bitcore-wallet-client');


var fs = require('fs');
var BWS_INSTANCE_URL = 'https://bws.bitpay.com/bws/api'

var secret = process.argv[2];
if (!secret) {
  console.log('./tomas.js <Secret>')

  process.exit(0);
}

var client = new Client({
  baseUrl: BWS_INSTANCE_URL,
  verbose: false,
});

client.joinWallet(secret, "Tomas", {}, function(err, wallet) {
  if (err) {
    console.log('error: ', err);
    return
  };

  console.log('Joined ' + wallet.name + '!');
  fs.writeFileSync('tomas.dat', client.export());


  client.openWallet(function(err, ret) {
    if (err) {
      console.log('error: ', err);
      return
    };
    console.log('\n\n** Wallet Info', ret); //TODO

    console.log('\n\nCreating first address:', ret); //TODO
    if (ret.wallet.status == 'complete') {
      client.createAddress({}, function(err,addr){
        if (err) {
          console.log('error: ', err);
          return;
        };

        console.log('\nReturn:', addr)
      });
    }
  });
});
```

Create a new wallet with the first script:

```
$ node irene.js
info Generating new keys
 Wallet Created. Share this secret with your copayers: JbTDjtUkvWS4c3mgAtJf4zKyRGzdQzZacfx2S7gRqPLcbeAWaSDEnazFJF6mKbzBvY1ZRwZCbvT
```

Join to this wallet with generated secret:

```
$ node tomas.js JbTDjtUkvWS4c3mgAtJf4zKyRGzdQzZacfx2S7gRqPLcbeAWaSDEnazFJF6mKbzBvY1ZRwZCbvT
Joined My Wallet!

Wallet Info: [...]

Creating first address:

Return: [...]

```

Note that the scripts created two files named `irene.dat` and `tomas.dat`. With these files you can get status, generate addresses, create proposals, sign transactions, etc.


### **Open a wallet dat file**
---

``` javascript
var Client = require('bitcore-wallet-client');


var fs = require('fs');
var BWS_INSTANCE_URL = 'https://bws.bitpay.com/bws/api'

var client = new Client({
  baseUrl: BWS_INSTANCE_URL,
  verbose: false,
});

client.import(fs.readFileSync("filename.dat"));
```
Now you can get the balance for the wallet with:

``` javascript
  client.openWallet((err, res) => {
    client.getBalance((err, res) => {
      console.log(res);
    });
  });
```

# Global


* * *

## Class: API
ClientAPI constructor.

### API.setNotificationsInterval(notificationIntervalSeconds)

Reset notification polling with new interval

**Parameters**

**notificationIntervalSeconds**: `Numeric`, use 0 to pause notifications


### API.seedFromRandom(opts, opts.network)

Seed from random

**Parameters**

**opts**: `Object`, Seed from random

**opts.network**: `String`, default 'livenet'


### API.seedFromRandomWithMnemonic(opts, opts.network, opts.passphrase, opts.language, opts.account)

Seed from random with mnemonic

**Parameters**

**opts**: `Object`, Seed from random with mnemonic

**opts.network**: `String`, default 'livenet'

**opts.passphrase**: `String`, Seed from random with mnemonic

**opts.language**: `Number`, default 'en'

**opts.account**: `Number`, default 0


### API.seedFromExtendedPrivateKey(xPrivKey, opts.account, opts.derivationStrategy)

Seed from extended private key

**Parameters**

**xPrivKey**: `String`, Seed from extended private key

**opts.account**: `Number`, default 0

**opts.derivationStrategy**: `String`, default 'BIP44'


### API.seedFromMnemonic(BIP39, opts, opts.network, opts.passphrase, opts.account, opts.derivationStrategy)

Seed from Mnemonics (language autodetected)
Can throw an error if mnemonic is invalid

**Parameters**

**BIP39**: `String`, words

**opts**: `Object`, Seed from Mnemonics (language autodetected)
Can throw an error if mnemonic is invalid

**opts.network**: `String`, default 'livenet'

**opts.passphrase**: `String`, Seed from Mnemonics (language autodetected)
Can throw an error if mnemonic is invalid

**opts.account**: `Number`, default 0

**opts.derivationStrategy**: `String`, default 'BIP44'


### API.seedFromExtendedPublicKey(xPubKey, source, entropySourceHex, opts, opts.account, opts.derivationStrategy)

Seed from external wallet public key

**Parameters**

**xPubKey**: `String`, Seed from external wallet public key

**source**: `String`, A name identifying the source of the xPrivKey (e.g. ledger, TREZOR, ...)

**entropySourceHex**: `String`, A HEX string containing pseudo-random data, that can be deterministically derived from the xPrivKey, and should not be derived from xPubKey.

**opts**: `Object`, Seed from external wallet public key

**opts.account**: `Number`, default 0

**opts.derivationStrategy**: `String`, default 'BIP44'


### API.export(opts, opts.noSign)

Export wallet

**Parameters**

**opts**: `Object`, Export wallet

**opts.noSign**: `Boolean`, Export wallet


### API.import(str, opts, opts.password, opts.skipKeyValidation)

Import wallet
emits 'derivation-error' in case keys are not validated correctly.

**Parameters**

**str**: `Object`, Import wallet
emits 'derivation-error' in case keys are not validated correctly.

**opts**: `Object`, Import wallet
emits 'derivation-error' in case keys are not validated correctly.

**opts.password**: `String`, If the source has the private key encrypted, the password
will be needed for derive credentials fields.

**opts.skipKeyValidation**: `Boolean`, Skip extended key validation


### API.importFromMnemonic(BIP39, opts, opts.network, opts.passphrase, opts.account, opts.derivationStrategy)

Import from Mnemonics (language autodetected)
Can throw an error if mnemonic is invalid

**Parameters**

**BIP39**: `String`, words

**opts**: `Object`, Import from Mnemonics (language autodetected)
Can throw an error if mnemonic is invalid

**opts.network**: `String`, default 'livenet'

**opts.passphrase**: `String`, Import from Mnemonics (language autodetected)
Can throw an error if mnemonic is invalid

**opts.account**: `Number`, default 0

**opts.derivationStrategy**: `String`, default 'BIP44'


### API.importFromExtendedPublicKey(xPubKey, source, entropySourceHex, opts, opts.account, opts.derivationStrategy)

Import from Extended Public Key

**Parameters**

**xPubKey**: `String`, Import from Extended Public Key

**source**: `String`, A name identifying the source of the xPrivKey

**entropySourceHex**: `String`, A HEX string containing pseudo-random data, that can be deterministically derived from the xPrivKey, and should not be derived from xPubKey.

**opts**: `Object`, Import from Extended Public Key

**opts.account**: `Number`, default 0

**opts.derivationStrategy**: `String`, default 'BIP44'


### API.openWallet(cb)

Open a wallet and try to complete the public key ring.

**Parameters**

**cb**: `Callback`, The callback that handles the response. It returns a flag indicating that the wallet is complete.

**Fires**: API#event:walletCompleted


### API.isComplete()

Return if wallet is complete


### API.isPrivKeyEncrypted()

Is private key currently encrypted? (ie, locked)

**Returns**: `Boolean`

### API.hasPrivKeyEncrypted()

Is private key encryption setup?

**Returns**: `Boolean`

### API.isPrivKeyExternal()

Is private key external?

**Returns**: `Boolean`

### API.getPrivKeyExternalSourceName()

Get external wallet source name

**Returns**: `String`

### API.unlock(password)

unlocks the private key. `lock` need to be called explicity
later to remove the unencrypted private key.

**Parameters**

**password**: , unlocks the private key. `lock` need to be called explicity
later to remove the unencrypted private key.


### API.canSign()

Can this credentials sign a transaction?
(Only returns fail on a 'proxy' setup for airgapped operation)

**Returns**: `undefined`

### API.setPrivateKeyEncryption(password, opts)

sets up encryption for the extended private key

**Parameters**

**password**: `String`, Password used to encrypt

**opts**: `Object`, optional: SJCL options to encrypt (.iter, .salt, etc).

**Returns**: `undefined`

### API.disablePrivateKeyEncryption()

disables encryption for private key.
wallet must be unlocked


### API.lock()

Locks private key (removes the unencrypted version and keep only the encrypted)

**Returns**: `undefined`

### API.getFeeLevels(network, cb)

Get current fee levels for the specified network

**Parameters**

**network**: `string`, 'livenet' (default) or 'testnet'

**cb**: `Callback`, Get current fee levels for the specified network

**Returns**: `Callback`, cb - Returns error or an object with status information

### API.getVersion(cb)

Get service version

**Parameters**

**cb**: `Callback`, Get service version


### API.createWallet(walletName, copayerName, m, n, opts, opts.network, opts.walletPrivKey, opts.id, opts.withMnemonics, cb)

Create a wallet.

**Parameters**

**walletName**: `String`, Create a wallet.

**copayerName**: `String`, Create a wallet.

**m**: `Number`, Create a wallet.

**n**: `Number`, Create a wallet.

**opts**: `object`, (optional: advanced options)

**opts.network**: `string`, 'livenet' or 'testnet'

**opts.walletPrivKey**: `String`, set a walletPrivKey (instead of random)

**opts.id**: `String`, set a id for wallet (instead of server given)

**opts.withMnemonics**: `String`, generate credentials

**cb**: , Create a wallet.

**Returns**: `undefined`

### API.joinWallet(secret, copayerName, opts, opts.dryRun[, cb)

Join an existent wallet

**Parameters**

**secret**: `String`, Join an existent wallet

**copayerName**: `String`, Join an existent wallet

**opts**: `Object`, Join an existent wallet

**opts.dryRun[**: `Boolean`, Simulate wallet join

**cb**: `Callback`, Join an existent wallet

**Returns**: `Callback`, cb - Returns the wallet

### API.recreateWallet()

Recreates a wallet, given credentials (with wallet id)

**Returns**: `Callback`, cb - Returns the wallet

### API.getNotifications(opts, lastNotificationId, timeSpan)

Get latest notifications

**Parameters**

**opts**: `object`, Get latest notifications

**lastNotificationId**: `String`, (optional) - The ID of the last received notification

**timeSpan**: `String`, (optional) - A time window on which to look for notifications (in seconds)

**Returns**: `Callback`, cb - Returns error or an array of notifications

### API.getStatus(opts.twoStep[, opts.includeExtendedInfo)

Get status of the wallet

**Parameters**

**opts.twoStep[**: `Boolean`, Optional: use 2-step balance computation for improved performance

**opts.includeExtendedInfo**: `Boolean`, (optional: query extended status)

**Returns**: `Callback`, cb - Returns error or an object with status information

### API.getPreferences(cb)

Get copayer preferences

**Parameters**

**cb**: `Callback`, Get copayer preferences

**Returns**: `Callback`, cb - Return error or object

### API.savePreferences(preferences, cb)

Save copayer preferences

**Parameters**

**preferences**: `Object`, Save copayer preferences

**cb**: `Callback`, Save copayer preferences

**Returns**: `Callback`, cb - Return error or object

### API.fetchPayPro(opts.payProUrl)

fetchPayPro

**Parameters**

**opts.payProUrl**: , URL for paypro request

**Returns**: `Callback`, cb - Return error or the parsed payment protocol request
Returns (err,paypro)
 paypro.amount
 paypro.toAddress
 paypro.memo

### API.getUtxos(cb, opts, opts.addresses)

Gets list of utxos

**Parameters**

**cb**: `function`, Gets list of utxos

**opts**: `Object`, Gets list of utxos

**opts.addresses**: `Array`, (optional) - List of addresses from where to fetch UTXOs.

**Returns**: `Callback`, cb - Return error or the list of utxos

### API.createTxProposal(opts, opts.outputs, opts.outputs[].toAddress, opts.outputs[].amount, opts.outputs[].message, opts.message, opts.fee, opts.feePerKb, opts.changeAddress, opts.payProUrl, opts.excludeUnconfirmedUtxos, opts.customData, opts.inputs, opts.outputs, opts.utxosToExclude)

Create a transaction proposal

**Parameters**

**opts**: `Object`, Create a transaction proposal

**opts.outputs**: `Array`, List of outputs.

**opts.outputs[].toAddress**: `String`, / opts.outputs[].script

**opts.outputs[].amount**: `Number`, Create a transaction proposal

**opts.outputs[].message**: `String`, Create a transaction proposal

**opts.message**: `string`, A message to attach to this transaction.

**opts.fee**: `string`, Optional: Use an alternative fee for this TX (mutually exclusive with feePerKb)

**opts.feePerKb**: `string`, Optional: Use an alternative fee per KB for this TX (mutually exclusive with fee)

**opts.changeAddress**: `string`, Optional. Use this address as the change address for the tx. The address should belong to the wallet.

**opts.payProUrl**: `String`, Optional: Tx is from a payment protocol URL

**opts.excludeUnconfirmedUtxos**: `string`, Optional: Do not use UTXOs of unconfirmed transactions as inputs

**opts.customData**: `Object`, Optional: Arbitrary data to store along with proposal

**opts.inputs**: `Array`, Optional: Inputs to be used in proposal.

**opts.outputs**: `Array`, Optional: Outputs to be used in proposal.

**opts.utxosToExclude**: `Array`, Optional: List of UTXOS (in form of txid:vout string)
       to exclude from coin selection for this proposal

**Returns**: `Callback`, cb - Return error or the transaction proposal

### API.publishTxProposal(opts, opts.txp)

Publish a transaction proposal

**Parameters**

**opts**: `Object`, Publish a transaction proposal

**opts.txp**: `Object`, The transaction proposal object returned by the API#createTxProposal method

**Returns**: `Callback`, cb - Return error or null

### API.createAddress(opts, opts.ignoreMaxGap[, cb)

Create a new address

**Parameters**

**opts**: `Object`, Create a new address

**opts.ignoreMaxGap[**: `Boolean`, Create a new address

**cb**: `Callback`, Create a new address

**Returns**: `Callback`, cb - Return error or the address

### API.getMainAddresses(opts, opts.doNotVerify, opts.limit, opts.reverse, cb)

Get your main addresses

**Parameters**

**opts**: `Object`, Get your main addresses

**opts.doNotVerify**: `Boolean`, Get your main addresses

**opts.limit**: `Numeric`, (optional) - Limit the resultset. Return all addresses by default.

**opts.reverse**: `Boolean`, (optional) - Reverse the order of returned addresses.

**cb**: `Callback`, Get your main addresses

**Returns**: `Callback`, cb - Return error or the array of addresses

### API.getBalance(opts.twoStep[, cb)

Update wallet balance

**Parameters**

**opts.twoStep[**: `Boolean`, Optional: use 2-step balance computation for improved performance

**cb**: `Callback`, Update wallet balance


### API.getTxProposals(opts, opts.doNotVerify, opts.forAirGapped)

Get list of transactions proposals

**Parameters**

**opts**: `Object`, Get list of transactions proposals

**opts.doNotVerify**: `Boolean`, Get list of transactions proposals

**opts.forAirGapped**: `Boolean`, Get list of transactions proposals

**Returns**: `Callback`, cb - Return error or array of transactions proposals

### API.signTxProposal(txp, cb)

Sign a transaction proposal

**Parameters**

**txp**: `Object`, Sign a transaction proposal

**cb**: `Callback`, Sign a transaction proposal

**Returns**: `Callback`, cb - Return error or object

### API.signTxProposalFromAirGapped(txp, encryptedPkr, m, n)

Sign transaction proposal from AirGapped

**Parameters**

**txp**: `Object`, Sign transaction proposal from AirGapped

**encryptedPkr**: `String`, Sign transaction proposal from AirGapped

**m**: `Number`, Sign transaction proposal from AirGapped

**n**: `Number`, Sign transaction proposal from AirGapped

**Returns**: `Object`, txp - Return transaction

### API.rejectTxProposal(txp, reason, cb)

Reject a transaction proposal

**Parameters**

**txp**: `Object`, Reject a transaction proposal

**reason**: `String`, Reject a transaction proposal

**cb**: `Callback`, Reject a transaction proposal

**Returns**: `Callback`, cb - Return error or object

### API.broadcastRawTx(opts, opts.network, opts.rawTx, cb)

Broadcast raw transaction

**Parameters**

**opts**: `Object`, Broadcast raw transaction

**opts.network**: `String`, Broadcast raw transaction

**opts.rawTx**: `String`, Broadcast raw transaction

**cb**: `Callback`, Broadcast raw transaction

**Returns**: `Callback`, cb - Return error or txid

### API.broadcastTxProposal(txp, cb)

Broadcast a transaction proposal

**Parameters**

**txp**: `Object`, Broadcast a transaction proposal

**cb**: `Callback`, Broadcast a transaction proposal

**Returns**: `Callback`, cb - Return error or object

### API.removeTxProposal(txp, cb)

Remove a transaction proposal

**Parameters**

**txp**: `Object`, Remove a transaction proposal

**cb**: `Callback`, Remove a transaction proposal

**Returns**: `Callback`, cb - Return error or empty

### API.getTxHistory(opts, opts.skip, opts.limit, opts.includeExtendedInfo, cb)

Get transaction history

**Parameters**

**opts**: `Object`, Get transaction history

**opts.skip**: `Number`, (defaults to 0)

**opts.limit**: `Number`, Get transaction history

**opts.includeExtendedInfo**: `Boolean`, Get transaction history

**cb**: `Callback`, Get transaction history

**Returns**: `Callback`, cb - Return error or array of transactions

### API.getTx(TransactionId)

getTx

**Parameters**

**TransactionId**: `String`, getTx

**Returns**: `Callback`, cb - Return error or transaction

### API.startScan(opts, opts.includeCopayerBranches, cb)

Start an address scanning process.
When finished, the scanning process will send a notification 'ScanFinished' to all copayers.

**Parameters**

**opts**: `Object`, Start an address scanning process.
When finished, the scanning process will send a notification 'ScanFinished' to all copayers.

**opts.includeCopayerBranches**: `Boolean`, (defaults to false)

**cb**: `Callback`, Start an address scanning process.
When finished, the scanning process will send a notification 'ScanFinished' to all copayers.


### API.getFiatRate(opts, opts.code, opts.ts, opts.provider)

Returns exchange rate for the specified currency & timestamp.

**Parameters**

**opts**: `Object`, Returns exchange rate for the specified currency & timestamp.

**opts.code**: `string`, Currency ISO code.

**opts.ts**: `Date`, A timestamp to base the rate on (default Date.now()).

**opts.provider**: `String`, A provider of exchange rates (default 'BitPay').

**Returns**: `Object`, rates - The exchange rate.

### API.pushNotificationsSubscribe(opts, opts.type, opts.token)

Returns subscription status.

**Parameters**

**opts**: `Object`, Returns subscription status.

**opts.type**: `String`, Device type (ios or android).

**opts.token**: `String`, Device token.

**Returns**: `Object`, response - Status of subscription.

### API.pushNotificationsUnsubscribe(token)

Returns unsubscription status.

**Parameters**

**token**: `String`, Device token

**Returns**: `Callback`, cb - Return error if exists

### API.getSendMaxInfo(opts, opts.feePerKb, opts.excludeUnconfirmedUtxos, opts.returnInputs)

Returns send max information.

**Parameters**

**opts**: `String`, Returns send max information.

**opts.feePerKb**: `Number`, Fee value

**opts.excludeUnconfirmedUtxos**: `Boolean`, Indicates it if should use (or not) the unconfirmed utxos

**opts.returnInputs**: `Boolean`, Indicates it if should return (or not) the inputs

**Returns**: `Callback`, cb - Return error (if exists) and object result

### API.createWalletFromOldCopay(username, password, blob, cb)

createWalletFromOldCopay

**Parameters**

**username**: , createWalletFromOldCopay

**password**: , createWalletFromOldCopay

**blob**: , createWalletFromOldCopay

**cb**: , createWalletFromOldCopay

**Returns**: `undefined`



* * *










* * *










* * *










* * *










* * *










# Global





* * *

## Class: Logger
A simple logger that wraps the <tt>console.log</tt> methods when available.

Usage:
<pre>
  log = new Logger('copay');
  log.setLevel('info');
  log.debug('Message!'); // won't show
  log.setLevel('debug');
  log.debug('Message!', 1); // will show '[debug] copay: Message!, 1'
</pre>

### Logger.setLevel(level)

Sets the level of a logger. A level can be any bewteen: 'silent', 'debug', 'info', 'log',
'warn', 'error', and 'fatal'. That order matters: if a logger's level is set to
'warn', calling <tt>level.debug</tt> won't have any effect. If the level is set to 'silent',
nothing will ever be logged. 'silent' is the default log level.

**Parameters**

**level**: `number`, the name of the logging level


### Logger.debug(args)

Log messages at the debug level.

**Parameters**

**args**: `*`, the arguments to be logged.


### Logger.info(args)

Log messages at the info level.

**Parameters**

**args**: `*`, the arguments to be logged.


### Logger.log(args)

Log messages at an intermediary level called 'log'.

**Parameters**

**args**: `*`, the arguments to be logged.


### Logger.warn(args)

Log messages at the warn level.

**Parameters**

**args**: `*`, the arguments to be logged.


### Logger.error(args)

Log messages at the error level.

**Parameters**

**args**: `*`, the arguments to be logged.


### Logger.fatal(args)

Log messages at the fatal level.

**Parameters**

**args**: `*`, the arguments to be logged.




* * *










* * *










* * *










* * *










# Global





* * *

## Class: Verifier
Verifier constructor. Checks data given by the server

### Verifier.checkAddress(credentials, address)

Check address

**Parameters**

**credentials**: `function`, Check address

**address**: `String`, Check address

**Returns**: `Boolean`, true or false

### Verifier.checkCopayers(credentials, copayers)

Check copayers

**Parameters**

**credentials**: `function`, Check copayers

**copayers**: `Array`, Check copayers

**Returns**: `Boolean`, true or false

### Verifier.checkTxProposal(credentials, txp, Optional:, isLegit)

Check transaction proposal

**Parameters**

**credentials**: `function`, Check transaction proposal

**txp**: `Object`, Check transaction proposal

**Optional:**: `Object`, paypro

**isLegit**: `Boolean`, Check transaction proposal




* * *










The MIT License

Copyright (c) 2015 BitPay

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
