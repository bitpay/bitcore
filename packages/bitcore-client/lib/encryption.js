const crypto = require('crypto');

function shaHash(data, algo = 'sha256') {
  let hash = crypto
    .createHash(algo)
    .update(data, 'utf-8')
    .digest('hex')
    .toUpperCase();
  return hash;
}

const SHA512 = data => shaHash(data, 'sha512');
const SHA256 = data => shaHash(data, 'sha256');
const algo = 'aes-256-cbc';

function encryptEncryptionKey(encryptionKey, password) {
  const password_hash = Buffer.from(SHA512(password));
  const key = password_hash.slice(0, 32);
  const iv = password_hash.slice(32, 48);
  const cipher = crypto.createCipheriv(algo, key, iv);
  const encData = cipher.update(encryptionKey, 'hex', 'hex') + cipher.final('hex');
  return encData;
}

function decryptEncryptionKey(encEncryptionKey, password) {
  const password_hash = Buffer.from(SHA512(password));
  const key = password_hash.slice(0, 32);
  const iv = password_hash.slice(32, 48);
  const decipher = crypto.createDecipheriv(algo, key, iv);
  const decrypted = decipher.update(encEncryptionKey, 'hex', 'hex') + decipher.final('hex');
  return decrypted;
}

function encryptPrivateKey(privKey, pubKey, encryptionKey) {
  const key = encryptionKey;
  const doubleHash = Buffer.from(SHA256(SHA256(pubKey)), 'hex');
  const iv = doubleHash.slice(0, 16);
  const cipher = crypto.createCipheriv(algo, key, iv);
  const encData = cipher.update(privKey, 'utf8', 'hex') + cipher.final('hex');
  return encData;
}

function decryptPrivateKey(encPrivateKey, pubKey, encryptionKey) {
  const key = Buffer.from(encryptionKey, 'hex');
  const doubleHash = Buffer.from(SHA256(SHA256(pubKey)), 'hex');
  const iv = doubleHash.slice(0, 16);
  const decipher = crypto.createDecipheriv(algo, key, iv);
  const decrypted = decipher.update(encPrivateKey, 'hex', 'utf8') + decipher.final('utf8');
  return decrypted;
}

function generateEncryptionKey() {
  return crypto.randomBytes(32);
}

module.exports = {
  encryptEncryptionKey,
  decryptEncryptionKey,
  encryptPrivateKey,
  decryptPrivateKey,
  generateEncryptionKey
};
