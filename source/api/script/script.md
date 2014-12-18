<a name="Script"></a>
#class: Script
**Members**

* [class: Script](#Script)
  * [new Script([from])](#new_Script)
  * [script.isPublicKeyHashOut()](#Script#isPublicKeyHashOut)
  * [script.isPublicKeyHashIn()](#Script#isPublicKeyHashIn)
  * [script.isPublicKeyOut()](#Script#isPublicKeyOut)
  * [script.isPublicKeyIn()](#Script#isPublicKeyIn)
  * [script.isScriptHashOut()](#Script#isScriptHashOut)
  * [script.isScriptHashIn()](#Script#isScriptHashIn)
  * [script.isMultisigOut()](#Script#isMultisigOut)
  * [script.isMultisigIn()](#Script#isMultisigIn)
  * [script.isDataOut()](#Script#isDataOut)
  * [script.isPushOnly()](#Script#isPushOnly)
  * [script.classify()](#Script#classify)
  * [script.isStandard()](#Script#isStandard)
  * [script.prepend(obj)](#Script#prepend)
  * [script.equals()](#Script#equals)
  * [script.add(obj)](#Script#add)
  * [Script.buildMultisigOut(publicKeys, threshold, [opts])](#Script.buildMultisigOut)
  * [Script.buildP2SHMultisigIn(pubkeys, threshold, signatures, [opts])](#Script.buildP2SHMultisigIn)
  * [Script.buildPublicKeyHashOut(to)](#Script.buildPublicKeyHashOut)
  * [Script.buildPublicKeyOut()](#Script.buildPublicKeyOut)
  * [Script.buildDataOut(to)](#Script.buildDataOut)
  * [Script.buildScriptHashOut(script)](#Script.buildScriptHashOut)
  * [Script.buildPublicKeyHashIn(publicKey, signature, [sigtype])](#Script.buildPublicKeyHashIn)
  * [Script.empty()](#Script.empty)
  * [script.toScriptHashOut()](#Script#toScriptHashOut)
  * [Script.fromAddress()](#Script.fromAddress)
  * [script.findAndDelete()](#Script#findAndDelete)
  * [script.checkMinimalPush()](#Script#checkMinimalPush)

<a name="new_Script"></a>
##new Script([from])
A bitcoin transaction script. Each transaction's inputs and outputs
has a script that is evaluated to validate it's spending.

See https://en.bitcoin.it/wiki/Script

**Params**

- \[from\] `Object` | `string` | `Buffer` - optional data to populate script  

<a name="Script#isPublicKeyHashOut"></a>
##script.isPublicKeyHashOut()
**Returns**:  - true if this is a pay to pubkey hash output script  
<a name="Script#isPublicKeyHashIn"></a>
##script.isPublicKeyHashIn()
**Returns**:  - true if this is a pay to public key hash input script  
<a name="Script#isPublicKeyOut"></a>
##script.isPublicKeyOut()
**Returns**:  - true if this is a public key output script  
<a name="Script#isPublicKeyIn"></a>
##script.isPublicKeyIn()
**Returns**:  - true if this is a pay to public key input script  
<a name="Script#isScriptHashOut"></a>
##script.isScriptHashOut()
**Returns**:  - true if this is a p2sh output script  
<a name="Script#isScriptHashIn"></a>
##script.isScriptHashIn()
**Returns**:  - true if this is a p2sh input script
Note that these are frequently indistinguishable from pubkeyhashin  
<a name="Script#isMultisigOut"></a>
##script.isMultisigOut()
**Returns**:  - true if this is a mutlsig output script  
<a name="Script#isMultisigIn"></a>
##script.isMultisigIn()
**Returns**:  - true if this is a multisig input script  
<a name="Script#isDataOut"></a>
##script.isDataOut()
**Returns**:  - true if this is an OP_RETURN data script  
<a name="Script#isPushOnly"></a>
##script.isPushOnly()
**Returns**:  - true if the script is only composed of data pushing
opcodes or small int opcodes (OP_0, OP_1, ..., OP_16)  
<a name="Script#classify"></a>
##script.classify()
**Returns**: `object` - The Script type if it is a known form,
or Script.UNKNOWN if it isn't  
<a name="Script#isStandard"></a>
##script.isStandard()
**Returns**:  - true if script is one of the known types  
<a name="Script#prepend"></a>
##script.prepend(obj)
Adds a script element at the start of the script.

**Params**

- obj `*` - a string, number, Opcode, Bufer, or object to add  

**Returns**: [Script](#Script) - this script instance  
<a name="Script#equals"></a>
##script.equals()
Compares a script with another script

<a name="Script#add"></a>
##script.add(obj)
Adds a script element to the end of the script.

**Params**

- obj `*` - a string, number, Opcode, Bufer, or object to add  

**Returns**: [Script](#Script) - this script instance  
<a name="Script.buildMultisigOut"></a>
##Script.buildMultisigOut(publicKeys, threshold, [opts])
**Params**

- publicKeys `Array.<PublicKey>` - list of all public keys controlling the output  
- threshold `number` - amount of required signatures to spend the output  
- \[opts\] `Object` - Several options:
       - noSorting: defaults to false, if true, don't sort the given
                     public keys before creating the script  

**Returns**:  - a new Multisig output script for given public keys,
requiring m of those public keys to spend  
<a name="Script.buildP2SHMultisigIn"></a>
##Script.buildP2SHMultisigIn(pubkeys, threshold, signatures, [opts])
A new P2SH Multisig input script for the given public keys, requiring m of those public keys to spend

**Params**

- pubkeys `Array.<PublicKey>` - list of all public keys controlling the output  
- threshold `number` - amount of required signatures to spend the output  
- signatures `Array` - signatures to append to the script  
- \[opts\] `Object`  
  - \[noSorting\] `boolean` - don't sort the given public keys before creating the script (false by default)  
  - \[cachedMultisig\] <code>[Script](#Script)</code> - don't recalculate the redeemScript  

**Returns**:  - Script  
<a name="Script.buildPublicKeyHashOut"></a>
##Script.buildPublicKeyHashOut(to)
**Params**

- to `Address` | `PublicKey` - destination address or public key  

**Returns**:  - a new pay to public key hash output for the given
address or public key  
<a name="Script.buildPublicKeyOut"></a>
##Script.buildPublicKeyOut()
**Returns**:  - a new pay to public key output for the given
 public key  
<a name="Script.buildDataOut"></a>
##Script.buildDataOut(to)
**Params**

- to `string` | `Buffer` - the data to embed in the output  

**Returns**:  - a new OP_RETURN script with data  
<a name="Script.buildScriptHashOut"></a>
##Script.buildScriptHashOut(script)
**Params**

- script <code>[Script](#Script)</code> | `Address` - the redeemScript for the new p2sh output.
   It can also be a p2sh address  

**Returns**:  - Script new pay to script hash script for given script  
<a name="Script.buildPublicKeyHashIn"></a>
##Script.buildPublicKeyHashIn(publicKey, signature, [sigtype])
Builds a scriptSig (a script for an input) that signs a public key hash
output script.

**Params**

- publicKey `Buffer` | `string` | `PublicKey`  
- signature `Signature` | `Buffer` - a Signature object, or the signature in DER cannonical encoding  
- \[sigtype\] `number` - the type of the signature (defaults to SIGHASH_ALL)  

<a name="Script.empty"></a>
##Script.empty()
**Returns**:  - Script an empty script  
<a name="Script#toScriptHashOut"></a>
##script.toScriptHashOut()
**Returns**:  - Script a new pay to script hash script that pays to this script  
<a name="Script.fromAddress"></a>
##Script.fromAddress()
**Returns**:  - Script a script built from the address  
<a name="Script#findAndDelete"></a>
##script.findAndDelete()
Analagous to bitcoind's FindAndDelete. Find and delete equivalent chunks,
typically used with push data chunks.  Note that this will find and delete
not just the same data, but the same data with the same push data op as
produced by default. i.e., if a pushdata in a tx does not use the minimal
pushdata op, then when you try to remove the data it is pushing, it will not
be removed, because they do not use the same pushdata op.

<a name="Script#checkMinimalPush"></a>
##script.checkMinimalPush()
**Returns**: `i` - true if the chunk  is the smallest way to push that particular data.
Comes from bitcoind's script interpreter CheckMinimalPush function  
