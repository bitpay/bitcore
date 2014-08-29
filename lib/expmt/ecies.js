var AESCBC = require('./aescbc');
var Keypair = require('../keypair');
var Point = require('../point');
var Hash = require('../hash');
var Pubkey = require('../pubkey');

// http://en.wikipedia.org/wiki/Integrated_Encryption_Scheme
var ECIES = function ECIES() {
  if (!(this instanceof ECIES))
    return new ECIES();
};

ECIES.encrypt = function(messagebuf, tokeypair, fromkeypair, ivbuf) {
  var r = fromkeypair.privkey.bn;
  var R = fromkeypair.pubkey.point;
  var Rpubkey = fromkeypair.pubkey;
  var Rbuf = Rpubkey.toDER(true);
  var KB = tokeypair.pubkey.point;
  var P = KB.mul(r);
  var S = P.getX();
  var Sbuf = S.toBuffer({size: 32});
  var kEkM = Hash.sha512(Sbuf);
  var kE = kEkM.slice(0, 32);
  var kM = kEkM.slice(32, 64);
  var c = AESCBC.encryptCipherkey(messagebuf, kE, ivbuf);
  var d = Hash.sha256hmac(c, kM);
  var encbuf = Buffer.concat([Rbuf, c, d]);
  return encbuf;
};

ECIES.decrypt = function(encbuf, tokeypair) {
  var kB = tokeypair.privkey.bn;
  var frompubkey = Pubkey().fromDER(encbuf.slice(0, 33));
  var R = frompubkey.point;
  var P = R.mul(kB);
  if (P.eq(new Point()))
    throw new Error('P equals 0');
  var S = P.getX();
  var Sbuf = S.toBuffer({size: 32});
  var kEkM = Hash.sha512(Sbuf);
  var kE = kEkM.slice(0, 32);
  var kM = kEkM.slice(32, 64);
  var c = encbuf.slice(33, encbuf.length - 32);
  var d = encbuf.slice(encbuf.length - 32, encbuf.length);
  var d2 = Hash.sha256hmac(c, kM);
  if (d.toString('hex') !== d2.toString('hex'))
    throw new Error('Invalid checksum');
  var messagebuf = AESCBC.decryptCipherkey(c, kE);
  return messagebuf;
};

module.exports = ECIES;
