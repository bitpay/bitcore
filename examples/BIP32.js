var run = function() {
  bitcore = typeof (bitcore) === 'undefined' ? require('../bitcore') : bitcore;
  var BIP32 = bitcore.BIP32;
  var Address = bitcore.Address;
  var networks = bitcore.networks;
  var coinUtil = bitcore.util;
  var crypto = require('crypto');

  console.log('BIP32: Hierarchical Deterministic Wallets');
  console.log('https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki\n');
  console.log('1) Make new bip32 from randomly generated new seed');

  var randomBytes = crypto.randomBytes(256);
  var bip32 = BIP32.seed(randomBytes);
  console.log('master extended private key: ' + bip32.extendedPrivateKeyString());
  console.log('master extended public key: ' + bip32.extendedPublicKeyString());
  console.log('m/0/3/5 extended private key: ' + bip32.derive('m/0/3/5').extendedPrivateKeyString());
  console.log('m/0/3/5 extended public key: ' + bip32.derive('m/0/3/5').extendedPublicKeyString());
  console.log();

  console.log('2) Make new bip32 from known seed');
  var knownBytes = coinUtil.sha256('do not use this password as a brain wallet');
  var bip32 = BIP32.seed(knownBytes);
  console.log('master extended private key: ' + bip32.extendedPrivateKeyString());
  console.log('master extended public key: ' + bip32.extendedPublicKeyString());
  console.log('m/0/3/5 extended private key: ' + bip32.derive('m/0/3/5').extendedPrivateKeyString());
  console.log('m/0/3/5 extended public key: ' + bip32.derive('m/0/3/5').extendedPublicKeyString());
  console.log();

  console.log('3) Make new bip32 from known master private key');
  var knownMasterPrivateKey = 'xprv9s21ZrQH143K2LvayFZWVVTomiDKheKWvnupDB8fmjKwxkKG47uvzmFa3vCXoy9fxPJhRYsU19apVfexvMeLpJQuF2XtX1zRF3eao9GqqaQ';
  var bip32 = new BIP32(knownMasterPrivateKey);
  console.log('master extended private key: ' + bip32.extendedPrivateKeyString());
  console.log('master extended public key: ' + bip32.extendedPublicKeyString());
  console.log('m/0/3/5 extended private key: ' + bip32.derive('m/0/3/5').extendedPrivateKeyString());
  console.log('m/0/3/5 extended public key: ' + bip32.derive('m/0/3/5').extendedPublicKeyString());
  console.log();

  console.log('4) Make new bip32 from known master public key');
  var knownMasterPublicKey = 'xpub661MyMwAqRbcGpiFufipqsKKBG1NHNwfJKishAEFNqJ6ryLcKeKyFNEZces7gMWd4XGg4uUhXy8DS64o1oPGUECVHeLq957Txjwagxt475H';
  var bip32 = new BIP32(knownMasterPublicKey);
  console.log('master extended private key: cannot derive');
  console.log('master extended public key: ' + bip32.extendedPublicKeyString());
  console.log('m/0/3/5 extended private key: cannot derive');
  console.log('m/0/3/5 extended public key: ' + bip32.derive('m/0/3/5').extendedPublicKeyString());
  console.log();

  console.log('5) Make new bip32 from knowan derived public key');
  var knownPublicKey = 'xpub6CZei1p2zk68UwkcBDqzRonLHJWAiPZZ58sMgHJAn9fmpmnPayVEAvAs3XvTSUMZ1J8dNaxnv4wnt7YpRKr6BsqeWbW8msqeuuhiSzsQEC3';
  var bip32 = new BIP32(knownPublicKey);
  console.log('master extended private key: cannot derive');
  console.log('master extended public key: ' + bip32.extendedPublicKeyString());
  console.log('m/0/3/5 extended private key: cannot derive');
  console.log('m/0/3/5 extended public key: ' + bip32.derive('m/0/3/5').extendedPublicKeyString());
  console.log();

  console.log('6) Make a bunch of new addresses from known public key');
  var knownPublicKey = 'xpub6CZei1p2zk68UwkcBDqzRonLHJWAiPZZ58sMgHJAn9fmpmnPayVEAvAs3XvTSUMZ1J8dNaxnv4wnt7YpRKr6BsqeWbW8msqeuuhiSzsQEC3';
  var bip32 = new BIP32(knownPublicKey);
  console.log('m/0 address: ' + new Address(networks['livenet'].addressVersion, bip32.derive('m/0').eckey.public).toString());
  //console.log('m/1 extended public key: ' + bip32.derive('m/1').extendedPublicKeyString());
  console.log('m/1 address: ' + new Address(networks['livenet'].addressVersion, bip32.derive('m/1').eckey.public).toString());
  //console.log('m/2 extended public key: ' + bip32.derive('m/2').extendedPublicKeyString());
  console.log('m/2 address: ' + new Address(networks['livenet'].addressVersion, bip32.derive('m/2').eckey.public).toString());
  //console.log('m/3 extended public key: ' + bip32.derive('m/3').extendedPublicKeyString());
  console.log('m/3 address: ' + new Address(networks['livenet'].addressVersion, bip32.derive('m/3').eckey.public).toString());
  console.log('...');
  //console.log('m/100 extended public key: ' + bip32.derive('m/100').extendedPublicKeyString());
  console.log('m/100 address: ' + new Address(networks['livenet'].addressVersion, bip32.derive('m/100').eckey.public).toString());
  console.log();

};


// This is just for browser & mocha compatibility
if (typeof module !== 'undefined') {
  module.exports.run = run;
  if (require.main === module) {
    run();
  }
} else {
  run();
}
