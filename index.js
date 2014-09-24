var bitcore = module.exports;

//main bitcoin library
bitcore.Address = require('./lib/address');
bitcore.Base58 = require('./lib/base58');
bitcore.Base58Check = require('./lib/base58check');
bitcore.BIP32 = require('./lib/bip32');
bitcore.Block = require('./lib/block');
bitcore.Blockheader = require('./lib/blockheader');
bitcore.BN = require('./lib/bn');
bitcore.BufferReader = require('./lib/bufferreader');
bitcore.BufferWriter = require('./lib/bufferwriter');
bitcore.Constants = require('./lib/constants');
bitcore.ECDSA = require('./lib/ecdsa');
bitcore.Hash = require('./lib/hash');
bitcore.KDF = require('./lib/kdf');
bitcore.Keypair = require('./lib/keypair');
bitcore.Message = require('./lib/message');
bitcore.Opcode = require('./lib/opcode');
bitcore.Point = require('./lib/point');
bitcore.Privkey = require('./lib/privkey');
bitcore.Pubkey = require('./lib/pubkey');
bitcore.Random = require('./lib/random');
bitcore.Script = require('./lib/script');
bitcore.Signature = require('./lib/signature');
bitcore.Transaction = require('./lib/transaction');
bitcore.Txin = require('./lib/txin');
bitcore.Txout = require('./lib/txout');
bitcore.Varint = require('./lib/varint');

//experimental, nonstandard, or unstable features
bitcore.expmt = {};
bitcore.expmt.AES = require('./lib/expmt/aes');
bitcore.expmt.AESCBC = require('./lib/expmt/aescbc');
bitcore.expmt.CBC = require('./lib/expmt/cbc');
bitcore.expmt.ECIES = require('./lib/expmt/ecies');
bitcore.expmt.StealthAddress = require('./lib/expmt/stealthaddress');
bitcore.expmt.Stealthkey = require('./lib/expmt/stealthkey');
bitcore.expmt.StealthMessage = require('./lib/expmt/stealthmessage');
bitcore.expmt.StealthTx = require('./lib/expmt/stealthtx');

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
