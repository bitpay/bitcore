//var Enc = require('./util/EncodedData').class();

var bignum = require('bignum');
bignum.config({EXPONENTIAL_AT: 9999999, DECIMAL_PLACES: 0, ROUNDING_MODE: 1});
console.log(bignum('9832087987979879879879879879879879879879879879').toString());
var b = bignum('782910138827292261791972728324982')
          .sub('182373273283402171237474774728373')
          .div(8);
console.log(b.toString());


var base58 = require('base58-native');
var m = 'mqqa8xSMVDyf9QxihGnPtap6Mh6qemUkcu';
var d = base58.decode(m);
var m2 = base58.encode(d);
console.log(m);
console.log(d);
console.log(m2);

var m = base58.encode(base58.decode('mqqa8xSMVDyf9QxihGnPtap6Mh6qemUkcu'));

var base58Check = require('base58-native').base58Check;
console.log(base58Check.encode(base58Check.decode('mqqa8xSMVDyf9QxihGnPtap6Mh6qemUkcu')));
