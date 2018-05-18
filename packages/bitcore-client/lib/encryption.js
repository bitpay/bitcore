const crypto = require('crypto');

function encrypt(data, password, algo = 'aes-256-cbc') {
  const password_hash = Buffer.from(shaHash(password));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algo, password_hash, iv);
  const encData = cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
  return iv.toString() + ':' + encData;
}

function shaHash(password) {
  let password_hash = crypto
    .createHash('sha256')
    .update(password, 'utf-8')
    .digest('hex')
    .toUpperCase();
  return password_hash;
}

function decrypt(data, password, algo = 'aes-256-cbc') {
  const password_hash = Buffer.form(shaHash(password));
  const [iv, encData] = data.split(':');
  const ivBuffer = Buffer.from(iv, 'hex');
  const decipher = crypto.createDecipheriv(algo, password_hash, ivBuffer);
  const decrypted =
    decipher.update(encData, 'hex', 'utf8') + decipher.final('utf8');
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};
