var bitcore = module.exports;

// protocol
bitcore.Constants = require('./lib/protocol/constants');
bitcore.Base58 = require('./lib/protocol/base58');
bitcore.Base58Check = require('./lib/protocol/base58check');
bitcore.BufferReader = require('./lib/protocol/bufferreader');
bitcore.BufferWriter = require('./lib/protocol/bufferwriter');

// crypto 
bitcore.BN = require('./lib/crypto/bn');
bitcore.KDF = require('./lib/crypto/kdf');
bitcore.ECDSA = require('./lib/crypto/ecdsa');
bitcore.Hash = require('./lib/crypto/hash');
bitcore.Random = require('./lib/crypto/random');
bitcore.Point = require('./lib/crypto/point');

// main bitcoin library
bitcore.Address = require('./lib/address');
bitcore.BIP32 = require('./lib/bip32');
bitcore.Block = require('./lib/block');
bitcore.Blockheader = require('./lib/blockheader');
bitcore.Keypair = require('./lib/keypair');
bitcore.Opcode = require('./lib/opcode');
bitcore.Privkey = require('./lib/privkey');
bitcore.Pubkey = require('./lib/pubkey');
bitcore.Script = require('./lib/script');
bitcore.Signature = require('./lib/signature');
bitcore.Transaction = require('./lib/transaction');
bitcore.Txin = require('./lib/txin');
bitcore.Txout = require('./lib/txout');
bitcore.Varint = require('./lib/varint');


//dependencies, subject to change
bitcore.deps = {};
bitcore.deps.aes = require('aes');
bitcore.deps.bnjs = require('bn.js');
bitcore.deps.bs58 = require('bs58');
bitcore.deps.Buffer = Buffer;
bitcore.deps.elliptic = require('elliptic');
bitcore.deps.hashjs = require('hash.js');
bitcore.deps.sha512 = require('sha512');

//bitcore.scriptexec = require('lib/scriptexec');
//bitcore.tx = require('lib/tx');
//bitcore.txpartial = require('lib/txpartial');

//bitcore.bip70 = require('lib/bip70');
