var Key = require('../lib/Key');
var Address = require('../lib/Address');
var k = new Key();

//k.public = new Buffer('92eea4d2f5263651db9e3222caded1fd4c89772f79a7c03fb6afc00e9d2c9d2ed9b86c2c95fc1171e49163079dacb7f048b3c509a27a490e1df9e7128362d468', 'hex');
//k.public = new Buffer('0492eea4d2f5263651db9e3222caded1fd4c89772f79a7c03fb6afc00e9d2c9d2ed9b86c2c95fc1171e49163079dacb7f048b3c509a27a490e1df9e7128362d468', 'hex');
//k.public = new Buffer('0478d430274f8c5ec1321338151e9f27f4c676a008bdf8638d07c0b6be9ab35c71a1518063243acd4dfe96b66e3f2ec8013c8e072cd09b3834a19f81f659cc3455', 'hex');
//k.generatePubKey();
//debugger;
//console.log(k);

var Electrum = require('../lib/Electrum');
//92eea4d2f5263651db9e3222caded1fd4c89772f79a7c03fb6afc00e9d2c9d2ed9b86c2c95fc1171e49163079dacb7f048b3c509a27a490e1df9e7128362d468
var mpk = '92eea4d2f5263651db9e3222caded1fd4c89772f79a7c03fb6afc00e9d2c9d2ed9b86c2c95fc1171e49163079dacb7f048b3c509a27a490e1df9e7128362d468';
mpk = new Electrum(mpk);

var key1 = mpk.generatePubKey(0);
var addr1 = Address.fromPubKey(key1);

console.log(addr1.as('base58'));
