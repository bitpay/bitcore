'use strict';

var dogecore = module.exports;

// module information
dogecore.version = 'v' + require('./package.json').version;
dogecore.versionGuard = function(version) {
  if (version !== undefined) {
    var message = 'More than one instance of dogecore found. ' +
      'Please make sure to require dogecore and check that submodules do' +
      ' not also include their own dogecore dependency.';
    throw new Error(message);
  }
};
dogecore.versionGuard(global._dogecore);
global._dogecore = dogecore.version;

// crypto
dogecore.crypto = {};
dogecore.crypto.BN = require('./lib/crypto/bn');
dogecore.crypto.ECDSA = require('./lib/crypto/ecdsa');
dogecore.crypto.Hash = require('./lib/crypto/hash');
dogecore.crypto.Random = require('./lib/crypto/random');
dogecore.crypto.Point = require('./lib/crypto/point');
dogecore.crypto.Signature = require('./lib/crypto/signature');

// encoding
dogecore.encoding = {};
dogecore.encoding.Base58 = require('./lib/encoding/base58');
dogecore.encoding.Base58Check = require('./lib/encoding/base58check');
dogecore.encoding.BufferReader = require('./lib/encoding/bufferreader');
dogecore.encoding.BufferWriter = require('./lib/encoding/bufferwriter');
dogecore.encoding.Varint = require('./lib/encoding/varint');

// utilities
dogecore.util = {};
dogecore.util.buffer = require('./lib/util/buffer');
dogecore.util.js = require('./lib/util/js');
dogecore.util.preconditions = require('./lib/util/preconditions');

// errors thrown by the library
dogecore.errors = require('./lib/errors');

// main bitcoin library
dogecore.Address = require('./lib/address');
dogecore.Block = require('./lib/block');
dogecore.MerkleBlock = require('./lib/block/merkleblock');
dogecore.BlockHeader = require('./lib/block/blockheader');
dogecore.HDPrivateKey = require('./lib/hdprivatekey.js');
dogecore.HDPublicKey = require('./lib/hdpublickey.js');
dogecore.Networks = require('./lib/networks');
dogecore.Opcode = require('./lib/opcode');
dogecore.PrivateKey = require('./lib/privatekey');
dogecore.PublicKey = require('./lib/publickey');
dogecore.Script = require('./lib/script');
dogecore.Transaction = require('./lib/transaction');
dogecore.URI = require('./lib/uri');
dogecore.Unit = require('./lib/unit');

// dependencies, subject to change
dogecore.deps = {};
dogecore.deps.bnjs = require('bn.js');
dogecore.deps.bs58 = require('bs58');
dogecore.deps.Buffer = Buffer;
dogecore.deps.elliptic = require('elliptic');
dogecore.deps.scryptsy = require('scryptsy');
dogecore.deps._ = require('lodash');

// Internal usage, exposed for testing/advanced tweaking
dogecore._HDKeyCache = require('./lib/hdkeycache');
dogecore.Transaction.sighash = require('./lib/transaction/sighash');
