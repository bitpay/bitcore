# Transaction

Bitcore JavaScript Library provides a very simple API for creating transactions. We expect this API to be accessible for developers without knowing the working internals of bitcoin in deep detail. What follows is a small introduction to transactions with some basic knowledge required to use this API.

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

You can obtain the input and output total amounts of the transaction in satoshis by accessing the fields `inputAmount` and `outputAmount`.

Now, this could just be serialized to hexadecimal ASCII values (`transaction.serialize()`) and sent over to the bitcoind reference client.

```sh
bitcoin-cli sendrawtransaction <serialized transaction>
```

You can also override the fee estimation with another amount, specified in satoshis:

```javascript
var transaction = new Transaction().fee(5430); // Minimum non-dust amount
var transaction = new Transaction().fee(1e8);  // Generous fee of 1 BTC
```

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

Also, you can just send over the signature for your private key:

```javascript
var multiSigTx = new Transaction()
    .from(utxo, publicKeys, threshold)
    .change(address);

var signature = multiSigTx.getSignatures(privateKey)[0];
console.log(JSON.stringify(signature));
console.log(signature.toObject());
console.log(signature.signature.toString()); // Outputs a DER signature
console.log(signature.sigtype);
```

Transfer that over the wire, and on the other side, apply it to a transaction:

```javascript
assert(transaction.isValidSignature(receivedSig));
transaction.applySignature(receivedSig);
```

## Adding inputs

