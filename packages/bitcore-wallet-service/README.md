# Bitcore Wallet Service

[![NPM Package](https://img.shields.io/npm/v/bitcore-wallet-service.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-wallet-service)
[![Build Status](https://img.shields.io/travis/bitpay/bitcore-wallet-service.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-wallet-service)
[![Coverage Status](https://coveralls.io/repos/bitpay/bitcore-wallet-service/badge.svg?branch=master)](https://coveralls.io/r/bitpay/bitcore-wallet-service?branch=master)

**A Multisig HD Bitcore Wallet Service.**

## Description

Bitcore Wallet Service facilitates multisig HD wallets creation and operation through a (hopefully) simple and intuitive REST API.

BWS can usually be installed within minutes and accommodates all the needed infrastructure for peers in a multisig wallet to communicate and operate – with minimum server trust.

See [bitcore-wallet-client](https://github.com/bitpay/bitcore/tree/master/packages/bitcore-wallet-client) for the _official_ client library that communicates to BWS and verifies its response. Also check [bitcore-wallet](https://github.com/bitpay/bitcore/tree/master/packages/bitcore-wallet) for a simple CLI wallet implementation that relies on BWS.

BWS is been used in production enviroments for [Copay Wallet](https://copay.io), [Bitpay App wallet](https://bitpay.com/wallet) and others.

More about BWS at https://blog.bitpay.com/announcing-the-bitcore-wallet-suite/

## Getting Started

```sh
 git clone https://github.com/bitpay/bitcore-wallet-service.git
 cd bitcore-wallet-service
 npm install
 npm start
```

This will launch the BWS service (with default settings) at `http://localhost:3232/bws/api`.

BWS needs mongoDB. You can configure the connection at `config.js`

BWS supports SSL and Clustering. For a detailed guide on installing BWS with extra features see [Installing BWS](https://github.com/bitpay/bitcore/blob/master/packages/bitcore-wallet-service/installation.md).

BWS uses by default a Request Rate Limitation to CreateWallet endpoint. If you need to modify it, check defaults.js' `Defaults.RateLimit`

## Using BWS with PM2

BWS can be used with PM2 with the provided `app.js` script:

```sh
  pm2 start app.js --name "bitcoin-wallet-service"
```

## Security Considerations

- Private keys are never sent to BWS. Copayers store them locally.
- Extended public keys are stored on BWS. This allows BWS to easily check wallet balance, send offline notifications to copayers, etc.
- During wallet creation, the initial copayer creates a wallet secret that contains a private key. All copayers need to prove they have the secret by signing their information with this private key when joining the wallet. The secret should be shared using secured channels.
- A copayer could join the wallet more than once, and there is no mechanism to prevent this. See [wallet](https://github.com/bitpay/bitcore/tree/master/packages/bitcore-wallet)'s confirm command, for a method for confirming copayers.
- All BWS responses are verified:
  - Addresses and change addresses are derived independently and locally by the copayers from their local data.
  - TX Proposals templates are signed by copayers and verified by others, so the BWS cannot create or tamper with them.

## Using SSL

You can add your certificates at the config.js using:

```json
  https: true,
  privateKeyFile: 'private.pem',
  certificateFile: 'cert.pem',
  ////// The following is only for certs which are not
  ////// trusted by nodejs 'https' by default
  ////// CAs like Verisign do not require this
  // CAinter1: '', // ex. 'COMODORSADomainValidationSecureServerCA.crt'
  // CAinter2: '', // ex. 'COMODORSAAddTrustCA.crt'
  // CAroot: '', // ex. 'AddTrustExternalCARoot.crt'
```

@dabura667 made a report about how to use letsencrypt with BWS: https://github.com/bitpay/bitcore-wallet-service/issues/423

## TX proposal life cycle

Tx proposal need to be:

1.  First created via /v?/txproposal
    -> This will create a 'temporary' TX proposal, returning the object, but not locking the inputs
2.  Then published via /v?/txproposal/:id/publish
    -> This publish the tx proposal to all copayers, looking the inputs. The TX proposal can be `deleted` also, after been published.
3.  Then signed via /v?/txproposal/:id/signature for each copayer
4.  Then broadcasted to the p2p network via /v?/txproposal/:id/broadcast

The are plenty example creating and sending proposals in the `/test/integration` code.

## Enabling Regtest Mode for BWS and Copay

### Requirements

- bitcore-node running on http://localhost:3000
- bws running locally on http://localhost:3232/bws/api
- mongod running
- copay running on port: 8100
- bitcoin-core running on regtest mode (blue icon logo)

> mongo topology crashes sometimes due to notifications being incompatible in a web browser
> **bitcore-wallet-service/lib/notificationbroadcaster.js**
> Note: If testing on a PC browser, comment out notificationbroadcaster.js to disable notifications.

### Steps:

**bitcore.config.json**

1.  Add regtest to bitcore.config.json.

```
"regtest": {
          "chainSource": "p2p",
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 20020
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 20021,
            "username": "bitpaytest",
            "password": "local321"
          }
        }
```

**bitcore-wallet-service/config.js**

2. Point testnet to http://localhost:3000 in BWS/config.js and set regtestEnabled to true.

```
blockchainExplorerOpts: {
    btc: {
      livenet: {
        url: 'https://api.bitcore.io'
      },
      testnet: {
        // set url to http://localhost:3000 here
        url: 'http://localhost:3000',
        // set regtestEnabled to true here
        regtestEnabled: true
      }
    },
...
```

### Copay changes

**copay/app-template/index-template.html**

3. Comment out content security meta tag in the `<head>`

```
// <meta http-equiv="Content-Security-Policy" content="default-src 'self'  ... >
```

## Creating a wallet on regtest network

### Steps:

1. Set the wallet service URL to

```
http://localhost:3232/bws/api
```

2. Select Testnet by pressing the slider button.

<img width="923" alt="screen shot 2019-03-06 at 10 50 29 am" src="https://user-images.githubusercontent.com/23103037/53894324-e69f8300-3ffd-11e9-9b25-145332fe860c.png">

## Testing on mobile

Requirements:

- Mobile phone and PC must be connected to the same internet
- PC desktop ip address for localhost

To find ip address for PC run:

```
// 127.0.0.1 is equal to localhost
ifconfig | grep "inet " | grep -v 127.0.0.1
```

1. Inside copay project root directory run:

```
npm run apply:copay
```

2. Enter PC ip address followed by port in the mobile phone browser:

```
10.10.11.73:8100
```

3. Set wallet service url to PC ip address /bws/api when creating a new wallet

```
http://10.10.11.73:3232/bws/api
```

# REST API

Note: all currency amounts are in units of satoshis (1/100,000,000 of a bitcoin).

## Authentication

In order to access a wallet, clients are required to send the headers:

```sh
  x-identity
  x-signature
```

Identity is the Peer-ID, this will identify the peer and its wallet. Signature is the current request signature, using `requestSigningKey`, the `m/1/1` derivative of the Extended Private Key.

See [Bitcore Wallet Client](https://github.com/bitpay/bitcore/tree/master/packages/bitcore-wallet-client) for implementation details.

## GET Endpoints

### `/v1/wallets/`: Get wallet information

Returns:

- Wallet object. (see [fields on the source code](https://github.com/bitpay/bitcore/blob/master/packages/bitcore-wallet-service/src/lib/model/wallet.ts)).

### `/v1/txhistory/`: Get Wallet's transaction history

Optional Arguments:

- skip: Records to skip from the result (defaults to 0)
- limit: Total number of records to return (return all available records if not specified).

Returns:

- History of incoming and outgoing transactions of the wallet. The list is paginated using the `skip` & `limit` params. Each item has the following fields:
- action ('sent', 'received', 'moved')
- amount
- fees
- time
- addressTo
- confirmations
- proposalId
- creatorName
- message
- actions array ['createdOn', 'type', 'copayerId', 'copayerName', 'comment']

### `/v2/txproposals/`: Get Wallet's pending transaction proposals and their status

Returns:

- List of pending TX Proposals. (see [fields on the source code](https://github.com/bitpay/bitcore/blob/master/packages/bitcore-wallet-service/src/lib/model/txproposal.ts))

- Uses cashaddr without prefix for BCH

### `/v4/addresses/`: Get Wallet's main addresses (does not include change addresses)

Optional Arguments:

- ignoreMaxGap: [false] Ignore checking less that 20 unused addresses (BIP44 GAP)

Returns:

- List of Addresses object: (https://github.com/bitpay/bitcore/blob/master/packages/bitcore-wallet-service/src/lib/model/address.ts). This call is mainly provided so the client check this addresses for incoming transactions (using a service like [Insight](https://insight.bitcore.io)
- Returns cashaddr without prefix for BCH

### `/v1/balance/`: Get Wallet's balance

Returns:

- totalAmount: Wallet's total balance
- lockedAmount: Current balance of outstanding transaction proposals, that cannot be used on new transactions.
- availableAmount: Funds available for new proposals.
- totalConfirmedAmount: Same as totalAmount for confirmed UTXOs only.
- lockedConfirmedAmount: Same as lockedAmount for confirmed UTXOs only.
- availableConfirmedAmount: Same as availableAmount for confirmed UTXOs only.
- byAddress array ['address', 'path', 'amount']: A list of addresses holding funds.
- totalKbToSendMax: An estimation of the number of KiB required to include all available UTXOs in a tx (including unconfirmed).

### `/v1/txnotes/:txid`: Get user notes associated to the specified transaction

Returns:

- The note associated to the `txid` as a string.

### `/v1/fiatrates/:code`: Get the fiat rate for the specified ISO 4217 code

Optional Arguments:

- provider: An identifier representing the source of the rates.
- ts: The timestamp for the fiat rate (defaults to now).

Returns:

- The fiat exchange rate.

## POST Endpoints

### `/v1/wallets/`: Create a new Wallet

Required Arguments:

- name: Name of the wallet
- m: Number of required peers to sign transactions
- n: Number of total peers on the wallet
- pubKey: Wallet Creation Public key to check joining copayer's signatures (the private key is unknown by BWS and must be communicated
  by the creator peer to other peers).

Returns:

- walletId: Id of the new created wallet

### `/v1/wallets/:id/copayers/`: Join a Wallet in creation

Required Arguments:

- walletId: Id of the wallet to join
- name: Copayer Name
- xPubKey - Extended Public Key for this copayer.
- requestPubKey - Public Key used to check requests from this copayer.
- copayerSignature - Signature used by other copayers to verify that the copayer joining knows the wallet secret.

Returns:

- copayerId: Assigned ID of the copayer (to be used on x-identity header)
- wallet: Object with wallet's information

### `/v3/txproposals/`: Add a new temporary transaction proposal

Required Arguments:

- toAddress: RCPT Bitcoin address.
- amount: amount (in satoshis) of the mount proposed to be transfered
- proposalsSignature: Signature of the proposal by the creator peer, using proposalSigningKey.
- (opt) message: Encrypted private message to peers.
- (opt) payProUrl: Paypro URL for peers to verify TX
- (opt) feePerKb: Use an alternative fee per KB for this TX.
- (opt) excludeUnconfirmedUtxos: Do not use UTXOs of unconfirmed transactions as inputs for this TX.
- BCH addresses need to be cashaddr without prefix.

Returns:

- TX Proposal object. (see [fields on the source code]https://github.com/bitpay/bitcore/blob/master/packages/bitcore-wallet-service/src/lib/model/txproposal.ts)). `.id` is probably needed in this case.

### `/v2/txproposals/:id/publish`: Publish the previously created `temporary` tx proposal

Returns:

- TX Proposal object. (see [fields on the source code](https://github.com/bitpay/bitcore/blob/master/packages/bitcore-wallet-service/src/lib/model/txproposal.ts)).

### `/v3/addresses/`: Request a new main address from wallet . (creates an address on normal conditions)

Returns:

- Address object: (https://github.com/bitpay/bitcore/blob/master/packages/bitcore-wallet-service/src/lib/model/address.ts). Note that `path` is returned so client can derive the address independently and check server's response.

### `/v1/txproposals/:id/signatures/`: Sign a transaction proposal

Required Arguments:

- signatures: All Transaction's input signatures, in order of appearance.

Returns:

- TX Proposal object. (see [fields on the source code](https://github.com/bitpay/bitcore/blob/master/packages/bitcore-wallet-service/src/lib/model/txproposal.ts)). `.status` is probably needed in this case.

### `/v1/txproposals/:id/broadcast/`: Broadcast a transaction proposal

Returns:

- TX Proposal object. (see [fields on the source code](https://github.com/bitpay/bitcore/blob/master/packages/bitcore-wallet-service/src/lib/model/txproposal.ts)). `.status` is probably needed in this case.

### `/v1/txproposals/:id/rejections`: Reject a transaction proposal

Returns:

- TX Proposal object. (see [fields on the source code](https://github.com/bitpay/bitcore/blob/master/packages/bitcore-wallet-service/src/lib/model/txproposal.ts)). `.status` is probably needed in this case.

### `/v1/addresses/scan`: Start an address scan process looking for activity.

Optional Arguments:

- includeCopayerBranches: Scan all copayer branches following BIP45 recommendation (defaults to false).

### `/v1/txconfirmations/`: Subscribe to receive push notifications when the specified transaction gets confirmed

Required Arguments:

- txid: The transaction to subscribe to.

## PUT Endpoints

### `/v1/txnotes/:txid/`: Modify a note for a tx

## DELETE Endpoints

### `/v1/txproposals/:id/`: Deletes a transaction proposal. Only the creator can delete a TX Proposal, and only if it has no other signatures or rejections

Returns:

- TX Proposal object. (see [fields on the source code](https://github.com/bitpay/bitcore/blob/master/packages/bitcore-wallet-service/src/lib/model/txproposal.ts)). `.id` is probably needed in this case.

### `/v1/txconfirmations/:txid`: Unsubscribe from transaction `txid` and no longer listen to its confirmation

# Push Notifications

Recomended to complete config.js file:

- [FCM documentation](https://firebase.google.com/docs/cloud-messaging/)
- [Apple's Notification](https://developer.apple.com/documentation/usernotifications)

## POST Endpoints

### `/v1/pushnotifications/subscriptions/`: Adds subscriptions for push notifications service at database

## DELETE Endpoints

### `/v2/pushnotifications/subscriptions/`: Remove subscriptions for push notifications service from database

## Contributing

See [CONTRIBUTING.md](https://github.com/bitpay/bitcore/blob/master/Contributing.md) on the main bitcore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).

Copyright 2013-2019 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.
