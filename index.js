var bitcore = module.exports;

// module information
bitcore.version = 'v' + require('./package.json').version;

var inBrowser = typeof process === 'undefined' || typeof process.versions === 'undefined';
if ((inBrowser && window._bitcore) || (!inBrowser && global._bitcore)) {
  var versions = bitcore.version + ' and ' + (inBrowser ? window._bitcore : global._bitcore);
  var message = 'More than one instance of bitcore found with different versions: ' + versions;
  if (inBrowser) {
    message += '. Make sure any scripts included don\'t contain their own bitcore bundle.';
  } else {
    message += '. Make sure there are no version conflicts between package.json files of your ' +
      'dependencies. This could also happen when a package depends on a git repository.';
  }

  throw new Error(message);
}
if (inBrowser) {
  window._bitcore = bitcore.version;
} else {
  global._bitcore = bitcore.version;
}

// crypto 
bitcore.crypto = {};
bitcore.crypto.BN = require('./lib/crypto/bn');
bitcore.crypto.ECDSA = require('./lib/crypto/ecdsa');
bitcore.crypto.Hash = require('./lib/crypto/hash');
bitcore.crypto.Random = require('./lib/crypto/random');
bitcore.crypto.Point = require('./lib/crypto/point');
bitcore.crypto.Signature = require('./lib/crypto/signature');

// encoding
bitcore.encoding = {};
bitcore.encoding.Base58 = require('./lib/encoding/base58');
bitcore.encoding.Base58Check = require('./lib/encoding/base58check');
bitcore.encoding.BufferReader = require('./lib/encoding/bufferreader');
bitcore.encoding.BufferWriter = require('./lib/encoding/bufferwriter');
bitcore.encoding.Varint = require('./lib/encoding/varint');

// utilities
bitcore.util = {};
bitcore.util.buffer = require('./lib/util/buffer');
bitcore.util.js = require('./lib/util/js');
bitcore.util.preconditions = require('./lib/util/preconditions');

// errors thrown by the library
bitcore.errors = require('./lib/errors');

// main bitcoin library
bitcore.Address = require('./lib/address');
bitcore.Block = require('./lib/block');
bitcore.MerkleBlock = require('./lib/block/merkleblock');
bitcore.BlockHeader = require('./lib/block/blockheader');
bitcore.HDPrivateKey = require('./lib/hdprivatekey.js');
bitcore.HDPublicKey = require('./lib/hdpublickey.js');
bitcore.Networks = require('./lib/networks');
bitcore.Opcode = require('./lib/opcode');
bitcore.PrivateKey = require('./lib/privatekey');
bitcore.PublicKey = require('./lib/publickey');
bitcore.Script = require('./lib/script');
bitcore.Transaction = require('./lib/transaction');
bitcore.URI = require('./lib/uri');
bitcore.Unit = require('./lib/unit');

// dependencies, subject to change
bitcore.deps = {};
bitcore.deps.bnjs = require('bn.js');
bitcore.deps.bs58 = require('bs58');
bitcore.deps.Buffer = Buffer;
bitcore.deps.elliptic = require('elliptic');
bitcore.deps._ = require('lodash');

// Internal usage, exposed for testing/advanced tweaking
bitcore._HDKeyCache = require('./lib/hdkeycache');
bitcore.Transaction.sighash = require('./lib/transaction/sighash');
