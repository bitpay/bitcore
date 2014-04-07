'use strict';

var run = function() {
  // Replace '../bitcore' with 'bitcore' if you use this code elsewhere.
  var bitcore = require('../bitcore');
  var Address = bitcore.Address;
  var coinUtil = bitcore.util;
  var Script = bitcore.Script;
  var network = bitcore.networks.testnet;

  var getAddrStr = function(s) {
    var addrStrs = [];
    var type = s.classify();
    var addr;

    switch (type) {
      case Script.TX_PUBKEY:
        var chunk = s.captureOne();
        addr = new Address(network.addressVersion, coinUtil.sha256ripe160(chunk));
        addrStrs.push(addr.toString());
        break;
      case Script.TX_PUBKEYHASH:
        addr = new Address(network.addressVersion, s.captureOne());
        addrStrs.push(addr.toString());
        break;
      case Script.TX_SCRIPTHASH:
        addr = new Address(network.P2SHVersion, s.captureOne());
        addrStrs.push(addr.toString());
        break;
      case Script.TX_MULTISIG:
        var chunks = s.capture();
        chunks.forEach(function(chunk) {
          var a = new Address(network.addressVersion, coinUtil.sha256ripe160(chunk));
          addrStrs.push(a.toString());
        });
        break;
      case Script.TX_UNKNOWN:
        console.log('tx type unkown');
        break;
    }
    return addrStrs;
  };

  var script = 'DUP HASH160 0x14 0x3744841e13b90b4aca16fe793a7f88da3a23cc71 EQUALVERIFY CHECKSIG';
  var s = Script.fromHumanReadable(script);
  console.log(getAddrStr(s)[0]); // mkZBYBiq6DNoQEKakpMJegyDbw2YiNQnHT
};

module.exports.run = run;
if (require.main === module) {
  run();
}
