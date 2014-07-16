'use strict';

var run = function() {
  // Replace '../bitcore' with 'bitcore' if you use this code elsewhere.
  var bitcore = require('../bitcore');
  var Address = bitcore.Address;
  var coinUtil = bitcore.util;
  var Script = bitcore.Script;
  var ScriptInterpreter = bitcore.ScriptInterpreter;
  var network = bitcore.networks.testnet;


  // using "static" method
  var scriptPubKeyHR = '0x14 0x3744841e13b90b4aca16fe793a7f88da3a23cc71 EQUAL';
  var scriptPubKey = Script.fromHumanReadable(scriptPubKeyHR);

  var scriptSigHR = '0x14 0x3744841e13b90b4aca16fe793a7f88da3a23cc71';
  var scriptSig = Script.fromHumanReadable(scriptSigHR);

  ScriptInterpreter.verifyFull(scriptSig, scriptPubKey, undefined, undefined,
    undefined, undefined, function(err, result) {
      console.log('script verified successfully? ', result)
  });

  // using an instance
  scriptPubKeyHR = '0x26 0x554e5a49500370e53982a1d5201829562c5d9eebf256eb755b92c9b1449afd99f9f8c3265631 DROP HASH256 0x20 0x34b4f6042e1bcfc6182ee2727a3d0069a9071385bc07b318f57e77a28ffa13ac EQUAL';
  scriptPubKey = Script.fromHumanReadable(scriptPubKeyHR);

  scriptSigHR = '0x41 0x0470e53982a1d5201829562c5d9eebf256eb755b92c9b1449afd99f9f8c3265631142f3bf6954e3bec4bdad1a1a197bf90904a1e6f06c209eb477e2fde00d26691';
  scriptSig = Script.fromHumanReadable(scriptSigHR);

  var si = new ScriptInterpreter();
  si.verifyFull(scriptSig, scriptPubKey, undefined, undefined,
    undefined, function(err, result) {
      console.log('script verified successfully? ', result)
  });
};

module.exports.run = run;
if (require.main === module) {
  run();
}
