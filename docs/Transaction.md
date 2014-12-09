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
own those funds). The unspent outputs are usually referred to as "utxo"s.

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
missing).

## Multisig Transactions

To send a transaction to a multisig address, the API is the same as in the
above example. To spend outputs that require multiple signatures, the process
needs extra information: the public keys of the signers that can unlock that
output.

```javascript
  var multiSigTx = new Transaction()
      .fromMultisig(utxo, publicKeys, threshold)
      .change(address)
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

### Internal Workings

There are a number of data structures being stored internally in a
`Transaction` instance. These are kept up to date and change through successive
calls to its methods.

* `inputs`: The ordered set of inputs for this transaction
* `outputs`: This is the ordered set of output scripts
* `_outpoints`: The ordered set of outpoints (a string that combines a
  transaction hash and output index), UTXOs that will be inputs to this
  transaction. This gets populated on calls to `from` and also when
  deserializing from a serialized transaction.
* `_utxos`: Maps an outpoint to information regarding the output on that
  transaction. The values of an output are:
  - script: the associated script for this output. Will be an instance of
    `Script`
  - satoshis: amount of satoshis associated with this output
  - txId: the transaction id from the outpoint
  - outputIndex: the index of this output in the previous transaction
* `_inputAmount`: sum the amount for all the inputs
* `_signatures`: This is the ordered set of `scriptSig`s that are going to be
  included in the serialized transaction. These are objects with the following
  values:
  - publicKey: the public key that generated the signature 
  - prevTxId: the previous transaction hash
  - outputIndex: the index for the output that this input is signing
  - signature: the `Signature` for that public key
  - sigtype: the type of the signature (`Signature.SIGHASH_ALL` is the only one implemented)
* `_change`: stores the value provided by calling the `change` method.

TO BE IMPLEMENTED YET:
* `_fee`: if user specified a non-standard fee, the amount (in satoshis) will
  be stored in this variable so the change amount can be calculated.
* `_p2shMap`: For the case of P2SH spending, the user needs to supply
  information about the script that hashes to the hash of an UTXO. This map
  goes from the hash of the spend script to that script. When using the
  `from(utxo, publicKeys, threshold)` function, this map gets populated with a
  standard multisig spend script with public keys in the order provided.

### Unspent Output Selection

If you have a larger set of unspent outputs, only some of them will be selected
to fulfill the amount. This is done by storing a cache of unspent outputs in a
protected member called `_utxos`. When the `to()` method is called, some of
these outputs will be selected to pay the requested amount to the appropriate
address.

A nit that you should have in mind is that when the transaction is serialized,
this cache can't be included in the serialized form. 

## Upcoming changes

We're debating an API for Merge Avoidance, CoinJoin, Smart contracts, CoinSwap,
and Stealth Addresses. We're expecting to have all of them by some time in
early 2015.

A first draft of a Payment Channel smart contract modular extension to this
library is being implemented independently
(https://github.com/eordano/bitcore-channel). 
