import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
const bitcore = require('crypto-wallet-core').BitcoreLib;
const crypto = {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes
};

export function shaHash(data, algo = 'sha256') {
  let hash = crypto
    .createHash(algo)
    .update(data, 'utf8')
    .digest('hex')
    .toUpperCase();
  return hash;
}

const SHA512 = data => shaHash(data, 'sha512');
const SHA256 = data => shaHash(data, 'sha256');
const algo = 'aes-256-cbc';
const _ = require('lodash');

export function encryptEncryptionKey(encryptionKey, password) {
  const password_hash = Buffer.from(SHA512(password));
  const key = password_hash.slice(0, 32);
  const iv = password_hash.slice(32, 48);
  const cipher = crypto.createCipheriv(algo, key, iv);
  const encData = cipher.update(encryptionKey, 'hex', 'hex') + cipher.final('hex');
  return encData;
}

export function decryptEncryptionKey(encEncryptionKey, password) {
  const password_hash = Buffer.from(SHA512(password));
  const key = password_hash.slice(0, 32);
  const iv = password_hash.slice(32, 48);
  const decipher = crypto.createDecipheriv(algo, key, iv);
  const decrypted = decipher.update(encEncryptionKey, 'hex', 'hex' as any) + decipher.final('hex');
  return decrypted;
}

export function encryptPrivateKey(privKey, pubKey, encryptionKey) {
  const key = Buffer.from(encryptionKey, 'hex');
  const doubleHash = Buffer.from(SHA256(SHA256(pubKey)), 'hex');
  const iv = doubleHash.slice(0, 16);
  const cipher = crypto.createCipheriv(algo, key, iv);
  const encData = cipher.update(privKey, 'utf8', 'hex') + cipher.final('hex');
  return encData;
}

function decryptPrivateKey(encPrivateKey: string, pubKey: string, encryptionKey: string) {
  const key = Buffer.from(encryptionKey, 'hex');
  const doubleHash = Buffer.from(SHA256(SHA256(pubKey)), 'hex');
  const iv = doubleHash.slice(0, 16);
  const decipher = crypto.createDecipheriv(algo, key, iv);
  const decrypted = decipher.update(encPrivateKey, 'hex', 'utf8') + decipher.final('utf8');
  return decrypted;
}

function sha512KDF(passphrase: string, salt: Buffer, derivationOptions: { rounds?: number }): string {
  let rounds = derivationOptions.rounds || 1;
  // if salt was sent in as a string, we will have to assume the default encoding type
  if (!Buffer.isBuffer(salt)) {
    salt = new Buffer(salt, 'hex');
  }
  let derivation = Buffer.concat([new Buffer(''), new Buffer(passphrase), salt]);
  for (let i = 0; i < rounds; i++) {
    derivation = crypto
      .createHash('sha512')
      .update(derivation)
      .digest();
  }
  return derivation.toString('hex');
}

export function bitcoinCoreDecrypt(
  jsonl: Array<{
    cipherText?: string;
    derivationMethod?: string;
    rounds?: number;
    salt?: Buffer;
    pubKey?: string;
    address?: string;
  }>,
  passphrase: string
) {
  const derivationMethods = { SHA512: 0 };
  let master = null;
  let jsonlDecrypted = [];
  for (let line of jsonl) {
    let cipherText = line.cipherText;
    if (line.derivationMethod) {
      let salt = line.salt;
      let derivationOptions = {
        method: derivationMethods[line.derivationMethod],
        rounds: line.rounds
      };
      let hashFunc = hashPassphrase(derivationOptions);
      let key = hashFunc(passphrase, salt, derivationOptions);
      master = decrypt({ cipherText, key });
    } else {
      let privKey = decrypt({
        key: master,
        iv: bitcore.crypto.Hash.sha256sha256(Buffer.from(line.pubKey, 'hex')),
        cipherText
      });
      const address = line.address.split(':');
      let keyObj = {
        privKey,
        pubKey: line.pubKey,
        address: address[address.length - 1]
      };
      jsonlDecrypted.push(keyObj);
    }
  }
  return { jsonlDecrypted, master };
}

function hashPassphrase(opts: { method?: number }) {
  return sha512KDF;
}

function decrypt(opts: { key?: string; iv?: Buffer | string; cipherText?: string }) {
  let key = Buffer.from(opts.key, 'hex');
  let secondHalf;
  if (opts.iv) {
    secondHalf = opts.iv.slice(0, 16);
  } else {
    secondHalf = key.slice(32, 48); // AES256-cbc IV
  }
  let cipherText = Buffer.from(opts.cipherText, 'hex');
  let firstHalf = key.slice(0, 32); // AES256-cbc shared key
  let AESDecipher = crypto.createDecipheriv('aes-256-cbc', firstHalf, secondHalf);
  let plainText;
  try {
    plainText = Buffer.concat([AESDecipher.update(cipherText), AESDecipher.final()]).toString('hex');
  } catch (e) {
    throw e;
  }

  return plainText;
}

export function generateEncryptionKey() {
  return crypto.randomBytes(32);
}

export const Encryption = {
  encryptEncryptionKey,
  decryptEncryptionKey,
  encryptPrivateKey,
  decryptPrivateKey,
  generateEncryptionKey,
  bitcoinCoreDecrypt
};
