


if (process.versions) {
  // c++ native version
  module.exports = require('bindings')('KeyModule');
} else {
  // pure js version
  var ECKey = require('./browser/bitcoinjs-lib.js').ECKey;
  var buffertools = require('buffertools');
  var kSpec = function(compressed, public, private) {
    this.compressed = compressed;
    this.public = public;
    this.private = private;
  };

  kSpec.generateSync = function() {
    var eck = new ECKey();
    eck.setCompressed(true);
    var pub = eck.getPub();
    
    var ret = new this(true, new Buffer(pub), new Buffer(eck.priv.toByteArrayUnsigned()));
    ret.eck = eck;
    return ret;
  };

  kSpec.prototype.regenerateSync = function() {
    this.eck = new ECKey(buffertools.toHex(this.private));
    this.eck.setCompressed(true);
    this.public = new Buffer(this.eck.getPub());
    return this;
  };

  module.exports = {
    Key: kSpec
  };
}


