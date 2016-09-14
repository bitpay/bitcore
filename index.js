'use strict';

var litecore = module.exports;

// module information
litecore.version = 'v' + require('./package.json').version;
litecore.versionGuard = function(version) {
  if (version !== undefined) {
    var message = 'More than one instance of litecore-lib found. ' +
      'Please make sure to require litecore-lib and check that submodules do' +
      ' not also include their own litecore-lib dependency.';
    throw new Error(message);
  }
};
litecore.versionGuard(global._litecore);
global._litecore = litecore.version;

// crypto
litecore.crypto = {};
litecore.crypto.BN = require('./lib/crypto/bn');
litecore.crypto.ECDSA = require('./lib/crypto/ecdsa');
litecore.crypto.Hash = require('./lib/crypto/hash');
litecore.crypto.Random = require('./lib/crypto/random');
litecore.crypto.Point = require('./lib/crypto/point');
litecore.crypto.Signature = require('./lib/crypto/signature');

// encoding
litecore.encoding = {};
litecore.encoding.Base58 = require('./lib/encoding/base58');
litecore.encoding.Base58Check = require('./lib/encoding/base58check');
litecore.encoding.BufferReader = require('./lib/encoding/bufferreader');
litecore.encoding.BufferWriter = require('./lib/encoding/bufferwriter');
litecore.encoding.Varint = require('./lib/encoding/varint');

// utilities
litecore.util = {};
litecore.util.buffer = require('./lib/util/buffer');
litecore.util.js = require('./lib/util/js');
litecore.util.preconditions = require('./lib/util/preconditions');

// errors thrown by the library
litecore.errors = require('./lib/errors');

// main bitcoin library
litecore.Address = require('./lib/address');
litecore.Block = require('./lib/block');
litecore.MerkleBlock = require('./lib/block/merkleblock');
litecore.BlockHeader = require('./lib/block/blockheader');
litecore.HDPrivateKey = require('./lib/hdprivatekey.js');
litecore.HDPublicKey = require('./lib/hdpublickey.js');
litecore.Networks = require('./lib/networks');
litecore.Opcode = require('./lib/opcode');
litecore.PrivateKey = require('./lib/privatekey');
litecore.PublicKey = require('./lib/publickey');
litecore.Script = require('./lib/script');
litecore.Transaction = require('./lib/transaction');
litecore.URI = require('./lib/uri');
litecore.Unit = require('./lib/unit');

// dependencies, subject to change
litecore.deps = {};
litecore.deps.bnjs = require('bn.js');
litecore.deps.bs58 = require('bs58');
litecore.deps.Buffer = Buffer;
litecore.deps.elliptic = require('elliptic');
litecore.deps.scryptsy = require('scryptsy');
litecore.deps._ = require('lodash');

// Internal usage, exposed for testing/advanced tweaking
litecore._HDKeyCache = require('./lib/hdkeycache');
litecore.Transaction.sighash = require('./lib/transaction/sighash');
