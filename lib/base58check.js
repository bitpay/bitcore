var base58 = require('./base58');
var sha256sha256 = require('./hash').sha256sha256;

var base58check = module.exports;

base58check.encode = function(buf) {
  if (!Buffer.isBuffer(buf))
    throw new Error('base58check: Input must be a buffer');
  var checkedBuf = new Buffer(buf.length + 4);
  var hash = sha256sha256(buf);
  buf.copy(checkedBuf);
  hash.copy(checkedBuf, buf.length);
  return base58.encode(checkedBuf);
};

base58check.decode = function(s) {
  if (typeof s !== 'string')
    throw new Error('base58check: Input must be a string');

  var buf = base58.decode(s);

  if (buf.length < 4)
    throw new Error("base58check: Input string too short");

  var data = buf.slice(0, -4);
  var csum = buf.slice(-4);

  var hash = sha256sha256(data);
  var hash4 = hash.slice(0, 4);

  if (csum.toString('hex') !== hash4.toString('hex'))
    throw new Error("base58check: Checksum mismatch");

  return data;
};
