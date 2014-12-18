<a name="Transaction"></a>
#class: Transaction
**Members**

* [class: Transaction](#Transaction)
  * [new Transaction(serialized)](#new_Transaction)
  * [transaction.serialize](#Transaction#serialize)
  * [Transaction.shallowCopy(transaction)](#Transaction.shallowCopy)
  * [transaction._getHash()](#Transaction#_getHash)
  * [transaction.from(utxo, [pubkeys], [threshold])](#Transaction#from)
  * [transaction.hasAllUtxoInfo()](#Transaction#hasAllUtxoInfo)
  * [transaction.fee(amount)](#Transaction#fee)
  * [transaction.change(amount)](#Transaction#change)
  * [transaction.to(address, amount)](#Transaction#to)
  * [transaction.addData(value)](#Transaction#addData)
  * [transaction.sign(privateKey, sigtype)](#Transaction#sign)
  * [transaction.applySignature(signature)](#Transaction#applySignature)
  * [transaction.verifySignature()](#Transaction#verifySignature)
  * [transaction.verify()](#Transaction#verify)
  * [transaction.isCoinbase()](#Transaction#isCoinbase)

<a name="new_Transaction"></a>
##new Transaction(serialized)
Represents a transaction, a set of inputs and outputs to change ownership of tokens

**Params**

- serialized `*`  

<a name="Transaction#serialize"></a>
##transaction.serialize
Retrieve a hexa string that can be used with bitcoind's CLI interface
(decoderawtransaction, sendrawtransaction)

**Returns**: `string`  
<a name="Transaction.shallowCopy"></a>
##Transaction.shallowCopy(transaction)
Create a 'shallow' copy of the transaction, by serializing and deserializing
it dropping any additional information that inputs and outputs may have hold

**Params**

- transaction <code>[Transaction](#Transaction)</code>  

**Returns**: [Transaction](#Transaction)  
<a name="Transaction#_getHash"></a>
##transaction._getHash()
Retrieve the little endian hash of the transaction (used for serialization)

**Returns**: `Buffer`  
<a name="Transaction#from"></a>
##transaction.from(utxo, [pubkeys], [threshold])
Add an input to this transaction. This is a high level interface
to add an input, for more control, use @{link Transaction#addInput}.

Can receive, as output information, the output of bitcoind's `listunspent` command,
and a slightly fancier format recognized by bitcore:

```
{
 address: 'mszYqVnqKoQx4jcTdJXxwKAissE3Jbrrc1',
 txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
 outputIndex: 0,
 script: Script.empty(),
 satoshis: 1020000
}
```
Where `address` can be either a string or a bitcore Address object. The
same is true for `script`, which can be a string or a bitcore Script.

Beware that this resets all the signatures for inputs (in further versions,
SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).

**Params**

- utxo `Object`  
- \[pubkeys\] `Array`  
- \[threshold\] `number`  

**Example**  
```javascript
var transaction = new Transaction();

// From a pay to public key hash output from bitcoind's listunspent
transaction.from({'txid': '0000...', vout: 0, amount: 0.1, scriptPubKey: 'OP_DUP ...'});

// From a pay to public key hash output
transaction.from({'txId': '0000...', outputIndex: 0, satoshis: 1000, script: 'OP_DUP ...'});

// From a multisig P2SH output
transaction.from({'txId': '0000...', inputIndex: 0, satoshis: 1000, script: '... OP_HASH'},
                 ['03000...', '02000...'], 2);
```

<a name="Transaction#hasAllUtxoInfo"></a>
##transaction.hasAllUtxoInfo()
Returns true if the transaction has enough info on all inputs to be correctly validated

**Returns**: `boolean`  
<a name="Transaction#fee"></a>
##transaction.fee(amount)
Manually set the fee for this transaction. Beware that this resets all the signatures
for inputs (in further versions, SIGHASH_SINGLE or SIGHASH_NONE signatures will not
be reset).

**Params**

- amount `number` - satoshis to be sent  

**Returns**: [Transaction](#Transaction) - this, for chaining  
<a name="Transaction#change"></a>
##transaction.change(amount)
Set the change address for this transaction

Beware that this resets all the signatures for inputs (in further versions,
SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).

**Params**

- amount `number` - satoshis to be sent  

**Returns**: [Transaction](#Transaction) - this, for chaining  
<a name="Transaction#to"></a>
##transaction.to(address, amount)
Add an output to the transaction.

Beware that this resets all the signatures for inputs (in further versions,
SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).

**Params**

- address `string` | `Address`  
- amount `number` - in satoshis  

**Returns**: [Transaction](#Transaction) - this, for chaining  
<a name="Transaction#addData"></a>
##transaction.addData(value)
Add an OP_RETURN output to the transaction.

Beware that this resets all the signatures for inputs (in further versions,
SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).

**Params**

- value `Buffer` | `string` - the data to be stored in the OP_RETURN output.
   In case of a string, the UTF-8 representation will be stored  

**Returns**: [Transaction](#Transaction) - this, for chaining  
<a name="Transaction#sign"></a>
##transaction.sign(privateKey, sigtype)
Sign the transaction using one or more private keys.

It tries to sign each input, verifying that the signature will be valid
(matches a public key).

**Params**

- privateKey `Array` | `String` | `PrivateKey`  
- sigtype `number`  

**Returns**: [Transaction](#Transaction) - this, for chaining  
<a name="Transaction#applySignature"></a>
##transaction.applySignature(signature)
Add a signature to the transaction

**Params**

- signature `Object`  
  - inputIndex `number`  
  - sighash `number`  
  - publicKey `PublicKey`  
  - signature `Signature`  

**Returns**: [Transaction](#Transaction) - this, for chaining  
<a name="Transaction#verifySignature"></a>
##transaction.verifySignature()
**Returns**: `bool` - whether the signature is valid for this transaction input  
<a name="Transaction#verify"></a>
##transaction.verify()
Check that a transaction passes basic sanity tests. If not, return a string
describing the error. This function contains the same logic as
CheckTransaction in bitcoin core.

<a name="Transaction#isCoinbase"></a>
##transaction.isCoinbase()
Analagous to bitcoind's IsCoinBase function in transaction.h

