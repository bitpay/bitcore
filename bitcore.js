/* 
One way to require files is this simple way:
module.exports.Address = require('./Address');

However, that will load all classes in memory even if they are not used.
Instead, we can set the 'get' property of each class to only require them when
they are accessed, saving memory if they are not used in a given project.
*/
var requireWhenAccessed = function(name, file) {
  Object.defineProperty(module.exports, name, {
    get: function() {
      return require(file)
    }
  });
};

requireWhenAccessed('Bignum', 'bignum');
Object.defineProperty(module.exports, 'bignum', {
  get: function() {
    console.log('bignum (with a lower-case "b") is deprecated. Use bitcore.Bignum (capital "B") instead.');
    return require('bignum');
  }
});
requireWhenAccessed('Base58', './lib/Base58');
Object.defineProperty(module.exports, 'base58', {
  get: function() {
    console.log('base58 (with a lower-case "b") is deprecated. Use bitcore.Base58 (capital "B") instead.');
    return require('./lib/Base58');
  }
});
requireWhenAccessed('bufferput', 'bufferput');
requireWhenAccessed('buffertools', 'buffertools');
requireWhenAccessed('Buffers.monkey', './patches/Buffers.monkey');
requireWhenAccessed('config', './config');
requireWhenAccessed('const', './const');
requireWhenAccessed('Deserialize', './lib/Deserialize');
requireWhenAccessed('ECIES', './lib/ECIES');
requireWhenAccessed('log', './util/log');
requireWhenAccessed('networks', './networks');
requireWhenAccessed('SecureRandom', './lib/SecureRandom');
requireWhenAccessed('sjcl', './lib/sjcl');
requireWhenAccessed('util', './util/util');
requireWhenAccessed('EncodedData', './util/EncodedData');
requireWhenAccessed('VersionedData', './util/VersionedData');
requireWhenAccessed('BinaryParser', './util/BinaryParser');
requireWhenAccessed('Address', './lib/Address');
requireWhenAccessed('HierarchicalKey', './lib/HierarchicalKey');
Object.defineProperty(module.exports, 'BIP32', {
  get: function() {
    console.log('BIP32 is deprecated. Use bitcore.HierarchicalKey instead.');
    return require('./lib/HierarchicalKey');
  }
});
requireWhenAccessed('BIP39', './lib/BIP39');
requireWhenAccessed('BIP39WordlistEn', './lib/BIP39WordlistEn');
requireWhenAccessed('Point', './lib/Point');
requireWhenAccessed('Opcode', './lib/Opcode');
requireWhenAccessed('Script', './lib/Script');
requireWhenAccessed('Transaction', './lib/Transaction');
requireWhenAccessed('TransactionBuilder', './lib/TransactionBuilder');
requireWhenAccessed('Connection', './lib/Connection');
requireWhenAccessed('PayPro', './lib/PayPro');
requireWhenAccessed('Peer', './lib/Peer');
requireWhenAccessed('Block', './lib/Block');
requireWhenAccessed('ScriptInterpreter', './lib/ScriptInterpreter');
requireWhenAccessed('Bloom', './lib/Bloom');
requireWhenAccessed('Key', './lib/Key');
Object.defineProperty(module.exports, 'KeyModule', {
  get: function() {
    console.log('KeyModule is deprecated.');
    return require('bindings')('KeyModule');
  }
});
requireWhenAccessed('SINKey', './lib/SINKey');
requireWhenAccessed('SIN', './lib/SIN');
requireWhenAccessed('PrivateKey', './lib/PrivateKey');
requireWhenAccessed('RpcClient', './lib/RpcClient');
requireWhenAccessed('Wallet', './lib/Wallet');
requireWhenAccessed('WalletKey', './lib/WalletKey');
requireWhenAccessed('PeerManager', './lib/PeerManager');
requireWhenAccessed('Message', './lib/Message');
requireWhenAccessed('Electrum', './lib/Electrum');
requireWhenAccessed('Armory', './lib/Armory');
requireWhenAccessed('NetworkMonitor', './lib/NetworkMonitor');
module.exports.Buffer = Buffer;
