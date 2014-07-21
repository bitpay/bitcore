'use strict';

var run = function() {
  // Replace '../bitcore' with 'bitcore' if you use this code elsewhere.
  var bitcore = require('../bitcore');
  var NetworkMonitor = bitcore.NetworkMonitor;

  var config = {
    networkName: 'testnet',
    host: 'localhost',
    port: 18333
  };


  var nm = new NetworkMonitor.create(config);
  // monitor incoming transactions to http://tpfaucet.appspot.com/ donation address
  nm.incoming('msj42CCGruhRsFrGATiUuh25dtxYtnpbTx', function(tx) {
    console.log('Donation to tpfaucet! '+JSON.stringify(tx.getStandardizedObject()));
  });

  // connect to bitcoin network and start listening
  nm.start();

};

module.exports.run = run;
if (require.main === module) {
  run();
}
