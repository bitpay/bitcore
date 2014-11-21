# Transaction

Bitcore provides a very simple API for creating transactions. We expect this
API to be accessible for developers without knowing the working internals of
bitcoin in deep. What follows is a small introduction to transactions with some
basic knowledge required to use this API.

A Transaction contains a set of inputs and a set of outputs. Each input
contains a reference to another transaction's output, and a signature
that allows the value referenced in that ouput to be used in this transaction.

Note also that an output can be used only once. That's why there's a concept of
"change address" in the bitcoin ecosystem: if an output of 10 BTC is available
for me to spend, but I only need to transmit 1 BTC, I'll create a transaction
with two outputs, one with 1 BTC that I want to spend, and the other with 9 BTC
to a change address, so I can spend this 9 BTC with another private key that I
own.

So, in order to transmit a valid transaction, you must know what other transactions 
on the network store outputs that have not been spent and that are available
for you to spend (meaning that you have the set of keys that can validate you
own those funds). The unspent outputs are usually refered to as "utxo"s.

Let's take a look at some very simple transactions:

```javascript
var transaction = new Transaction()
    .from(utxos)          // Feed information about what unspend outputs one can use
    .to(address, amount)  // Add an output with the given amount of satoshis
    .change(address)      // Sets up a change address where the rest of the funds will go
    .sign(privkeySet)     // Signs all the inputs it can

var transaction2 = new Transaction()
    .from(utxos)          // Feed information about what unspend outputs one can use
    .spendAllTo(address)  // Spends all outputs into one address
    .sign(privkeySet)     // Signs all the inputs it can
```

Now, one could just serialize this transaction in hexadecimal ASCII values
(`transaction.serialize()`) and send it over to the bitcoind reference client.

```bash
bitcoin-cli sendrawtransaction <serialized transaction>
```

## Transaction API

You can take a look at the javadocs for the [Transaction class here](link
missing). This document will go over the expected high level use cases.

* from(utxo)
* change(address)
* fee(amount)
* usingStrategy(strategy)
* to(address, amount)
* to(pubKeySet, amount)
* addData(opReturnValue)
* sign(privKey)
* sign(privKeySet)
* applySignature(signature)
* missingSignatures()
* isValidSignature(signature)
* getSignatures(privKey)
* getSignatures(privKeySet)
* isFullySigned()
* toBuffer()
* toJSON()

## Multisig Transactions

To send a transaction to a multisig address, the API is the same as in the
above example. To spend outputs that require multiple signatures, the process
needs extra information: the public keys of the signers that can unlock that
output.

```javascript
  var multiSigTx = new Transaction()
      .fromMultisig(utxo, publicKeys)
      .spendAllTo(address, amount)
      .sign(myKeys);

  var serialized = multiSigTx.serialize();
```

This can be serialized and sent to another party, to complete with the needed
signatures:

```javascript
  var multiSigTx = new Transaction(serialized)
      .sign(anotherSetOfKeys);

  assert(multiSigTx.isFullySigned());
```

## Advanced topics

### Unspent Output Selection

If you have a larger set of unspent outputs, only some of them will be selected
to fulfill the amount. This is done by storing a cache of unspent outputs in a
protected member called `_utxos`. When the `to()` method is called, some of
these outputs will be selected to pay the requested amount to the appropiate
address.

There are some nits that you should have in mind when using this API:

  * When a signature is added, the corresponding utxo is removed from the cache.
  * When the transaction is serialized, this cache is not included in the
    serialized form. 

#### Spending Strategies

We have implemented partially Merge Avoidance for the change
addresses of a transaction with a simple API: 

```
  var mergeAvoidance = new Transaction.Strategy.MergeAvoidance({
    change: ['1bitcoinChange...', '3bitcoinChange...']
  });
  var transaction = new Transaction()
      .usingStrategy(mergeAvoidance)
      .to(['1target...', '3anaddress...'], amount)
```

Note that this will not create multiple transactions, which would increase
privacy. The `MergeAvoidance` API will take care that the target and change
addresses provided will receive as equally distributed outputs as possible,
using a simple algorithm.

In the future, if a Stealth Address is provided to the `to` method and the
strategy being used is `MergeAvoidance`, it will derive as many addresses as
needed according to the utxos received. In a similar fashion, we are discussing
how to provide an API for using an extended public key to derive change
addresses, but as the user of the library should be in control of the policy
for deriving keys (so no transaction outputs gets unnoticed), it's proving to
be a hard problem to solve and it may end up being the user's responsability.

## Upcoming changes

We're debating an API for full Merge Avoidance, CoinJoin, Smart contracts,
CoinSwap, and Stealth Addresses. We're expecting to have all of them by some
time in 2015.

A first draft of a Payment Channel smart contract modular extension to this
library is being implemented independently
(https://github.com/eordano/bitcore-channel). 
