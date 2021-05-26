'use strict';

var widecore = module.exports;

// module information
widecore.version = 'v' + require('./package.json').version;
widecore.versionGuard = function(version) {
  if (version !== undefined) {
    var message = 'More than one instance of widecore-lib found. ' +
      'Please make sure to require widecore-lib and check that submodules do' +
      ' not also include their own widecore-lib dependency.';
    throw new Error(message);
  }
};
widecore.versionGuard(global._widecore);
global._widecore = widecore.version;

// crypto
widecore.crypto = {};
widecore.crypto.BN = require('./lib/crypto/bn');
widecore.crypto.ECDSA = require('./lib/crypto/ecdsa');
widecore.crypto.Hash = require('./lib/crypto/hash');
widecore.crypto.Random = require('./lib/crypto/random');
widecore.crypto.Point = require('./lib/crypto/point');
widecore.crypto.Signature = require('./lib/crypto/signature');

// encoding
widecore.encoding = {};
widecore.encoding.Base58 = require('./lib/encoding/base58');
widecore.encoding.Base58Check = require('./lib/encoding/base58check');
widecore.encoding.BufferReader = require('./lib/encoding/bufferreader');
widecore.encoding.BufferWriter = require('./lib/encoding/bufferwriter');
widecore.encoding.Varint = require('./lib/encoding/varint');

// utilities
widecore.util = {};
widecore.util.buffer = require('./lib/util/buffer');
widecore.util.js = require('./lib/util/js');
widecore.util.preconditions = require('./lib/util/preconditions');

// errors thrown by the library
widecore.errors = require('./lib/errors');

// main bitcoin library
widecore.Address = require('./lib/address');
widecore.Block = require('./lib/block');
widecore.MerkleBlock = require('./lib/block/merkleblock');
widecore.BlockHeader = require('./lib/block/blockheader');
widecore.HDPrivateKey = require('./lib/hdprivatekey.js');
widecore.HDPublicKey = require('./lib/hdpublickey.js');
widecore.Message = require('./lib/message');
widecore.Networks = require('./lib/networks');
widecore.Opcode = require('./lib/opcode');
widecore.PrivateKey = require('./lib/privatekey');
widecore.PublicKey = require('./lib/publickey');
widecore.Script = require('./lib/script');
widecore.Transaction = require('./lib/transaction');
widecore.URI = require('./lib/uri');
widecore.Unit = require('./lib/unit');

// dependencies, subject to change
widecore.deps = {};
widecore.deps.bnjs = require('bn.js');
widecore.deps.bs58 = require('bs58');
widecore.deps.Buffer = Buffer;
widecore.deps.elliptic = require('elliptic');
widecore.deps._ = require('lodash');

// Internal usage, exposed for testing/advanced tweaking
widecore.Transaction.sighash = require('./lib/transaction/sighash');
