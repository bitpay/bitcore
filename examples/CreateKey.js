'use strict';


var run = function() {
  // Replace '../bitcore' with 'bitcore' if you use this code elsewhere.
  var bitcore = require('../bitcore');
  var networks = require('../networks');
  var WalletKey = bitcore.WalletKey;


  function print(wk) {

    console.log('\n## Network: ' + wk.network.name);
    console.log ('\t * Hex Representation');
    console.log ('\tPrivate: ' + bitcore.buffertools.toHex(wk.privKey.private));
    console.log ('\tPublic : ' + bitcore.buffertools.toHex(wk.privKey.public));
    console.log ('\tPublic Compressed : ' + (wk.privKey.compressed?'Yes':'No'));

    var wkObj = wk.storeObj();
    console.log ('\n * WalletKey Store Object');
    console.log ('\tPrivate: ' + wkObj.priv);
    console.log ('\tPublic : ' + wkObj.pub);
    console.log ('\tAddr   : ' + wkObj.addr);
  };

  //Generate a new one
  var wk = new WalletKey({network: networks.testnet});
  wk.generate();
  print(wk);

  //Generate from private Key WIF
  var wk2 = new WalletKey({network: networks.testnet});
  wk2.fromObj({priv:'cS62Ej4SobZnpFQYN1PEEBr2KWf5sgRYYnELtumcG6WVCfxno39V'});
  print(wk2);


};

module.exports.run = run;
if (require.main === module) {
  run();
}
