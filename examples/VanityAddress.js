'use strict';


var run = function() {
  // Replace '../bitcore' with 'bitcore' if you use this code elsewhere.
  var bitcore = require('../bitcore');
  var Key = bitcore.Key;
  var Address = bitcore.Address;

  // config your regular expression
  var re = /[0-9]{6}$/; // ends in 6 digits

  var a, k, m;
  while (true) {
    k = Key.generateSync();
    a = Address.fromKey(k);
    m = a.toString().match(re);
    if (m) break;
  }
  console.log('Address: ' + a.toString());
  console.log('Private Key: ' + k.private.toString('hex'));

};

module.exports.run = run;
if (require.main === module) {
  run();
}
