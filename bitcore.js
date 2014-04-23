/* 
One way to require files is this simple way:
module.exports.Address = require('./Address');

However, that will load all classes in memory even if they are not used.
Instead, we can set the 'get' property of each class to only require them when
they are accessed, saving memory if they are not used in a given project.
*/
var requireWhenAccessed = function(name, file) {
  Object.defineProperty(module.exports, name, {get: function() {return require(file)}});
};

requireWhenAccessed('bignum', 'bignum');
requireWhenAccessed('base58', 'base58-native');
requireWhenAccessed('bufferput', 'bufferput');
requireWhenAccessed('buffertools', 'buffertools');
requireWhenAccessed('Buffers.monkey', './patches/Buffers.monkey');
requireWhenAccessed('config', './config');
requireWhenAccessed('const', './const');
requireWhenAccessed('Deserialize', './lib/Deserialize');
requireWhenAccessed('log', './util/log');
requireWhenAccessed('networks', './networks');
requireWhenAccessed('SecureRandom', './lib/SecureRandom');
requireWhenAccessed('util', './util/util');
requireWhenAccessed('EncodedData', './util/EncodedData');
requireWhenAccessed('VersionedData', './util/VersionedData');
requireWhenAccessed('BinaryParser', './util/BinaryParser');
requireWhenAccessed('Address', './lib/Address');
requireWhenAccessed('BIP32', './lib/BIP32');
requireWhenAccessed('Point', './lib/Point');
requireWhenAccessed('Opcode', './lib/Opcode');
requireWhenAccessed('Script', './lib/Script');
requireWhenAccessed('Transaction', './lib/Transaction');
requireWhenAccessed('TransactionBuilder', './lib/TransactionBuilder');
requireWhenAccessed('Connection', './lib/Connection');
requireWhenAccessed('Peer', './lib/Peer');
requireWhenAccessed('Block', './lib/Block');
requireWhenAccessed('ScriptInterpreter', './lib/ScriptInterpreter');
requireWhenAccessed('Bloom', './lib/Bloom');
requireWhenAccessed('Key', './lib/Key');
Object.defineProperty(module.exports, 'KeyModule', {get: function() {
  console.log('KeyModule is deprecated.');
  return require('bindings')('KeyModule');
}});
requireWhenAccessed('SINKey', './lib/SINKey');
requireWhenAccessed('SIN', './lib/SIN');
requireWhenAccessed('PrivateKey', './lib/PrivateKey');
requireWhenAccessed('RpcClient', './lib/RpcClient');
requireWhenAccessed('Wallet', './lib/Wallet');
requireWhenAccessed('WalletKey', './lib/WalletKey');
requireWhenAccessed('PeerManager', './lib/PeerManager');
requireWhenAccessed('Message', './lib/Message');
requireWhenAccessed('Electrum', './lib/Electrum');
module.exports.Buffer = Buffer;

if (typeof process.versions === 'undefined') {
  // Browser specific
  module.exports.bignum.config({EXPONENTIAL_AT: 9999999, DECIMAL_PLACES: 0, ROUNDING_MODE: 1});
}

