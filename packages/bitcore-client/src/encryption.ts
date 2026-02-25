import crypto from 'crypto';
import { BitcoreLib as bitcore } from '@bitpay-labs/crypto-wallet-core';

export function shaHash(data, algo = 'sha256') {
  const hash = crypto
    .createHash(algo)
    .update(data, 'utf8')
    .digest('hex')
    .toUpperCase();
  return hash;
}

const SHA512 = data => shaHash(data, 'sha512');
const SHA256 = data => shaHash(data, 'sha256');
const algo = 'aes-256-cbc';

export function encryptEncryptionKey(encryptionKey, password) {
  const password_hash = Buffer.from(SHA512(password));
  const key = password_hash.subarray(0, 32);
  const iv = password_hash.subarray(32, 48);
  const cipher = crypto.createCipheriv(algo, key, iv);
  const encData = cipher.update(encryptionKey, 'hex', 'hex') + cipher.final('hex');
  return encData;
}

export function decryptEncryptionKey(encEncryptionKey, password, toBuffer: true): Buffer;
export function decryptEncryptionKey(encEncryptionKey, password, toBuffer: false): string;
export function decryptEncryptionKey(encEncryptionKey, password, toBuffer?: boolean): Buffer | string {
  const password_hash = Buffer.from(SHA512(password));
  const key = password_hash.subarray(0, 32);
  const iv = password_hash.subarray(32, 48);
  const decipher = crypto.createDecipheriv(algo, key, iv);
  
  const payload = decipher.update(encEncryptionKey, 'hex');
  const final = decipher.final();
  const output = Buffer.concat([payload, final]);
  try {
    return toBuffer ? output : output.toString('hex');
  } finally {
    payload.fill(0);
    final.fill(0);
    if (!toBuffer) {
      // Don't fill output if it's what's returned directly
      output.fill(0);
    }
  }
}

/** @deprecated - Use encryptBuffer */
export function encryptPrivateKey(privKey, pubKey, encryptionKey) {
  encryptionKey = Buffer.from(encryptionKey, 'hex');
  privKey = Buffer.from(privKey, 'utf8');
  return encryptBuffer(privKey, pubKey, encryptionKey).toString('hex');
}

function decryptPrivateKey(encPrivateKey: string, pubKey: string, encryptionKey: Buffer | string) {
  if (!Buffer.isBuffer(encryptionKey)) {
    encryptionKey = Buffer.from(encryptionKey, 'hex');
  }
  const doubleHash = Buffer.from(SHA256(SHA256(pubKey)), 'hex');
  const iv = doubleHash.subarray(0, 16);
  const decipher = crypto.createDecipheriv(algo, encryptionKey, iv);
  const decrypted = decipher.update(encPrivateKey, 'hex', 'utf8') + decipher.final('utf8');
  return decrypted;
}

function encryptBuffer(data: Buffer, pubKey: string, encryptionKey: Buffer): Buffer {
  const iv = Buffer.from(SHA256(SHA256(pubKey)), 'hex').subarray(0, 16);
  const cipher = crypto.createCipheriv(algo, encryptionKey, iv);
  const payload = cipher.update(data);
  try {
    return Buffer.concat([payload, cipher.final()]);
  } finally {
    payload.fill(0);
  }
}

function decryptToBuffer(encHex: string, pubKey: string, encryptionKey: Buffer): Buffer {
  const iv = Buffer.from(SHA256(SHA256(pubKey)), 'hex').subarray(0, 16);
  const decipher = crypto.createDecipheriv(algo, encryptionKey, iv);

  const decrypted = decipher.update(encHex, 'hex');
  const final = decipher.final();
  try {
    return Buffer.concat([decrypted, final]);
  } finally {
    decrypted.fill(0);
    final.fill(0);
  }
}

function sha512KDF(passphrase: string, salt: Buffer, derivationOptions: { rounds?: number }): string {
  const rounds = derivationOptions.rounds || 1;
  // if salt was sent in as a string, we will have to assume the default encoding type
  if (!Buffer.isBuffer(salt)) {
    salt = Buffer.from(salt, 'hex');
  }
  let derivation: Buffer<ArrayBufferLike> = Buffer.concat([Buffer.from(''), Buffer.from(passphrase), salt]);
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
  const jsonlDecrypted = [];
  for (const line of jsonl) {
    const cipherText = line.cipherText;
    if (line.derivationMethod) {
      const salt = line.salt;
      const derivationOptions = {
        method: derivationMethods[line.derivationMethod],
        rounds: line.rounds
      };
      // derive the key from passphrase
      const key = sha512KDF(passphrase, salt, derivationOptions);
      master = decrypt({ cipherText, key });
    } else {
      const privKey = decrypt({
        key: master,
        iv: bitcore.crypto.Hash.sha256sha256(Buffer.from(line.pubKey, 'hex')),
        cipherText
      });
      const address = line.address.split(':');
      const keyObj = {
        privKey,
        pubKey: line.pubKey,
        address: address[address.length - 1]
      };
      jsonlDecrypted.push(keyObj);
    }
  }
  return { jsonlDecrypted, master };
}

function decrypt(opts: { key?: string; iv?: Buffer | string; cipherText?: string }) {
  const key = Buffer.from(opts.key, 'hex');
  let secondHalf;
  if (opts.iv) {
    secondHalf = opts.iv.slice(0, 16);
  } else {
    secondHalf = key.subarray(32, 48); // AES256-cbc IV
  }
  const cipherText = Buffer.from(opts.cipherText, 'hex');
  const firstHalf = key.subarray(0, 32); // AES256-cbc shared key
  const AESDecipher = crypto.createDecipheriv(algo, firstHalf, secondHalf);
  const plainText = Buffer.concat([AESDecipher.update(cipherText), AESDecipher.final()]).toString('hex');

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
  encryptBuffer,
  decryptToBuffer,
  generateEncryptionKey,
  bitcoinCoreDecrypt
};