Transaction inputs are instances of either [Input](https://github.com/bitpay/bitcore/tree/master/lib/transaction/input) or its subclasses. `Input` has some abstract methods, as there is no actual concept of a "signed input" in the bitcoin scripting system (just valid signatures for <tt>OP_CHECKSIG</tt> and similar opcodes). They are stored in the `input` property of `Transaction` instances.

Bitcore contains two implementations of `Input`, one for spending _Pay to Public Key Hash_ outputs (called `PublicKeyHashInput`) and another to spend _Pay to Script Hash_ outputs for which the redeem script is a Multisig script (called `MultisigScriptHashInput`).

All inputs have the following five properties:

- `prevTxId`: a `Buffer` with the id of the transaction with the output this input is spending
- `outputIndex`: a `number` the index of the output in the previous transaction
- `sequenceNumber`: a `number`, the sequence number, see [bitcoin's developer guide on nLockTime and the sequence number](https://developer.bitcoin.org/devguide/transactions.html#locktime-and-sequence-number).
- `script`: the `Script` instance for this input. Usually called `scriptSig` in the bitcoin community.
- `output`: if available, a `Output` instance of the output associated with this input.

Both `PublicKeyHashInput` and `MultisigScriptHashInput` cache the information about signatures, even though this information could somehow be encoded in the script. Both need to have the `output` property set in order to calculate the `sighash` so signatures can be created.

Some methods related to adding inputs are:

- `from`: A high level interface to add an input from a UTXO. It has a series of variants:
  - `from(utxo)`: add an input from an [Unspent Transaction Output](unspentoutput.md). 
  - `from(utxos)`: same as above, but passing in an array of Unspent Outputs.
  - `from(utxo, publicKeys, threshold)`: add an input that spends a UTXO with a P2SH output for a Multisig script. The `publicKeys` argument is an array of public keys, and `threshold` is the number of required signatures in the Multisig script.

- `addInput`: Performs a series of checks on an input and appends it to the end of the `input` vector and updates the amount of incoming bitcoins of the transaction.
- `uncheckedAddInput`: adds an input to the end of the `input` vector and updates the `inputAmount` without performing any checks.

### PublicKeyHashInput

This input uses the `script` property to mark the input as unsigned if the script is empty.

### MultisigScriptHashInput

This input contains a set of signatures in a `signatures` property, and each time a signature is added, a potentially partial and/or invalid script is created. The `isFullySigned` method will only return true if all needed signatures are already added and valid. If `addSignature` is added after all need signatures are already set, an exception will be thrown.

## Signing a Transaction

The following methods are used to manage signatures for a transaction:

- `getSignatures`: takes an array of `PrivateKey` or strings from which a `PrivateKey` can be instantiated; the transaction to be signed; the kind of [signature hash to use](https://developer.bitcoin.org/devguide/transactions.html#signature-hash-types). Returns an array of objects with the following properties:
  - `signature`: an instance of [Signature](https://github.com/bitpay/bitcore/blob/master/packages/bitcore-lib/lib/transaction/signature.js)
  - `prevTxId`: this input's `prevTxId`,
  - `outputIndex`: this input's `outputIndex`,
  - `inputIndex`: this input's index in the transaction
  - `sigtype`: the "sighash", the type of transaction hash used to calculate the signature
  - `publicKey`: a `PublicKey` of the `PrivateKey` used to create the signature

- `addSignature`: takes an element outputed by `getSignatures` and applies the signature to this input (modifies the script to include the new signature).
- `clearSignatures`: removes all signatures for this input
- `isFullySigned`: returns true if the input is fully signed

## Handling Outputs

Outputs can be added by:

- The `addOutput(output)` method, which pushes an `Output` to the end of the `outputs` property and updates the `outputAmount` field. It also clears signatures (as the hash of the transaction may have changed) and updates the change output.
- The `to(address, amount)` method, that adds an output with the script that corresponds to the given address. Builds an output and calls the `addOutput` method.
- Specifying a [change address](#Fee_calculation)

To remove all outputs, you can use `clearOutputs()`, which preserves change output configuration.

## Serialization

There are a series of methods used for serialization:

- `toObject`: Returns a plain JavaScript object with no methods and enough information to fully restore the state of this transaction. Using other serialization methods (except for `toJSON`) will cause a some information to be lost.
- `toJSON`: Will be called when using `JSON.stringify` to return JSON-encoded string using the output from `toObject`.
- `toString` or `uncheckedSerialize`: Returns an hexadecimal serialization of the transaction, in the [serialization format for bitcoin](https://developer.bitcoin.org/reference/transactions.html#raw-transaction-format).
- `serialize`: Does a series of checks before serializing the transaction
- `inspect`: Returns a string with some information about the transaction (currently a string formatted as `<Transaction 000...000>`, that only shows the serialized value of the transaction.
- `toBuffer`: Serializes the transaction for sending over the wire in the bitcoin network
- `toBufferWriter`: Uses an already existing BufferWriter to copy over the serialized transaction

## Serialization Checks

When serializing, the bitcore library performs a series of checks. These can be disabled by providing an object to the `serialize` method with the checks that you'll like to skip.

- `disableLargeFees` avoids checking that the fee is no more than `Transaction.FEE_PER_KB * Transaction.FEE_SECURITY_MARGIN * size_in_kb`.
- `disableSmallFees` avoids checking that the fee is less than `Transaction.FEE_PER_KB * size_in_kb / Transaction.FEE_SECURITY_MARGIN`.
- `disableIsFullySigned` does not check if all inputs are fully signed
- `disableDustOutputs` does not check for dust outputs being generated
- `disableMoreOutputThanInput` avoids checking that the sum of the output amounts is less than or equal to the sum of the amounts for the outputs being spent in the transaction

These are the current default values in the bitcore library involved on these checks:

- `Transaction.FEE_PER_KB`: `10000` (satoshis per kilobyte)
- `Transaction.FEE_SECURITY_MARGIN`: `15`
- `Transaction.DUST_AMOUNT`: `546` (satoshis)

## Fee calculation

When outputs' value don't sum up to the same amount that inputs, the difference in bitcoins goes to the miner of the block that includes this transaction. The concept of a "change address" usually is associated with this: an output with an address that can be spent by the creator of the transaction.

For this reason, some methods in the Transaction class are provided:

- `change(address)`: Set up the change address. This will set an internal `_changeScript` property that will store the change script associated with that address.
- `fee(amount)`: Sets up the exact amount of fee to pay. If no change address is provided, this will raise an exception.
- `getFee()`: returns the estimated fee amount to be paid, based on the size of the transaction, but disregarding the priority of the outputs.

Internally, a `_changeIndex` property stores the index of the change output (so it can get updated when a new input or output is added).

## Time-Locking transaction

All bitcoin transactions contain a locktime field. The locktime indicates the earliest time a transaction can be added to the blockchain. Locktime allows signers to create time-locked transactions which will only become valid in the future, giving the signers a chance to change their minds. Locktime can be set in the form of a bitcoin block height (the transaction can only be included in a block with a higher height than specified) or a linux timestamp (transaction can only be confirmed after that time). For more information see [bitcoin's development guide section on locktime](https://developer.bitcoin.org/devguide/transactions.html#locktime-and-sequence-number).

In bitcore, you can set a `Transaction`'s locktime by using the methods `Transaction#lockUntilDate` and `Transaction#lockUntilBlockHeight`. You can also get a friendly version of the locktime field via `Transaction#getLockTime`;

For example:

```javascript
var future = new Date(2025,10,30); // Sun Nov 30 2025
var transaction = new Transaction()
  .lockUntilDate(future);
console.log(transaction.getLockTime());
// output similar to: Sun Nov 30 2025 00:00:00 GMT-0300 (ART)
```

