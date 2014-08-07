var hashjs = require('hash.js');
var sha512 = require('sha512');

var Hash = module.exports;

Hash.sha256 = function(buf) {
  if (!Buffer.isBuffer(buf))
    throw new Error('sha256 hash must be of a buffer');
  var hash = (new hashjs.sha256()).update(buf).digest();
  return new Buffer(hash);
};

Hash.sha256sha256 = function(buf) {
  try {
    return Hash.sha256(Hash.sha256(buf));
  } catch (e) {
    throw new Error('sha256sha256 hash must be of a buffer');
  }
};

Hash.ripemd160 = function(buf) {
  if (!Buffer.isBuffer(buf))
    throw new Error('ripemd160 hash must be of a buffer');
  var hash = (new hashjs.ripemd160()).update(buf).digest();
  return new Buffer(hash);
};

Hash.sha256ripemd160 = function(buf) {
  try {
    return Hash.ripemd160(Hash.sha256(buf));
  } catch (e) {
    throw new Error('sha256ripemd160 hash must be of a buffer');
  }
};

Hash.sha512 = function(buf) {
  if (!Buffer.isBuffer(buf))
    throw new Error('sha512 hash must be of a buffer');
  var hash = sha512(buf);
  return new Buffer(hash);
};
