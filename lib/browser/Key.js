var ECKey = require('../../browser/vendor-bundle.js').ECKey;
var buffertools = require('buffertools');
var SecureRandom = require('../SecureRandom');

var Key = function() {
  this._pub = null;
  this.compressed = true; // default
};

var bufferToArray = Key.bufferToArray = function(buffer) {
  var ret = [];

  var l = buffer.length;
  for(var i =0; i<l; i++) {
    ret.push(buffer.readUInt8(i));
  }

  return ret;
}


Object.defineProperty(Key.prototype, 'public', {
  set: function(p){
    if (!Buffer.isBuffer(p) ) {
      throw new Error('Arg should be a buffer');
    }
    var type = p[0];
    this.compressed = type!==0x04;
    this._pub = p;
  },
  get: function(){
    return this._pub;
  }
});

Key.generateSync = function() {
  var privbuf = SecureRandom.getRandomBuffer(32);
  var privhex = privbuf.toString('hex');
  var eck = new ECKey(privhex);
  eck.setCompressed(true);
  var pub = eck.getPub();

  ret = new Key();
  ret.private = privbuf;
  ret.compressed = true;
  ret.public = new Buffer(eck.getPub());

  return ret;
};

Key.prototype.regenerateSync = function() {
  if (!this.private) {
    throw new Error('Key does not have a private key set');
  }

  var eck = new ECKey(buffertools.toHex(this.private));
  eck.setCompressed(this.compressed);
  this.public = new Buffer(eck.getPub());
  return this;
};

Key.prototype.signSync = function(hash) {
  if (!this.private) {
    throw new Error('Key does not have a private key set');
  }

  if (!Buffer.isBuffer(hash) || hash.length !== 32) {
    throw new Error('Arg should be a 32 bytes hash buffer');
  }
  var eck = new ECKey(buffertools.toHex(this.private));
  eck.setCompressed(this.compressed);
  var signature = eck.sign(bufferToArray(hash));
  // return it as a buffer to keep c++ compatibility
  return new Buffer(signature);
};

Key.prototype.verifySignature = function(hash, sig, callback) {
  try {
    var result = this.verifySignatureSync(hash, sig);
    callback(null, result);
  } catch (e) {
    callback(e);
  }
};

Key.prototype.verifySignatureSync = function(hash, sig) {
  var self = this;

  if (!Buffer.isBuffer(hash) || hash.length !== 32) {
    throw new Error('Arg 1 should be a 32 bytes hash buffer');
  }
  if (!Buffer.isBuffer(sig)) {
    throw new Error('Arg 2 should be a buffer');
  }
  if (!self.public) {
    throw new Error('Key does not have a public key set');
  }

  var eck = new ECKey();
  eck.setPub(bufferToArray(self.public));
  eck.setCompressed(self.compressed);
  var sigA = bufferToArray(sig);
  var ret = eck.verify(bufferToArray(hash),sigA);
  return ret;
};

module.exports = Key;
