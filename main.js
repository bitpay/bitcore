//var Enc = require('./util/EncodedData').class();
//require('base58-native');

var bignum = require('bignum');

var b = bignum('782910138827292261791972728324982')
          .sub('182373273283402171237474774728373')
          .div(8);
console.log(b);

