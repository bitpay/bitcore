// Script temporaneo per rigenerare indirizzi t1 dalle chiavi pubbliche nel package locale
const path = require('path');
const fs = require('fs');
const scriptDir = __dirname;
const pkgDir = path.resolve(scriptDir, '..');
const keysFile = path.join(pkgDir, 'test/data/transparent-keys.json');
const keys = require(keysFile);
const Address = require(path.join(pkgDir, 'lib/address'));
const PublicKey = require(path.join(pkgDir, 'lib/publickey'));
const Networks = require(path.join(pkgDir, 'lib/networks'));

console.log('Using network pubkeyhash:', Networks.livenet.pubkeyhash.toString(16));

keys.forEach((k, i) => {
  const pub = k.pub;
  try {
    const pk = new PublicKey(pub);
    const addr = Address.fromPublicKey(pk, Networks.livenet).toString();
    console.log(i, pub, '=>', addr);
  } catch (e) {
    console.error(i, pub, 'ERROR:', e && e.message ? e.message : e);
  }
});