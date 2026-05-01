// Calcola indirizzi t1 direttamente dal pubkey compresso senza usare PublicKey
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bs58 = require('bs58');

const pkgDir = path.resolve(__dirname, '..');
const keysPath = path.join(pkgDir, 'test/data/transparent-keys.json');
const keys = JSON.parse(fs.readFileSync(keysPath));

function sha256(buf){return crypto.createHash('sha256').update(buf).digest();}
function ripemd160(buf){return crypto.createHash('ripemd160').update(buf).digest();}
function sha256sha256(buf){return sha256(sha256(buf));}

const version = Buffer.from([0x1c,0xb8]); // pubkeyhash livenet

keys.forEach((k,i)=>{
  const pubhex = k.pub;
  try{
    const pubbuf = Buffer.from(pubhex,'hex');
    const h = ripemd160(sha256(pubbuf));
    const payload = Buffer.concat([version,h]);
    const checksum = sha256sha256(payload).slice(0,4);
    const addr = bs58.encode(Buffer.concat([payload,checksum]));
    console.log(i, pubhex, '=>', addr);
  }catch(e){
    console.error(i, pubhex, 'ERROR', e.message);
  }
});
