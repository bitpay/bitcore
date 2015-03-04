
# bitcore-wallet-service

[![NPM Package](https://img.shields.io/npm/v/bitcore-wallet-service.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-wallet-service)
[![Build Status](https://img.shields.io/travis/bitpay/bitcore-wallet-service.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-wallet-service)
[![Coverage Status](https://coveralls.io/repos/bitpay/bitcore-wallet-service/badge.svg?branch=master)](https://coveralls.io/r/bitpay/bitcore-wallet-service?branch=master)

A Multisig HD Bitcore Wallet Service.

# Description

Bitcore Wallet Service facilitates multisig HD wallets creation and operation thru a (hopefully) simple and intuitive REST API.

BWS can usually be installed within minutes and acommodates all the needed infrastruture for peers in a multisig wallet to communicate, and operate with minimun server trust.
  
See [Bitcore-wallet-client] (https://github.com/bitpay/bitcore-wallet-client) for the *official* client library that communicates to BWS, and verifies its responsed. Also check [Bitcore-wallet] (https://github.com/bitpay/bitcore-wallet) for a simple CLI wallet implementation that relays on BWS.
  
 
# Peer's Local  data
Peer need to store their *extended private key* and other participant peers' extended public key locally. We call this the ``Credentials``. *Extended private keys* are **never** sent to BWS.
 
## Mobility
Peers can safely access a wallet from different devices at the same time  by copying their credentials.

## Agent support

BWS supports signing and non signing agents. 

Agents can be given a wallet secret, and join the wallet during creation, and act as with the same status of a regular peer. Agents can also be created by *cloning* one peer's data (and optionally removing its private key). By removing the private key, the resulting agent wont be able to sign transactions.  

Agent support is [planned to be extended](https://github.com/bitpay/bitcore-wallet-service/issues/114) in following releases.

## Airgapped Operation 
[TODO be documented]

## Security Considerations
 * Private keys are never sent to BWS. Copayers store them locally.
 * Extended public keys are stored on BWS. This allows BWS to easily check wallet balance, send offline notifications to copayers, etc.
 * During wallet creation, the initial copayer creates a wallet secret that contains a private key. All copayers need to prove they have the secret by signing their information with this private key when joining the wallet. The secret should be shared using secured channels.

## All BWS responses are verified:
  * Addresses and change addresses are derived independently and locally by the copayers from their local data.
  * TX Proposals templates are signed by copayers and verified by others, so the BWS cannot create or tamper with them.

## Notes
 * A copayer could join the wallet more than once, and there is no mechanism to prevent this. See [wallet]((https://github.com/bitpay/bitcore-wallet)'s confirm command, for a method for confirming copayers.

# REST API

## Authentication

  In order to access a wallet, clients are required to send the headers:
```
  x-identity
  x-signature
```
Identity is the Peer-ID, this will identify the peer and its wallet. Signature is the current request signature, using `requestSigningKey`, the `m/1/1` derivative of the Extended Private Key.

See [Bitcore Wallet Client](https://github.com/bitpay/bitcore-wallet-client/blob/master/lib/api.js#L73) for implementation details.


## GET Endpoinds
`/v1/wallets/`: Get wallet information

Returns:
 * Wallet object. (see [fields on the source code](https://github.com/bitpay/bitcore-wallet-service/blob/master/lib/model/wallet.js)).

`/v1/txhistory/`: Get Wallet's transaction history

Returns:
 *  History of incomming and outgoing transactions of the wallet. The list is returned complete (Pagination and filter are [ToDos](https://github.com/bitpay/bitcore-wallet-service/issues/121))
Each item has the following fields:
https://github.com/bitpay/bitcore-wallet-service/issues/121
  * proposalId
  * creatorName
  * message
  * actions array ['createdOn', 'type', 'copayerId', 'copayerName', 'comment']
  
 
`/v1/txproposals/`:  Get Wallet's pending transaction proposals and their status
Returns:
 * List of pending TX Proposals. (see [fields on the source code](https://github.com/bitpay/bitcore-wallet-service/blob/master/lib/model/txproposal.js))

`/v1/addresses/`: Get Wallet's main addresses (does not include change addresses)

Returns:
 * List of Addresses object: (https://github.com/bitpay/bitcore-wallet-service/blob/master/lib/model/adddress.js)).  This call is mainly provided so the client check this addresses for incomming transactions (using a service like [Insight](https://insight.is)

`/v1/balance/`:  Get Wallet's balance

Returns:
 * totalAmount: Wallet's total balance
 * lockedAmount: Current balance of outstanding transaction proposals, that cannot be used on new transactions. 
 
## POST Endpoinds
`/v1/wallets/`: Create a new Wallet

 Required Arguments:
 * name: Name of the wallet 
 * m: Number of required peers to sign transactions 
 * n: Number of total peers on the wallet
 * pubKey: Wallet Creation Public key to check joining copayer's signatures (the private key is unknown by BWS and must be communicated
  by the creator peer to other peers).

Returns: 
 * walletId: Id of the new created wallet


`/v1/wallets/:id/copayers/`: Join a Wallet in creation
Required Arguments:
 * walletId: Id of the wallet to join
 * name: Copayer Name
 * xPubKey: Peer's extended public key
 * xPubKeySignature: xPubKey signature with Wallet Creation private key

Returns:
 * copayerId: Assigned ID of the copayer (to be used on x-identity header)
 * wallet: Object with wallet's information

`/v1/txproposals/`: Add a new transaction proposal
Required Arguments:
 * toAddress:  RCPT Bitcoin address 
 * amount: amount (in satoshis) of the mount proposed to be transfered
 * proposalsSignature: Signature of the proposal by the creator peer, using prososalSigningKey.
 * (opt) message: Encrypted private message to peers
 
Returns:
 * TX Proposal object. (see [fields on the source code](https://github.com/bitpay/bitcore-wallet-service/blob/master/lib/model/txproposal.js)). `.id` is probably needed in this case.


`/v1/addresses/`: Request a new main address from wallet

Returns:
 * Address object: (https://github.com/bitpay/bitcore-wallet-service/blob/master/lib/model/adddress.js)). Note that `path` is returned so client can derive the address independently and check server's response.

`/v1/txproposals/:id/signatures/`: Sign a transaction proposal

Required Arguments:
 * signatures:  All Transaction's input signatures, in order of appearance.
  
Returns:
 * TX Proposal object. (see [fields on the source code](https://github.com/bitpay/bitcore-wallet-service/blob/master/lib/model/txproposal.js)). `.status` is probably needed in this case.
  
`/v1/txproposals/:id/broadcast/`: Broadcast a transaction proposal
 
Returns:
 * TX Proposal object. (see [fields on the source code](https://github.com/bitpay/bitcore-wallet-service/blob/master/lib/model/txproposal.js)). `.status` is probably needed in this case.
  
`/v1/txproposals/:id/rejections`: Reject a transaction proposal
 
Returns:
 * TX Proposal object. (see [fields on the source code](https://github.com/bitpay/bitcore-wallet-service/blob/master/lib/model/txproposal.js)). `.status` is probably needed in this case.
  
## DELETE Endpoinds
`/v1/txproposals/:id/`: Deletes a transaction proposal. Only the creator can delete a TX Proposal, and only if it has no other signatures or rejections

 Returns:
 * TX Proposal object. (see [fields on the source code](https://github.com/bitpay/bitcore-wallet-service/blob/master/lib/model/txproposal.js)). `.id` is probably needed in this case.
   



`
 



