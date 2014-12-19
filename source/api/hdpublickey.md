<a name="HDPublicKey"></a>
#class: HDPublicKey
**Members**

* [class: HDPublicKey](#HDPublicKey)
  * [new HDPublicKey(arg)](#new_HDPublicKey)
  * [hDPublicKey.derive(arg, hardened)](#HDPublicKey#derive)
  * [HDPublicKey.isValidSerialized(data, network)](#HDPublicKey.isValidSerialized)
  * [HDPublicKey.getSerializedError(data, network)](#HDPublicKey.getSerializedError)
  * [hDPublicKey._buildFromBuffers(arg)](#HDPublicKey#_buildFromBuffers)
  * [hDPublicKey.toString()](#HDPublicKey#toString)
  * [hDPublicKey.inspect()](#HDPublicKey#inspect)
  * [hDPublicKey.toObject()](#HDPublicKey#toObject)
  * [hDPublicKey.toJSON()](#HDPublicKey#toJSON)

<a name="new_HDPublicKey"></a>
##new HDPublicKey(arg)
The representation of an hierarchically derived public key.

See https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki

**Params**

- arg `Object` | `string` | `Buffer`  

<a name="HDPublicKey#derive"></a>
##hDPublicKey.derive(arg, hardened)
Get a derivated child based on a string or number.

If the first argument is a string, it's parsed as the full path of
derivation. Valid values for this argument include "m" (which returns the
same private key), "m/0/1/40/2/1000".

Note that hardened keys can't be derived from a public extended key.

If the first argument is a number, the child with that index will be
derived. See the example usage for clarification.

**Params**

- arg `string` | `number`  
- hardened `boolean`  

**Example**  
```javascript
var parent = new HDPublicKey('xpub...');
var child_0_1_2 = parent.derive(0).derive(1).derive(2);
var copy_of_child_0_1_2 = parent.derive("m/0/1/2");
assert(child_0_1_2.xprivkey === copy_of_child_0_1_2);
```

<a name="HDPublicKey.isValidSerialized"></a>
##HDPublicKey.isValidSerialized(data, network)
Verifies that a given serialized private key in base58 with checksum format
is valid.

**Params**

- data `string` | `Buffer` - the serialized private key  
- network `string` | `Network` - optional, if present, checks that the
    network provided matches the network serialized.  

**Returns**: `boolean`  
<a name="HDPublicKey.getSerializedError"></a>
##HDPublicKey.getSerializedError(data, network)
Checks what's the error that causes the validation of a serialized private key
in base58 with checksum to fail.

**Params**

- data `string` | `Buffer` - the serialized private key  
- network `string` | `Network` - optional, if present, checks that the
    network provided matches the network serialized.  

**Returns**: `errors` | `null`  
<a name="HDPublicKey#_buildFromBuffers"></a>
##hDPublicKey._buildFromBuffers(arg)
Receives a object with buffers in all the properties and populates the
internal structure

**Params**

- arg `Object`  
  - version `buffer.Buffer`  
  - depth `buffer.Buffer`  
  - parentFingerPrint `buffer.Buffer`  
  - childIndex `buffer.Buffer`  
  - chainCode `buffer.Buffer`  
  - publicKey `buffer.Buffer`  
  - checksum `buffer.Buffer`  
  - \[xpubkey\] `string` - if set, don't recalculate the base58
     representation  

**Returns**: [HDPublicKey](#HDPublicKey) - this  
<a name="HDPublicKey#toString"></a>
##hDPublicKey.toString()
Returns the base58 checked representation of the public key

**Returns**: `string` - a string starting with "xpub..." in livenet  
<a name="HDPublicKey#inspect"></a>
##hDPublicKey.inspect()
Returns the console representation of this extended public key.

**Returns**:  - string  
<a name="HDPublicKey#toObject"></a>
##hDPublicKey.toObject()
Returns a plain javascript object with information to reconstruct a key.

Fields are: <ul>
 <li> network: 'livenet' or 'testnet'
 <li> depth: a number from 0 to 255, the depth to the master extended key
 <li> fingerPrint: a number of 32 bits taken from the hash of the public key
 <li> fingerPrint: a number of 32 bits taken from the hash of this key's
 <li>     parent's public key
 <li> childIndex: index with which this key was derived
 <li> chainCode: string in hexa encoding used for derivation
 <li> publicKey: string, hexa encoded, in compressed key format
 <li> checksum: BufferUtil.integerFromBuffer(this._buffers.checksum),
 <li> xpubkey: the string with the base58 representation of this extended key
 <li> checksum: the base58 checksum of xpubkey
</ul>

<a name="HDPublicKey#toJSON"></a>
##hDPublicKey.toJSON()
Serializes this object into a JSON string

**Returns**: `string`  
