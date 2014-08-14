var bitcore = module.exports;

//main bitcoin library
bitcore.Address = require('./lib/address');
bitcore.Base58 = require('./lib/base58');
bitcore.Base58Check = require('./lib/base58check');
bitcore.BIP32 = require('./lib/bip32');
bitcore.BN = require('./lib/bn');
bitcore.Constants = require('./lib/constants');
bitcore.ECDSA = require('./lib/ecdsa');
bitcore.Hash = require('./lib/hash');
bitcore.KDF = require('./lib/kdf');
bitcore.Key = require('./lib/key');
bitcore.Point = require('./lib/point');
bitcore.Privkey = require('./lib/privkey');
bitcore.Pubkey = require('./lib/pubkey');
bitcore.Random = require('./lib/random');
bitcore.Signature = require('./lib/signature');

//experimental, nonstandard, or unstable features
bitcore.expmt = {};
bitcore.expmt.Stealth = require('./lib/expmt/stealth');

//dependencies, subject to change
bitcore.deps = {};
bitcore.deps.bnjs = require('bn.js');
bitcore.deps.bs58 = require('bs58');
bitcore.deps.Buffer = Buffer;
bitcore.deps.elliptic = require('elliptic');
bitcore.deps.hashjs = require('hash.js');
bitcore.deps.sha512 = require('sha512');

//bitcore.script = require('lib/script');
//bitcore.scriptexec = require('lib/scriptexec');
//bitcore.tx = require('lib/tx');
//bitcore.txpartial = require('lib/txpartial');

//bitcore.bip70 = require('lib/bip70');
