var fs = require('fs');
var crypto = require('crypto');

exports.readFileSync = function(enc_method, enc_passphrase, filename) {
  // read entire file into memory
  var fileData = fs.readFileSync(filename, 'binary');
  if (fileData.length < 32)
    throw new Error("Crypted file " + filename + " truncated");

  // separate into data, hmac parts
  var fileCrypted = fileData.slice(0, -32);
  var fileHmac = fileData.slice(-32);

  // generate and verify HMAC
  var hmac = crypto.createHmac('sha256', enc_passphrase);
  hmac.update(fileCrypted);
  var digest = hmac.digest('binary');

  if (digest.toString() != fileHmac.toString())
    throw new Error("Crypted file " + filename + " failed HMAC checksum verification");

  // decrypt to plaintext
  var decipher = crypto.createDecipher(enc_method, enc_passphrase);
  var dec = decipher.update(fileCrypted, 'binary', 'binary');
  dec += decipher.final('binary');
  return dec;
};

exports.readJFileSync = function(enc_method, enc_passphrase, filename) {
  var raw = this.readFileSync(enc_method, enc_passphrase, filename);
  return JSON.parse(raw);
};

exports.writeFileSync = function(enc_method, enc_passphrase, filename, data) {
  // encrypt to ciphertext
  var cipher = crypto.createCipher(enc_method, enc_passphrase);
  var crypted = cipher.update(data, 'binary', 'binary');
  crypted += cipher.final('binary');

  // compute HMAC
  var hmac = crypto.createHmac('sha256', enc_passphrase);
  hmac.update(crypted);
  var digest = hmac.digest('binary');

  fs.writeFileSync(filename, crypted + digest, 'binary');

  return true;
};

exports.writeJFileSync = function(enc_method, enc_passphrase, filename, obj) {
  var raw = JSON.stringify(obj);
  return this.writeFileSync(enc_method, enc_passphrase, filename, raw);
};
