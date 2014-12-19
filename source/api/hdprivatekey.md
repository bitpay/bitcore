<a name="HDPrivateKey"></a>
#class: HDPrivateKey
**Members**

* [class: HDPrivateKey](#HDPrivateKey)
  * [new HDPrivateKey(arg)](#new_HDPrivateKey)
  * [hDPrivateKey.derive(arg, hardened)](#HDPrivateKey#derive)
  * [HDPrivateKey.isValidSerialized(data, network)](#HDPrivateKey.isValidSerialized)
  * [HDPrivateKey.getSerializedError(data, network)](#HDPrivateKey.getSerializedError)
  * [HDPrivateKey.fromSeed(hexa, network)](#HDPrivateKey.fromSeed)
  * [hDPrivateKey._buildFromBuffers(arg)](#HDPrivateKey#_buildFromBuffers)
  * [hDPrivateKey.toString()](#HDPrivateKey#toString)
  * [hDPrivateKey.inspect()](#HDPrivateKey#inspect)
  * [hDPrivateKey.toObject()](#HDPrivateKey#toObject)

<a name="new_HDPrivateKey"></a>
##new HDPrivateKey(arg)
Represents an instance of an hierarchically derived private key.

More info on https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki

**Params**

- arg `string` | `Buffer` | `Object`  

<a name="HDPrivateKey#derive"></a>
##hDPrivateKey.derive(arg, hardened)
Get a derivated child based on a string or number.

If the first argument is a string, it's parsed as the full path of
derivation. Valid values for this argument include "m" (which returns the
same private key), "m/0/1/40/2'/1000", where the ' quote means a hardened
derivation.

If the first argument is a number, the child with that index will be
derived. If the second argument is truthy, the hardened version will be
derived. See the example usage for clarification.

**Params**

- arg `string` | `number`  
- hardened `boolean`  

**Example**  
```javascript
var parent = new HDPrivateKey('xprv...');
var child_0_1_2h = parent.derive(0).derive(1).derive(2, true);
var copy_of_child_0_1_2h = parent.derive("m/0/1/2'");
assert(child_0_1_2h.xprivkey === copy_of_child_0_1_2h);
```

<a name="HDPrivateKey.isValidSerialized"></a>
##HDPrivateKey.isValidSerialized(data, network)
Verifies that a given serialized private key in base58 with checksum format
is valid.

**Params**

- data `string` | `Buffer` - the serialized private key  
- network `string` | `Network` - optional, if present, checks that the
    network provided matches the network serialized.  

**Returns**: `boolean`  
<a name="HDPrivateKey.getSerializedError"></a>
##HDPrivateKey.getSerializedError(data, network)
Checks what's the error that causes the validation of a serialized private key
in base58 with checksum to fail.

**Params**

- data `string` | `Buffer` - the serialized private key  
- network `string` | `Network` - optional, if present, checks that the
    network provided matches the network serialized.  

**Returns**: `errors.InvalidArgument` | `null`  
<a name="HDPrivateKey.fromSeed"></a>
##HDPrivateKey.fromSeed(hexa, network)
Generate a private key from a seed, as described in BIP32

**Params**

- hexa `string` | `Buffer`  
- network `*`  

**Returns**:  - HDPrivateKey  
<a name="HDPrivateKey#_buildFromBuffers"></a>
##hDPrivateKey._buildFromBuffers(arg)
Receives a object with buffers in all the properties and populates the
internal structure

**Params**

- arg `Object`  
  - version `buffer.Buffer`  
  - depth `buffer.Buffer`  
  - parentFingerPrint `buffer.Buffer`  
  - childIndex `buffer.Buffer`  
  - chainCode `buffer.Buffer`  
  - privateKey `buffer.Buffer`  
  - checksum `buffer.Buffer`  
  - \[xprivkey\] `string` - if set, don't recalculate the base58
     representation  

**Returns**: [HDPrivateKey](#HDPrivateKey) - this  
<a name="HDPrivateKey#toString"></a>
##hDPrivateKey.toString()
Returns the string representation of this private key (a string starting
with "xprv..."

**Returns**:  - string  
<a name="HDPrivateKey#inspect"></a>
##hDPrivateKey.inspect()
Returns the console representation of this extended private key.

**Returns**:  - string  
<a name="HDPrivateKey#toObject"></a>
##hDPrivateKey.toObject()
Returns a plain object with a representation of this private key.

Fields include:<ul>
<li> network: either 'livenet' or 'testnet'
<li> depth: a number ranging from 0 to 255
<li> fingerPrint: a number ranging from 0 to 2^32-1, taken from the hash of the
<li>     associated public key
<li> parentFingerPrint: a number ranging from 0 to 2^32-1, taken from the hash
<li>     of this parent's associated public key or zero.
<li> childIndex: the index from which this child was derived (or zero)
<li> chainCode: an hexa string representing a number used in the derivation
<li> privateKey: the private key associated, in hexa representation
<li> xprivkey: the representation of this extended private key in checksum
<li>     base58 format
<li> checksum: the base58 checksum of xprivkey
</ul>

**Returns**: `Object`  
