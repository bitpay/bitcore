<a name="PublicKey"></a>
#class: PublicKey
**Members**

* [class: PublicKey](#PublicKey)
  * [new PublicKey(data, extra)](#new_PublicKey)
  * [PublicKey.fromDER](#PublicKey.fromDER)
  * [publicKey.toBuffer](#PublicKey#toBuffer)
  * [PublicKey.fromJSON(json)](#PublicKey.fromJSON)
  * [PublicKey.fromPrivateKey(privkey)](#PublicKey.fromPrivateKey)
  * [PublicKey.fromPoint(point, [compressed])](#PublicKey.fromPoint)
  * [PublicKey.fromString(str, [encoding])](#PublicKey.fromString)
  * [PublicKey.fromX(odd, x)](#PublicKey.fromX)
  * [PublicKey.getValidationError(data, [compressed])](#PublicKey.getValidationError)
  * [PublicKey.isValid(data, [compressed])](#PublicKey.isValid)
  * [publicKey.toObject()](#PublicKey#toObject)
  * [publicKey.toAddress()](#PublicKey#toAddress)
  * [publicKey.toString()](#PublicKey#toString)
  * [publicKey.inspect()](#PublicKey#inspect)

<a name="new_PublicKey"></a>
##new PublicKey(data, extra)
Instantiate a PublicKey from a 'PrivateKey', 'Point', 'string', 'Buffer'.

**Params**

- data `String` - The encoded data in various formats  
- extra `Object` - additional options  
  - \[network\] `Network` - Which network should the address for this public key be for  
  - \[compressed\] `String` - If the public key is compressed  

**Returns**: [PublicKey](#PublicKey) - A new valid instance of an PublicKey  
**Example**  
```javascript

// instantiate from a private key
var key = PublicKey(privateKey, true);

// export to as a DER hex encoded string
var exported = key.toString();

// import the public key
var imported = PublicKey.fromString(exported);
```

<a name="PublicKey.fromDER"></a>
##PublicKey.fromDER
Instantiate a PublicKey from a Buffer

**Params**

- buf `Buffer` - A DER hex buffer  
- \[strict\] `bool` - if set to false, will loosen some conditions  

**Returns**: [PublicKey](#PublicKey) - A new valid instance of PublicKey  
<a name="PublicKey#toBuffer"></a>
##publicKey.toBuffer
Will output the PublicKey to a DER Buffer

**Returns**: `Buffer` - A DER hex encoded buffer  
<a name="PublicKey.fromJSON"></a>
##PublicKey.fromJSON(json)
Instantiate a PublicKey from JSON

**Params**

- json `String` - A JSON string  

**Returns**: [PublicKey](#PublicKey) - A new valid instance of PublicKey  
<a name="PublicKey.fromPrivateKey"></a>
##PublicKey.fromPrivateKey(privkey)
Instantiate a PublicKey from a PrivateKey

**Params**

- privkey `PrivateKey` - An instance of PrivateKey  

**Returns**: [PublicKey](#PublicKey) - A new valid instance of PublicKey  
<a name="PublicKey.fromPoint"></a>
##PublicKey.fromPoint(point, [compressed])
Instantiate a PublicKey from a Point

**Params**

- point `Point` - A Point instance  
- \[compressed\] `boolean` - whether to store this public key as compressed format  

**Returns**: [PublicKey](#PublicKey) - A new valid instance of PublicKey  
<a name="PublicKey.fromString"></a>
##PublicKey.fromString(str, [encoding])
Instantiate a PublicKey from a DER hex encoded string

**Params**

- str `String` - A DER hex string  
- \[encoding\] `String` - The type of string encoding  

**Returns**: [PublicKey](#PublicKey) - A new valid instance of PublicKey  
<a name="PublicKey.fromX"></a>
##PublicKey.fromX(odd, x)
Instantiate a PublicKey from an X Point

**Params**

- odd `Boolean` - If the point is above or below the x axis  
- x `Point` - The x point  

**Returns**: [PublicKey](#PublicKey) - A new valid instance of PublicKey  
<a name="PublicKey.getValidationError"></a>
##PublicKey.getValidationError(data, [compressed])
Check if there would be any errors when initializing a PublicKey

**Params**

- data `String` - The encoded data in various formats  
- \[compressed\] `String` - If the public key is compressed  

**Returns**: `null` | `Error` - An error if exists  
<a name="PublicKey.isValid"></a>
##PublicKey.isValid(data, [compressed])
Check if the parameters are valid

**Params**

- data `String` - The encoded data in various formats  
- \[compressed\] `String` - If the public key is compressed  

**Returns**: `Boolean` - If the public key would be valid  
<a name="PublicKey#toObject"></a>
##publicKey.toObject()
**Returns**: `Object` - A plain object of the PublicKey  
<a name="PublicKey#toAddress"></a>
##publicKey.toAddress()
Will return an address for the public key

**Returns**: `Address` - An address generated from the public key  
<a name="PublicKey#toString"></a>
##publicKey.toString()
Will output the PublicKey to a DER encoded hex string

**Returns**: `String` - A DER hex encoded string  
<a name="PublicKey#inspect"></a>
##publicKey.inspect()
Will return a string formatted for the console

**Returns**: `String` - Public key  
