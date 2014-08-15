var privsec = module.exports;

//main bitcoin library
privsec.Address = require('./lib/address');
privsec.Base58 = require('./lib/base58');
privsec.Base58Check = require('./lib/base58check');
privsec.BIP32 = require('./lib/bip32');
privsec.BN = require('./lib/bn');
privsec.Constants = require('./lib/constants');
privsec.ECDSA = require('./lib/ecdsa');
privsec.Hash = require('./lib/hash');
privsec.KDF = require('./lib/kdf');
privsec.Key = require('./lib/key');
privsec.Point = require('./lib/point');
privsec.Privkey = require('./lib/privkey');
privsec.Pubkey = require('./lib/pubkey');
privsec.Random = require('./lib/random');
privsec.Signature = require('./lib/signature');

//experimental, nonstandard, or unstable features
privsec.expmt = {};
privsec.expmt.Stealth = require('./lib/expmt/stealth');

//dependencies, subject to change
privsec.deps = {};
privsec.deps.bnjs = require('bn.js');
privsec.deps.bs58 = require('bs58');
privsec.deps.Buffer = Buffer;
privsec.deps.elliptic = require('elliptic');
privsec.deps.hashjs = require('hash.js');
privsec.deps.sha512 = require('sha512');

//privsec.script = require('lib/script');
//privsec.scriptexec = require('lib/scriptexec');
//privsec.tx = require('lib/tx');
//privsec.txpartial = require('lib/txpartial');

//privsec.bip70 = require('lib/bip70');
