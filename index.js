var bitcore = module.exports;


// crypto 
bitcore.crypto = {};
bitcore.crypto.BN = require('./lib/crypto/bn');
bitcore.crypto.ECDSA = require('./lib/crypto/ecdsa');
bitcore.crypto.Hash = require('./lib/crypto/hash');
bitcore.crypto.Random = require('./lib/crypto/random');
bitcore.crypto.Point = require('./lib/crypto/point');

// encoding
bitcore.encoding = {};
bitcore.encoding.Base58 = require('./lib/encoding/base58');
bitcore.encoding.Base58Check = require('./lib/encoding/base58check');
bitcore.encoding.BufferReader = require('./lib/encoding/bufferreader');
bitcore.encoding.BufferWriter = require('./lib/encoding/bufferwriter');
bitcore.encoding.Varint = require('./lib/encoding/varint');

// main bitcoin library
bitcore.Address = require('./lib/address');
bitcore.BIP32 = require('./lib/bip32');
bitcore.Block = require('./lib/block');
bitcore.Blockheader = require('./lib/blockheader');
bitcore.Networks = require('./lib/networks');
bitcore.Opcode = require('./lib/opcode');
bitcore.Privkey = require('./lib/privkey');
bitcore.Pubkey = require('./lib/pubkey');
bitcore.Script = require('./lib/script');
bitcore.Signature = require('./lib/signature');
bitcore.Transaction = require('./lib/transaction');
bitcore.Txin = require('./lib/txin');
bitcore.Txout = require('./lib/txout');


//dependencies, subject to change
bitcore.deps = {};
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
