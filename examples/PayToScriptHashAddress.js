var bitcore = require('../bitcore');
var Address = bitcore.Address;
var bitcoreUtil = bitcore.util;
var Script = bitcore.Script;
var network = bitcore.networks.livenet;


var script = ''; // write down your script here
var s = Script.fromHumanReadable(script);
var hash = bitcoreUtil.sha256ripe160(s.getBuffer());
var version = network.addressScript;

var addr = new Address(version, hash);
var addrStr = addr.as('base58');

// This outputs the "address" of thescript
console.log(addrStr);
