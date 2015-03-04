# bitcore-wallet-service


[![Build Status](https://img.shields.io/travis/bitpay/bitcore-wallet-service.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-wallet-service)
[![Coverage Status](https://coveralls.io/repos/bitpay/bitcore-wallet-service/badge.svg?branch=master)](https://coveralls.io/r/bitpay/bitcore-wallet-service?branch=master)

A Multisig HD Wallet Service, with minimum trust.

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

`/v1/txhistory/`: Get Wallet's transaction history

`/v1/txproposals/`:  Get Wallet's pending transaction proposals and their status

`/v1/addresses/`: Get Wallet's main addresses (does not include change addresses)

`/v1/balance/`:  Get Wallet's balance

## POST Endpoinds
`/v1/wallets/`: Create a new Wallet

`/v1/wallets/:id/copayers/`: Join a Wallet in creation

`/v1/txproposals/`: Add a new transactionproposal

`/v1/addresses/`: Request a new main address from wallet

`/v1/txproposals/:id/signatures/`: Sign a transaction proposal

`/v1/txproposals/:id/broadcast/`: Broadcast a transaction proposal

`/v1/txproposals/:id/rejections`: Reject a transaction proposal

## DELETE Endpoinds
`/v1/txproposals/:id/`: Deletes a transaction proposal. Only the creator can delete a TX Proposal, and only if it has no other signatures or rejections

 


