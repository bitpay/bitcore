<a name="Unit"></a>
#class: Unit
**Members**

* [class: Unit](#Unit)
  * [new Unit(amount, code)](#new_Unit)
  * [Unit.fromMicros](#Unit.fromMicros)
  * [unit.toMicros](#Unit#toMicros)
  * [Unit.fromJSON(json)](#Unit.fromJSON)
  * [Unit.fromBTC(amount)](#Unit.fromBTC)
  * [Unit.fromMilis(amount)](#Unit.fromMilis)
  * [Unit.fromSatoshis(amount)](#Unit.fromSatoshis)
  * [unit.to(code)](#Unit#to)
  * [unit.toBTC()](#Unit#toBTC)
  * [unit.toMilis()](#Unit#toMilis)
  * [unit.toSatoshis()](#Unit#toSatoshis)
  * [unit.toString()](#Unit#toString)
  * [unit.toObject()](#Unit#toObject)
  * [unit.inspect()](#Unit#inspect)

<a name="new_Unit"></a>
##new Unit(amount, code)
Bitcore Unit

Utility for handling and converting bitcoins units. The supported units are
BTC, mBTC, bits and satoshis. A unit instance can be created with an
amount and a unit code, or alternatively using static methods like {fromBTC}.
You can consult for different representation of a unit instance using it's
{to} method, the fixed unit methods like {toSatoshis} or alternatively using
the unit accessors.

**Params**

- amount `Number` - The amount to be represented  
- code `String` - The unit of the amount  

**Returns**: [Unit](#Unit) - A new instance of an Unit  
**Example**  
```javascript

var sats = Unit.fromBTC(1.3).toSatoshis();
var mili = Unit.fromBits(1.3).to(Unit.mBTC);
var btc = new Unit(1.3, Unit.bits).BTC;
```

<a name="Unit.fromMicros"></a>
##Unit.fromMicros
Will return a Unit instance created from an amount in bits

**Params**

- amount `Number` - The amount in bits  

**Returns**: [Unit](#Unit) - A Unit instance  
<a name="Unit#toMicros"></a>
##unit.toMicros
Will return the value represented in bits

**Returns**: `Number` - The value converted to bits  
<a name="Unit.fromJSON"></a>
##Unit.fromJSON(json)
Will return a Unit instance created from JSON string or object

**Params**

- json `String` | `Object` - JSON with keys: amount and code  

**Returns**: [Unit](#Unit) - A Unit instance  
<a name="Unit.fromBTC"></a>
##Unit.fromBTC(amount)
Will return a Unit instance created from an amount in BTC

**Params**

- amount `Number` - The amount in BTC  

**Returns**: [Unit](#Unit) - A Unit instance  
<a name="Unit.fromMilis"></a>
##Unit.fromMilis(amount)
Will return a Unit instance created from an amount in mBTC

**Params**

- amount `Number` - The amount in mBTC  

**Returns**: [Unit](#Unit) - A Unit instance  
<a name="Unit.fromSatoshis"></a>
##Unit.fromSatoshis(amount)
Will return a Unit instance created from an amount in satoshis

**Params**

- amount `Number` - The amount in satoshis  

**Returns**: [Unit](#Unit) - A Unit instance  
<a name="Unit#to"></a>
##unit.to(code)
Will return the value represented in the specified unit

**Params**

- code `string` - The unit code  

**Returns**: `Number` - The converted value  
<a name="Unit#toBTC"></a>
##unit.toBTC()
Will return the value represented in BTC

**Returns**: `Number` - The value converted to BTC  
<a name="Unit#toMilis"></a>
##unit.toMilis()
Will return the value represented in mBTC

**Returns**: `Number` - The value converted to mBTC  
<a name="Unit#toSatoshis"></a>
##unit.toSatoshis()
Will return the value represented in satoshis

**Returns**: `Number` - The value converted to satoshis  
<a name="Unit#toString"></a>
##unit.toString()
Will return a the string representation of the value in satoshis

**Returns**: `String` - the value in satoshis  
<a name="Unit#toObject"></a>
##unit.toObject()
Will return a plain object representation of the Unit

**Returns**: `Object` - An object with the keys: amount and code  
<a name="Unit#inspect"></a>
##unit.inspect()
Will return a string formatted for the console

**Returns**: `String` - the value in satoshis  
