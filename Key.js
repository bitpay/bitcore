


if (process.versions) {
  // c++ native version
  module.exports = require('bindings')('KeyModule');
} else {
  // pure js version
  var ECKey = require('./browser/bitcoinjs-lib.js').ECKey;
  var kSpec = function() {

  };

  kSpec.generateSync = function() {
    var eck = new ECKey();
    eck.setCompressed(true);
    var pub = eck.getPub();
    console.dir(eck);
    console.log(pub);
    
    return {
      compressed: true,
      public: new Buffer(33),
      private: new Buffer(32)
    };
  };
  module.exports = {
    Key: kSpec
  };
}


