<a name="PrivateKey"></a>
#class: PrivateKey
**Members**

* [class: PrivateKey](#PrivateKey)
  * [new PrivateKey(data, [network])](#new_PrivateKey)
  * [PrivateKey.fromString](#PrivateKey.fromString)
  * [privateKey.toString](#PrivateKey#toString)
  * [PrivateKey.fromJSON(json)](#PrivateKey.fromJSON)
  * [PrivateKey.fromRandom([network])](#PrivateKey.fromRandom)
  * [PrivateKey.getValidationError(data, [network])](#PrivateKey.getValidationError)
  * [PrivateKey.isValid(data, [network])](#PrivateKey.isValid)
  * [privateKey.toBigNumber()](#PrivateKey#toBigNumber)
  * [privateKey.toBuffer()](#PrivateKey#toBuffer)
  * [privateKey.toPublicKey()](#PrivateKey#toPublicKey)
  * [privateKey.toAddress()](#PrivateKey#toAddress)
  * [privateKey.toObject()](#PrivateKey#toObject)
  * [privateKey.inspect()](#PrivateKey#inspect)

<a name="new_PrivateKey"></a>
##new PrivateKey(data, [network])
Instantiate a PrivateKey from a BN, Buffer and WIF.

**Params**

- data `String` - The encoded data in various formats  
- \[network\] `String` - Either "livenet" or "testnet"  

**Returns**: [PrivateKey](#PrivateKey) - A new valid instance of an PrivateKey  
**Example**  
```javascript

// generate a new random key
var key = PrivateKey();

// get the associated address
var address = key.toAddress();

// encode into wallet export format
var exported = key.toWIF();

// instantiate from the exported (and saved) private key
var imported = PrivateKey.fromWIF(exported);
```

<a name="PrivateKey.fromString"></a>
##PrivateKey.fromString
Instantiate a PrivateKey from a WIF string

**Params**

- str `String` - The WIF encoded private key string  

**Returns**: [PrivateKey](#PrivateKey) - A new valid instance of PrivateKey  
<a name="PrivateKey#toString"></a>
##privateKey.toString
Will output the PrivateKey to a WIF string

**Returns**: `String` - A WIP representation of the private key  
<a name="PrivateKey.fromJSON"></a>
##PrivateKey.fromJSON(json)
Instantiate a PrivateKey from a JSON string

**Params**

- json `String` - The JSON encoded private key string  

**Returns**: [PrivateKey](#PrivateKey) - A new valid instance of PrivateKey  
<a name="PrivateKey.fromRandom"></a>
##PrivateKey.fromRandom([network])
Instantiate a PrivateKey from random bytes

**Params**

- \[network\] `String` - Either "livenet" or "testnet"  

**Returns**: [PrivateKey](#PrivateKey) - A new valid instance of PrivateKey  
<a name="PrivateKey.getValidationError"></a>
##PrivateKey.getValidationError(data, [network])
Check if there would be any errors when initializing a PrivateKey

**Params**

- data `String` - The encoded data in various formats  
- \[network\] `String` - Either "livenet" or "testnet"  

**Returns**: `null` | `Error` - An error if exists  
<a name="PrivateKey.isValid"></a>
##PrivateKey.isValid(data, [network])
Check if the parameters are valid

**Params**

- data `String` - The encoded data in various formats  
- \[network\] `String` - Either "livenet" or "testnet"  

**Returns**: `Boolean` - If the private key is would be valid  
<a name="PrivateKey#toBigNumber"></a>
##privateKey.toBigNumber()
Will return the private key as a BN instance

**Returns**: `BN` - A BN instance of the private key  
<a name="PrivateKey#toBuffer"></a>
##privateKey.toBuffer()
Will return the private key as a BN buffer

**Returns**: `Buffer` - A buffer of the private key  
<a name="PrivateKey#toPublicKey"></a>
##privateKey.toPublicKey()
Will return the corresponding public key

**Returns**: `PublicKey` - A public key generated from the private key  
<a name="PrivateKey#toAddress"></a>
##privateKey.toAddress()
Will return an address for the private key

**Returns**: `Address` - An address generated from the private key  
<a name="PrivateKey#toObject"></a>
##privateKey.toObject()
**Returns**: `Object` - A plain object representation  
<a name="PrivateKey#inspect"></a>
##privateKey.inspect()
Will return a string formatted for the console

**Returns**: `String` - Private key  
