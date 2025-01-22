# Bitcore Threshold Signature Scheme

[![NPM Package](https://img.shields.io/npm/v/bitcore-tss.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-tss)
[![CircleCI](https://dl.circleci.com/status-badge/img/gh/bitpay/bitcore/tree/master.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/bitpay/bitcore/tree/master)
[![Coverage Status](https://coveralls.io/repos/github/bitpay/bitcore/badge.svg?branch=master&path=packages/bitcore-tss)](https://coveralls.io/github/bitpay/bitcore?branch=master)

**A powerful JavaScript library for distributed threshold ECDSA key and signature generation**

## Principles

A threshold signature scheme allows a group of participants to sign a message in a distributed manner. The signature is valid only if a certain number of participants (the threshold) have signed the message.
This libary is deisgned to be flexible in that it supports distributed key generation (DKG) which means that the private key is never reconstructed in any one location, thus ensuring than no single party ever has the full private key in their possession.

## Get Started

```sh
npm install bitcore-tss
```
Adding Bitcore-TSS to your app's `package.json`:

```json
"dependencies": {
    "bitcore-tss": "^10.8.0",
    ...
}
```

## Documentation

### Distributed Key Generation

The DKG protocol is used to generate a shared private key that is distributed among a group of participants. The private key is never reconstructed in any one location, thus ensuring than no single party ever has the full private key in their possession.
> **The DKG protocol depends on a secure communication channel between the participants.**

#### Example

First, you need to instantiate a KeyGen instance.

```js
const keygen = new bitcoreTss.KeyGen({
  n: 3, // number of participants
  t: 2, // threshold
  partyId: 0, // which participant of the 3 are you?
  authKey: privateKey, // a private key used for encrypting and signing messages
  seed: seedKey, // Optional - could be the derivation of a 12-word phrase
});

```

Then, you need to generate the broadcast message to the other participants that you're joining the group.

```js
const broadcastMessage = keygen.initJoin();

// securely send broadcastMessage to the other participants
```

Once you receive the broadcast messages from the other participants, you need to proceed to the next round of messages.

```js
const otherParticipantsMessages = // receive messages from the other participants

const myNextRoundMessage = keygen.nextRound(otherParticipantsMessages);

// securely send myNextRoundMessage to the other participants
```

Continue through the rounds until the keychain is ready

```js
while (!keygen.isKeyChainReady()) {
  const otherParticipantsMessages = // receive messages from the other participants

  const myNextRoundMessage = keygen.nextRound(otherParticipantsMessages);

  // securely send myNextRoundMessage to the other participants
}

const keychain = keygen.getKeyChain();
```

Congrats! You now have a key share that you can use to sign messages.


### Distributed Signature Generation

Once you have your key share, you can use it to sign messages. The process is similar to the DKG protocol - generating a signature requires multiple rounds of message passing.

In this example, we'll use an Ethereum transaction as our use case.

```js
const rawTxHex = '0x...'; // your raw hex transaction
const hashBuffer = Buffer.from(Web3.utils.keccak256(rawTxHex).substring(2), 'hex');

const signer = new bitcoreTss.Sign({
  keychain,
  n: 3, // number of participants
  t: 2, // threshold
  partyId: 0, // your party id
  messageHash: hashBuffer, // a 32-byte hash of message to sign
  authKey: privateKey, // a private key used for encrypting and signing messages
  derivationPath: 'm' // optional - useful for UTXO chains like Bitcoin that derive lots of addresses
});
```

Initiate the first round of the signature generation protocol and create a broadcast message to send to the other participants that you wish to sign a message

```js
const broadcastMessage = signer.initJoin();

// securely send broadcastMessage to the other participants
```

Continue through the rounds until the signature is ready

```js
while (!signer.isSignatureReady()) {
  const otherParticipantsMessages = // receive messages from the other participants

  const myNextRoundMessage = signer.nextRound(otherParticipantsMessages);

  // securely send myNextRoundMessage to the other participants
}
```

Once the signature is ready, you can get it and apply it to your use case. For this example, we're applying the signature to our Ethereum transaction.

```js
const CWC = require('crypto-wallet-core');

const sig = signer.getSignature();

const signedTxHex = CWC.Transactions.applySignature({ chain: 'ETH', tx: rawTxHex, signature: sig });
```

