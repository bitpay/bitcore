<a name="Signing"></a>
#Signing
**Members**

* [Signing](#Signing)
  * [Signing.sighash](#Signing.sighash)
  * [Signing.sign](#Signing.sign)
  * [Signing.verify](#Signing.verify)

<a name="Signing.sighash"></a>
##Signing.sighash
Returns a buffer of length 32 bytes with the hash that needs to be signed
for OP_CHECKSIG.

**Params**

- transaction `Transaction` - the transaction to sign  
- sighashType `number` - the type of the hash  
- inputNumber `number` - the input index for the signature  
- subscript `Script` - the script that will be signed  

<a name="Signing.sign"></a>
##Signing.sign
Create a signature

**Params**

- transaction `Transaction`  
- privateKey `PrivateKey`  
- sighash `number`  
- inputIndex `number`  
- subscript `Script`  

**Returns**: `Signature`  
<a name="Signing.verify"></a>
##Signing.verify
Verify a signature

**Params**

- transaction `Transaction`  
- signature `Signature`  
- publicKey `PublicKey`  
- inputIndex `number`  
- subscript `Script`  

**Returns**: `boolean`  
