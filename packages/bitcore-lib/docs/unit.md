# Unit

Unit is a utility for handling and converting bitcoin units. We strongly recommend to always use satoshis to represent amount inside your application and only convert them to other units in the front-end.

To understand the need of using the `Unit` class when dealing with unit conversions, see this example:

```javascript
> 81.99 * 100000 // wrong
8198999.999999999
> var bitcore = require('bitcore');
> var Unit = bitcore.Unit;
> Unit.fromMilis(81.99).toSatoshis() // correct
8199000
```

## Supported units

The supported units are BTC, mBTC, bits (micro BTCs, uBTC) and satoshis. The codes for each unit can be found as members of the Unit class.

```javascript
var btcCode = Unit.BTC;
var mbtcCode = Unit.mBTC;
var ubtcCode = Unit.uBTC;
var bitsCode = Unit.bits;
var satsCode = Unit.satoshis;
```

## Creating units

There are two ways for creating a unit instance. You can instantiate the class using a value and a unit code; alternatively if the unit it's fixed you could you some of the static methods. Check some examples below:

```javascript
var unit;
var amount = 100;

// using a unit code
var unitPreference = Unit.BTC;
unit = new Unit(amount, unitPreference);

// using a known unit
unit = Unit.fromBTC(amount);
unit = Unit.fromMilis(amount);
unit = Unit.fromBits(amount);
unit = Unit.fromSatoshis(amount);
```

## Conversion

Once you have a unit instance, you can check its representation in all the available units. For your convenience the classes expose three ways to accomplish this. Using the `.to(unitCode)` method, using a fixed unit like `.toSatoshis()` or by using the accessors.

```javascript
var unit;

// using a unit code
var unitPreference = Unit.BTC;
value = Unit.fromSatoshis(amount).to(unitPreference);

// using a known unit
value = Unit.fromBTC(amount).toBTC();
value = Unit.fromBTC(amount).toMilis();
value = Unit.fromBTC(amount).toBits();
value = Unit.fromBTC(amount).toSatoshis();

// using accessors
value = Unit.fromBTC(amount).BTC;
value = Unit.fromBTC(amount).mBTC;
value = Unit.fromBTC(amount).bits;
value = Unit.fromBTC(amount).satoshis;
```

## Using a fiat currency

The unit class also provides a convenient alternative to create an instance from a fiat amount and the corresponding BTC/fiat exchange rate. Any unit instance can be converted to a fiat amount by providing the current exchange rate. Check the example below:

```javascript
var unit, fiat;
var amount = 100;
var exchangeRate = 350;

unit = new Unit(amount, exchangeRate);
unit = Unit.fromFiat(amount, exchangeRate);

fiat = Unit.fromBits(amount).atRate(exchangeRate);
fiat = Unit.fromBits(amount).to(exchangeRate);
```
