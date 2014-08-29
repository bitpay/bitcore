var Bn = require('./bn');
var Privkey = require('./privkey');
var Point = require('./point');
var Pubkey = require('./pubkey');
var Keypair = require('./keypair');
var Hash = require('./hash');

function KDF() {
};

KDF.buf2keypair = function(buf) {
  return KDF.sha256hmac2keypair(buf);
};

KDF.sha256hmac2keypair = function(buf) {
  var privkey = KDF.sha256hmac2privkey(buf);
  var keypair = Keypair().fromPrivkey(privkey);
  return keypair;
};

KDF.sha256hmac2privkey = function(buf) {
  var bn;
  var concat = new Buffer([]);
  do {
    var hash = Hash.sha256hmac(buf, concat);
    var bn = Bn.fromBuffer(hash);
    concat = Buffer.concat([concat, new Buffer(0)]);
  } while(!bn.lt(Point.getN()));
  return new Privkey({bn: bn});
};

module.exports = KDF;
