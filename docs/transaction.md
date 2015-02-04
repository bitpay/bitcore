---
title: Transaction
description: A robust interface to create, parse and validate bitcoin transactions.
---
# Transaction

## Description

Bitcore provides a very simple API for creating transactions. We expect this API to be accessible for developers without knowing the working internals of bitcoin in deep detail. What follows is a small introduction to transactions with some basic knowledge required to use this API.

A Transaction contains a set of inputs and a set of outputs. Each input contains a reference to another transaction's output, and a signature that allows the value referenced in that output to be used in this transaction.

Note also that an output can be used only once. That's why there's a concept of "change address" in the bitcoin ecosystem: if an output of 10 BTC is available for me to spend, but I only need to transmit 1 BTC, I'll create a transaction with two outputs, one with 1 BTC that I want to spend, and the other with 9 BTC to a change address, so I can spend this 9 BTC with another private key that I own.

So, in order to transmit a valid transaction, you must know what other transactions on the network store outputs that have not been spent and that are available for you to spend (meaning that you have the set of keys that can validate you own those funds). The unspent outputs are usually referred to as "utxo"s.

Let's take a look at some very simple transactions:

```javascript
var transaction = new Transaction()
    .from(utxos)          // Feed information about what unspent outputs one can use
    .to(address, amount)  // Add an output with the given amount of satoshis
    .change(address)      // Sets up a change address where the rest of the funds will go
    .sign(privkeySet)     // Signs all the inputs it can
```

Now, this could just be serialized to hexadecimal ASCII values (`transaction.serialize()`) and sent over to the bitcoind reference client.

```bash
bitcoin-cli sendrawtransaction <serialized transaction>
```

You can also override the fee estimation with another amount, specified in satoshis:
```javascript
var transaction = new Transaction().fee(5430); // Minimum non-dust amount
var transaction = new Transaction().fee(1e8);  // Generous fee of 1 BTC
```

## Transaction API

## Input

Transaction inputs are instances of either [Input](https://github.com/bitpay/bitcore/tree/master/lib/transaction/input) or its subclasses.

## Output

Transaction outputs are a very thin wrapper around the information provided by a transaction output: its script and its output amount.

## Multisig Transactions

To send a transaction to a multisig address, the API is the same as in the above example. To spend outputs that require multiple signatures, the process needs extra information: the public keys of the signers that can unlock that output.

```javascript
  var multiSigTx = new Transaction()
      .from(utxo, publicKeys, threshold)
      .change(address)
      .sign(myKeys);

  var serialized = multiSigTx.toObject();
```

This can be serialized and sent to another party, to complete with the needed signatures:

```javascript
  var multiSigTx = new Transaction(serialized)
      .sign(anotherSetOfKeys);

  assert(multiSigTx.isFullySigned());
```

## Advanced topics

### Internal Workings

There are a number of data structures being stored internally in a `Transaction` instance. These are kept up to date and change through successive calls to its methods.

* `inputs`: The ordered set of inputs for this transaction
* `outputs`: This is the ordered set of output scripts
* `_inputAmount`: sum of the amount for all the inputs
* `_outputAmount`: sum of the amount for all the outputs
* `_fee`: if user specified a non-standard fee, the amount (in satoshis) will be stored in this variable so the change amount can be calculated.
* `_change`: stores the value provided by calling the `change` method.

## Upcoming changes

We're debating an API for Merge Avoidance, CoinJoin, Smart contracts, CoinSwap, and Stealth Addresses. We're expecting to have all of them by some time in early 2015. First draft implementations of Payment Channel smart contracts extensions to this library are already being implemented independently.
