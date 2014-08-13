var Bn = require('./bn');
var Privkey = require('./privkey');
var Point = require('./point');
var Pubkey = require('./pubkey');
var Key = require('./key');
var Hash = require('./hash');

function KDF() {
};

KDF.buf2key = function(buf) {
  return KDF.sha256hmac2key(buf);
};

KDF.sha256hmac2key = function(buf) {
  var privkey = KDF.sha256hmac2privkey(buf);
  var key = new Key(privkey);
  key.privkey2pubkey();
  return key;
};

KDF.sha256hmac2privkey = function(buf) {
  var bn;
  var concat = new Buffer([]);
  do {
    var hash = Hash.sha256hmac(buf, concat);
    var bn = Bn.fromBuffer(hash);
    concat = Buffer.concat([concat, new Buffer(0)]);
  } while(!bn.lt(Point.getN()));
  return new Privkey(bn);
};

module.exports = KDF;
