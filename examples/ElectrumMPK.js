var Electrum = require('../lib/Electrum');
var Address = require('../lib/Address');

var mpk = '92eea4d2f5263651db9e3222caded1fd4c89772f79a7c03fb6afc00e9d2c9d2ed9b86c2c95fc1171e49163079dacb7f048b3c509a27a490e1df9e7128362d468';

mpk = new Electrum(mpk);

var key0 = mpk.generatePubKey(0);
var addr0 = Address.fromPubKey(key0);

console.log(addr0.as('base58'));
