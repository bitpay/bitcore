const crypto = require('crypto');

function encrypt(data, password, algo = 'aes-256-cbc') {
  let password_hash = crypto
    .createHash('md5')
    .update(password, 'utf-8')
    .digest('hex')
    .toUpperCase();

  let iv = new Buffer.alloc(16);

  let cipher = crypto.createCipheriv(algo, password_hash, iv);
  let encryptedData = cipher.update(data, 'utf8', 'hex') + cipher.final('hex');

  return encryptedData;
}

function decrypt(data, password, algo = 'aes-256-cbc') {
  const decipher = crypto.createDecipher(algo, password);
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};
