var fullnode = module.exports;

//main bitcoin library
fullnode.Address = require('./lib/address');
fullnode.Base58 = require('./lib/base58');
fullnode.Base58Check = require('./lib/base58check');
fullnode.BIP32 = require('./lib/bip32');
fullnode.Block = require('./lib/block');
fullnode.Blockheader = require('./lib/blockheader');
fullnode.BN = require('./lib/bn');
fullnode.BufferReader = require('./lib/bufferreader');
fullnode.BufferWriter = require('./lib/bufferwriter');
fullnode.Constants = require('./lib/constants');
fullnode.ECDSA = require('./lib/ecdsa');
fullnode.Hash = require('./lib/hash');
fullnode.KDF = require('./lib/kdf');
fullnode.Keypair = require('./lib/keypair');
fullnode.Message = require('./lib/message');
fullnode.Opcode = require('./lib/opcode');
fullnode.Point = require('./lib/point');
fullnode.Privkey = require('./lib/privkey');
fullnode.Pubkey = require('./lib/pubkey');
fullnode.Random = require('./lib/random');
fullnode.Script = require('./lib/script');
fullnode.Signature = require('./lib/signature');
fullnode.Transaction = require('./lib/transaction');
fullnode.Txin = require('./lib/txin');
fullnode.Txout = require('./lib/txout');
fullnode.Varint = require('./lib/varint');

//experimental, nonstandard, or unstable features
fullnode.expmt = {};
fullnode.expmt.AES = require('./lib/expmt/aes');
fullnode.expmt.AESCBC = require('./lib/expmt/aescbc');
fullnode.expmt.CBC = require('./lib/expmt/cbc');
fullnode.expmt.ECIES = require('./lib/expmt/ecies');
fullnode.expmt.StealthAddress = require('./lib/expmt/stealthaddress');
fullnode.expmt.Stealthkey = require('./lib/expmt/stealthkey');
fullnode.expmt.StealthMessage = require('./lib/expmt/stealthmessage');
fullnode.expmt.StealthTx = require('./lib/expmt/stealthtx');

//dependencies, subject to change
fullnode.deps = {};
fullnode.deps.aes = require('aes');
fullnode.deps.bnjs = require('bn.js');
fullnode.deps.bs58 = require('bs58');
fullnode.deps.Buffer = Buffer;
fullnode.deps.elliptic = require('elliptic');
fullnode.deps.hashjs = require('hash.js');
fullnode.deps.sha512 = require('sha512');

//fullnode.scriptexec = require('lib/scriptexec');
//fullnode.tx = require('lib/tx');
//fullnode.txpartial = require('lib/txpartial');

//fullnode.bip70 = require('lib/bip70');
