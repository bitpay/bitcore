/*
 * Bitcore bindings for the browser
 */


module.exports.bignum = require('bignum');
module.exports.base58 = require('base58-native');
module.exports.buffertools = require('buffertools');
module.exports.config = require('./config');
module.exports.const = require('./const');
module.exports.Deserialize = require('./Deserialize');
module.exports.log = require('./util/log');
module.exports.networks = require('./networks');
module.exports.util = require('./util/util');
module.exports.EncodedData = require('./util/EncodedData');
module.exports.VersionedData = require('./util/VersionedData');
module.exports.Address = require('./Address');
module.exports.Opcode = require('./Opcode');
module.exports.Script = require('./Script');
module.exports.Transaction = require('./Transaction');
module.exports.Peer = require('./Peer');
module.exports.PeerManager = require('./PeerManager');
module.exports.Block = require('./Block');
module.exports.Connection = require('./Connection');
module.exports.ScriptInterpreter = require('./ScriptInterpreter');
module.exports.Bloom = require('./Bloom');
module.exports.KeyModule = require('./Key');
module.exports.SINKey = require('./SINKey');
module.exports.SIN = require('./SIN');
module.exports.PrivateKey = require('./PrivateKey');
module.exports.RpcClient = require('./RpcClient');
module.exports.Wallet = require('./Wallet');
module.exports.WalletKey = require('./WalletKey');
module.exports.Buffer = Buffer;

if (typeof process.versions === 'undefined') {
  module.exports.bignum.config({EXPONENTIAL_AT: 9999999, DECIMAL_PLACES: 0, ROUNDING_MODE: 1});
}

