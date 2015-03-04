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

## Airgapped Operation 

## Security Considerations
 * Private keys are never sent to BWS. Copayers store them locally.
 * Extended public keys are stored on BWS. This allows BWS to easily check wallet balance, send offline notifications to copayers, etc.
 * During wallet creation, the initial copayer creates a wallet secret that contains a private key. All copayers need to prove they have the secret by signing their information with this private key when joining the wallet. The secret should be shared using secured channels.

## All BWS responses are verified:
  * Addresses and change addresses are derived independently and locally by the copayers from their local data.
  * TX Proposals templates are signed by copayers and verified by others, so the BWS cannot create or tamper with them.

## Notes
 * A copayer could join the wallet more than once, and there is no mechanism to prevent this. Copayers should use the command 'confirm' to check other copayer's identity.

##  In case the BWS is compromised
 * It could be possible to see past (and future) wallet's transactions.
 * It is not possible to spend wallet funds, since private keys are never sent nor stored at BWS
 * It is not possible to tamper with tx proposals or wallet addresses since they are computed and verified by copayers
 * Copayers could switch to another BWS instance using their local data (see `recreate` command). In this case only the wallet extended data will be lost (pending and past transaction proposals, some copayer metadata).


  
# REST API

## create a wallet
 POST  `/v1/wallets`
## join a wallet
 POST  `/v1/wallets/:id/copayers`

 ...

 [To be completed, see expressapp.js]
 



