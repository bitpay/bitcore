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
requireWhenAccessed('buffertools', 'buffertools');
requireWhenAccessed('config', './config');
requireWhenAccessed('const', './const');
requireWhenAccessed('Deserialize', './Deserialize');
requireWhenAccessed('log', './util/log');
requireWhenAccessed('networks', './networks');
requireWhenAccessed('util', './util/util');
requireWhenAccessed('EncodedData', './util/EncodedData');
requireWhenAccessed('VersionedData', './util/VersionedData');
requireWhenAccessed('Address', './Address');
requireWhenAccessed('Opcode', './Opcode');
requireWhenAccessed('Script', './Script');
requireWhenAccessed('Transaction', './Transaction');
requireWhenAccessed('Connection', './Connection');
requireWhenAccessed('Peer', './Peer');
requireWhenAccessed('Block', './Block');
requireWhenAccessed('ScriptInterpreter', './ScriptInterpreter');
requireWhenAccessed('Bloom', './Bloom');
requireWhenAccessed('Key', './Key');
requireWhenAccessed('SINKey', './SINKey');
requireWhenAccessed('SIN', './SIN');
requireWhenAccessed('PrivateKey', './PrivateKey');
requireWhenAccessed('RpcClient', './RpcClient');
requireWhenAccessed('Wallet', './Wallet');
requireWhenAccessed('WalletKey', './WalletKey');
requireWhenAccessed('PeerManager', './PeerManager');
module.exports.Buffer = Buffer;

if (typeof process.versions === 'undefined') {
  // Browser specific
  module.exports.bignum.config({EXPONENTIAL_AT: 9999999, DECIMAL_PLACES: 0, ROUNDING_MODE: 1});
}

