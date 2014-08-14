'use strict';

var run = function() {
  // Replace '../bitcore' with 'bitcore' if you use this code elsewhere.
  var bitcore = require('../bitcore');
  var Address = bitcore.Address;
  var coinUtil = bitcore.util;
  var Script = bitcore.Script;
  var network = bitcore.networks.testnet;

  var script = 'OP_RETURN 58434c524e4748530000000000000000000000010000000005f5e100';
  var s = Script.fromHumanReadable(script);
  var result = (s.classify() == Script.TX_RETURN)
  console.log("Is op_return:", result); 
};

module.exports.run = run;
if (require.main === module) {
  run();
}
