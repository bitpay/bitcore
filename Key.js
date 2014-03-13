

if (process.versions) {
  // c++ native version
  module.exports = require('bindings')('KeyModule');
} else {
  // pure js version
  var ECKey = require('./browser/vendor-bundle.js').ECKey;
  var buffertools = require('buffertools');

  var bufferToArray = function(buffer) {
    var ret = [];

    var l = buffer.length;
    for(var i =0; i<l; i++) {
      ret.push(buffer.readUInt8(i));
    }

    return ret;
  }

  var kSpec = function() {
    this._pub = null;
    this.compressed = true; // default
  };


  Object.defineProperty(kSpec.prototype, 'public', {
    set: function(p){
      if (!Buffer.isBuffer(p) ) {
        throw new Error('Arg should be a buffer');
      }
      var type = p[0];
      this.compressed = type!==4;
      this._pub = p;
    },
    get: function(){
      return this._pub;
    }
  });

  kSpec.generateSync = function() {
    var eck = new ECKey();
    eck.setCompressed(true);
    var pub = eck.getPub();

    var ret = new kSpec();
    ret.private = new Buffer(eck.priv.toByteArrayUnsigned());
    ret.public  = new Buffer(pub);
    return ret;
  };

  kSpec.prototype.regenerateSync = function() {
    if (!this.private) {
      throw new Error('Key does not have a private key set');
    }

    var eck = new ECKey(buffertools.toHex(this.private));
    eck.setCompressed(this.compressed);
    this.public = new Buffer(eck.getPub());
    return this;
  };

  kSpec.prototype.signSync = function(hash) {
    if (!this.private) {
      throw new Error('Key does not have a private key set');
    }

    if (!Buffer.isBuffer(hash) || hash.length !== 32) {
      throw new Error('Arg should be a 32 bytes hash buffer');
    }
    var eck = new ECKey(buffertools.toHex(this.private));
    eck.setCompressed(this.compressed);
    var signature = eck.sign(hash);
    // return it as a buffer to keep c++ compatibility
    return new Buffer(signature);
  };

  kSpec.prototype.verifySignatureSync = function(hash, sig) {
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
    var ret = eck.verify(hash,sigA);
    return ret;
  };


  module.exports = {
    Key: kSpec
  };
}


