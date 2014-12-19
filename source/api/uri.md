<a name="URI"></a>
#class: URI
**Members**

* [class: URI](#URI)
  * [new URI(data, [knownParams])](#new_URI)
  * [URI.fromString(str)](#URI.fromString)
  * [URI.fromJSON(json)](#URI.fromJSON)
  * [URI.isValid(data, [knownParams])](#URI.isValid)
  * [URI.parse(uri)](#URI.parse)
  * [uRI._fromObject(obj)](#URI#_fromObject)
  * [uRI._parseAmount(amount)](#URI#_parseAmount)
  * [uRI.toString()](#URI#toString)
  * [uRI.inspect()](#URI#inspect)

<a name="new_URI"></a>
##new URI(data, [knownParams])
Bitcore URI

Instantiate an URI from a bitcoin URI String or an Object. An URI instance
can be created with a bitcoin uri string or an object. All instances of
URI are valid, the static method isValid allows checking before instanciation.

All standard parameters can be found as members of the class, the address
is represented using an {Address} instance and the amount is represented in
satoshis. Any other non-standard parameters can be found under the extra member.

**Params**

- data `string` | `Object` - A bitcoin URI string or an Object  
- \[knownParams\] `Array.<string>` - Required non-standard params  

**Type**: `TypeError`  
**Returns**: [URI](#URI) - A new valid and frozen instance of URI  
**Example**  
```javascript

var uri = new URI('bitcoin:12A1MyfXbW6RhdRAZEqofac5jCQQjwEPBu?amount=1.2');
console.log(uri.address, uri.amount);
```

<a name="URI.fromString"></a>
##URI.fromString(str)
Instantiate a URI from a String

**Params**

- str `String` - JSON string or object of the URI  

**Returns**: [URI](#URI) - A new instance of a URI  
<a name="URI.fromJSON"></a>
##URI.fromJSON(json)
Instantiate a URI from JSON

**Params**

- json `String` | `Object` - JSON string or object of the URI  

**Returns**: [URI](#URI) - A new instance of a URI  
<a name="URI.isValid"></a>
##URI.isValid(data, [knownParams])
Check if an bitcoin URI string is valid

**Params**

- data `string` | `Object` - A bitcoin URI string or an Object  
- \[knownParams\] `Array.<string>` - Required non-standard params  

**Returns**: `boolean` - Result of uri validation  
**Example**  
```javascript

var valid = URI.isValid('bitcoin:12A1MyfXbW6RhdRAZEqofac5jCQQjwEPBu');
// true
```

<a name="URI.parse"></a>
##URI.parse(uri)
Convert a bitcoin URI string into a simple object.

**Params**

- uri `string` - A bitcoin URI string  

**Type**: `TypeError`  
**Returns**: `Object` - An object with the parsed params  
<a name="URI#_fromObject"></a>
##uRI._fromObject(obj)
Internal function to load the URI instance with an object.

**Params**

- obj `Object` - Object with the information  

**Type**: `TypeError`  
<a name="URI#_parseAmount"></a>
##uRI._parseAmount(amount)
Internal function to transform a BTC string amount into satoshis

**Params**

- amount `String` - Amount BTC string  

**Type**: `TypeError`  
**Returns**: `Object` - Amount represented in satoshis  
<a name="URI#toString"></a>
##uRI.toString()
Will return a the string representation of the URI

**Returns**: `String` - Bitcoin URI string  
<a name="URI#inspect"></a>
##uRI.inspect()
Will return a string formatted for the console

**Returns**: `String` - Bitcoin URI  
