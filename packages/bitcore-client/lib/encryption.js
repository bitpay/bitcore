const crypto = require('crypto');

function encrypt(data, password, algo = 'aes-256-cbc') {
  let password_hash = mdfHash(password);
  let cipher = crypto.createCipher(algo, password_hash);
  let encryptedData = cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
  return encryptedData;
}

function mdfHash(password) {
  let password_hash = crypto
  .createHash('sha256')
  .update(password, 'utf-8')
  .digest('hex')
  .toUpperCase();
  return password_hash;
}

function decrypt(data, password, algo = 'aes-256-cbc') {
  const password_hash = mdfHash(password);
  const decipher = crypto.createDecipher(algo, password_hash);
  let decrypted = decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};
