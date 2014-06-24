'use strict';



var run = function() {
  // replace '../bitcore' with 'bitcore' if you use this code elsewhere.
  var bitcore = require('../bitcore');
  var networks = require('../networks');
  var WalletKey = bitcore.WalletKey;

  var opts = {
    network: networks.testnet
  };

  function print(wk) {

    console.log('\n## Network: ' + wk.network.name);
    console.log('\t * Hex Representation');
    console.log('\tPrivate: ' + bitcore.buffertools.toHex(wk.privKey.private));
    console.log('\tPublic : ' + bitcore.buffertools.toHex(wk.privKey.public));
    console.log('\tPublic Compressed : ' + (wk.privKey.compressed ? 'Yes' : 'No'));

    var wkObj = wk.storeObj();
    console.log('\n\t * WalletKey Store Object');
    console.log('\tPrivate: ' + wkObj.priv);
    console.log('\tPublic : ' + wkObj.pub);
    console.log('\tAddr   : ' + wkObj.addr);
  };

  //Generate a new one (compressed public key, compressed WIF flag)
  var wk = new WalletKey(opts);
  wk.generate();
  print(wk);

  //Generate from private Key WIF. Compressed status taken from WIF.
  var wk2 = new WalletKey(opts);
  wk2.fromObj({
    priv: 'cMpKwGr5oxEacN95WFKNEq6tTcvi11regFwS3muHvGYVxMPJX8JA'
  });
  print(wk2);


};

module.exports.run = run;
if (require.main === module) {
  run();
}
