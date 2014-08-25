var Random = require('../random');

var CBC = function CBC() {
};

CBC.pkcs7pad = function(buf, blocksize) {
  var bytesize = blocksize / 8;
  var padbytesize = bytesize - buf.length;
  var pad = new Buffer(padbytesize);
  pad.fill(padbytesize);
  return Buffer.concat([buf, pad]);
};

module.exports = CBC;
