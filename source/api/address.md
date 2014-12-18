<a name="Address"></a>
#class: Address
**Members**

* [class: Address](#Address)
  * [new Address(data, [network], [type])](#new_Address)
  * [Address.PayToPublicKeyHash](#Address.PayToPublicKeyHash)
  * [Address.PayToScriptHash](#Address.PayToScriptHash)
  * [Address.createMultisig(publicKeys, threshold, network)](#Address.createMultisig)
  * [Address.fromPublicKey(data, network)](#Address.fromPublicKey)
  * [Address.fromPublicKeyHash(hash, network)](#Address.fromPublicKeyHash)
  * [Address.fromScriptHash(hash, network)](#Address.fromScriptHash)
  * [Address.fromScript(script, network)](#Address.fromScript)
  * [Address.fromBuffer(buffer, [network], [type])](#Address.fromBuffer)
  * [Address.fromString(str, [network], [type])](#Address.fromString)
  * [Address.fromJSON(json)](#Address.fromJSON)
  * [Address.getValidationError(data, network, type)](#Address.getValidationError)
  * [Address.isValid(data, network, type)](#Address.isValid)
  * [address.isPayToPublicKeyHash()](#Address#isPayToPublicKeyHash)
  * [address.isPayToScriptHash()](#Address#isPayToScriptHash)
  * [address.toBuffer()](#Address#toBuffer)
  * [address.toObject()](#Address#toObject)
  * [address.toJSON()](#Address#toJSON)
  * [address.toString()](#Address#toString)
  * [address.inspect()](#Address#inspect)

<a name="new_Address"></a>
##new Address(data, [network], [type])
Instantiate an address from an address String or Buffer, a public key or script hash Buffer,
or an instance of `PublicKey` or `Script`.

This is an immutable class, and if the first parameter provided to this constructor is an
`Address` instance, the same argument will be returned.

An address has two key properties: `network` and `type`. The type is either
`Address.PayToPublicKeyHash` (value is the `'pubkeyhash'` string)
or `Address.PayToScriptHash` (the string `'scripthash'`). The network is an instance of `Network`.

**Params**

- data `*` - The encoded data in various formats  
- \[network\] `Network` | `String` | `number` - The network: 'livenet' or 'testnet'  
- \[type\] `String` - The type of address: 'script' or 'pubkey'  

**Returns**: [Address](#Address) - A new valid and frozen instance of an Address  
**Example**  
```javascript
// validate that an input field is valid
var error = Address.getValidationError(input, 'testnet');
if (!error) {
  var address = Address(input, 'testnet');
} else {
  // invalid network or checksum (typo?)
  var message = error.messsage;
}

// get an address from a public key
var address = Address(publicKey, 'testnet').toString();
```

<a name="Address.PayToPublicKeyHash"></a>
##Address.PayToPublicKeyHash
<a name="Address.PayToScriptHash"></a>
##Address.PayToScriptHash
<a name="Address.createMultisig"></a>
##Address.createMultisig(publicKeys, threshold, network)
Creates a P2SH address from a set of public keys and a threshold.

**Params**

- publicKeys `Array`  
- threshold `number`  
- network `Network`  

**Returns**: [Address](#Address)  
<a name="Address.fromPublicKey"></a>
##Address.fromPublicKey(data, network)
Instantiate an address from a PublicKey instance

**Params**

- data `PublicKey` - An instance of PublicKey  
- network `String` - The network: 'livenet' or 'testnet'  

**Returns**: [Address](#Address) - A new valid and frozen instance of an Address  
<a name="Address.fromPublicKeyHash"></a>
##Address.fromPublicKeyHash(hash, network)
Instantiate an address from a ripemd160 public key hash

**Params**

- hash `Buffer` - An instance of buffer of the hash  
- network `String` - The network: 'livenet' or 'testnet'  

**Returns**: [Address](#Address) - A new valid and frozen instance of an Address  
<a name="Address.fromScriptHash"></a>
##Address.fromScriptHash(hash, network)
Instantiate an address from a ripemd160 script hash

**Params**

- hash `Buffer` - An instance of buffer of the hash  
- network `String` - The network: 'livenet' or 'testnet'  

**Returns**: [Address](#Address) - A new valid and frozen instance of an Address  
<a name="Address.fromScript"></a>
##Address.fromScript(script, network)
Instantiate an address from a Script

**Params**

- script `Script` - An instance of Script  
- network `String` - The network: 'livenet' or 'testnet'  

**Returns**: [Address](#Address) - A new valid and frozen instance of an Address  
<a name="Address.fromBuffer"></a>
##Address.fromBuffer(buffer, [network], [type])
Instantiate an address from a buffer of the address

**Params**

- buffer `Buffer` - An instance of buffer of the address  
- \[network\] `String` - The network: 'livenet' or 'testnet'  
- \[type\] `String` - The type of address: 'script' or 'pubkey'  

**Returns**: [Address](#Address) - A new valid and frozen instance of an Address  
<a name="Address.fromString"></a>
##Address.fromString(str, [network], [type])
Instantiate an address from an address string

**Params**

- str `String` - An string of the bitcoin address  
- \[network\] `String` - The network: 'livenet' or 'testnet'  
- \[type\] `String` - The type of address: 'script' or 'pubkey'  

**Returns**: [Address](#Address) - A new valid and frozen instance of an Address  
<a name="Address.fromJSON"></a>
##Address.fromJSON(json)
Instantiate an address from JSON

**Params**

- json `String` - An JSON string or Object with keys: hash, network and type  

**Returns**: [Address](#Address) - A new valid instance of an Address  
<a name="Address.getValidationError"></a>
##Address.getValidationError(data, network, type)
Will return a validation error if exists

**Params**

- data `String` - The encoded data  
- network `String` - The network: 'livenet' or 'testnet'  
- type `String` - The type of address: 'script' or 'pubkey'  

**Returns**: `null` | `Error` - The corresponding error message  
**Example**  
```javascript

var error = Address.getValidationError('15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2', 'testnet');
// a network mismatch error
```

<a name="Address.isValid"></a>
##Address.isValid(data, network, type)
Will return a boolean if an address is valid

**Params**

- data `String` - The encoded data  
- network `String` - The network: 'livenet' or 'testnet'  
- type `String` - The type of address: 'script' or 'pubkey'  

**Returns**: `boolean` - The corresponding error message  
**Example**  
```javascript

var valid = Address.isValid('15vkcKf7gB23wLAnZLmbVuMiiVDc1Nm4a2', 'livenet');
// true
```

<a name="Address#isPayToPublicKeyHash"></a>
##address.isPayToPublicKeyHash()
Returns true if an address is of pay to public key hash type

**Returns**:  - boolean  
<a name="Address#isPayToScriptHash"></a>
##address.isPayToScriptHash()
Returns true if an address is of pay to script hash type

**Returns**:  - boolean  
<a name="Address#toBuffer"></a>
##address.toBuffer()
Will return a buffer representation of the address

**Returns**: `Buffer` - Bitcoin address buffer  
<a name="Address#toObject"></a>
##address.toObject()
**Returns**: `Object` - An object of the address  
<a name="Address#toJSON"></a>
##address.toJSON()
**Returns**: `Object` - An object of the address  
<a name="Address#toString"></a>
##address.toString()
Will return a the string representation of the address

**Returns**: `String` - Bitcoin address  
<a name="Address#inspect"></a>
##address.inspect()
Will return a string formatted for the console

**Returns**: `String` - Bitcoin address  
