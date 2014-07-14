'use strict';

var run = function() {
  // Replace '../bitcore' with 'bitcore' if you use this code elsewhere.
  var bitcore = require('../bitcore');
  var Address = bitcore.Address;
  var coinUtil = bitcore.util;
  var Script = bitcore.Script;
  var ScriptInterpreter = bitcore.ScriptInterpreter;
  var network = bitcore.networks.testnet;


  var scriptPubKeyHR = '0x14 0x3744841e13b90b4aca16fe793a7f88da3a23cc71 EQUAL';
  var scriptPubKey = Script.fromHumanReadable(scriptPubKeyHR);

  var scriptSigHR = '0x14 0x3744841e13b90b4aca16fe793a7f88da3a23cc71';
  var scriptSig = Script.fromHumanReadable(scriptSigHR);

  ScriptInterpreter.verifyFull(scriptSig, scriptPubKey, undefined, undefined,
    undefined, undefined, function(err, result) {
      console.log('script verified successfully? ', result)
    })
};

module.exports.run = run;
if (require.main === module) {
  run();
}
