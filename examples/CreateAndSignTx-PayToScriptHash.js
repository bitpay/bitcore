var run = function() {
  bitcore = typeof(bitcore) === 'undefined' ? require('../bitcore') : bitcore;
  var networks = require('../networks');
  var WalletKey = bitcore.WalletKey;
  var Script = bitcore.Script;
  var Builder = bitcore.TransactionBuilder;
  var opts = {
    network: networks.testnet
  };

  console.log('## Network: ' + opts.network.name);

  var input = {};
  input.addr = "n2hoFVbPrYQf7RJwiRy1tkbuPPqyhAEfbp";
  input.priv = "cS62Ej4SobZnpFQYN1PEEBr2KWf5sgRYYnELtumcG6WVCfxno39V";

  // Complete with the corresponding UTXO you want to use
  var utxos = [{
    address: "n2hoFVbPrYQf7RJwiRy1tkbuPPqyhAEfbp",
    txid: "e4bc22d8c519d3cf848d710619f8480be56176a4a6548dfbe865ab3886b578b5",
    vout: 1,
    ts: 1396290442,
    scriptPubKey: "76a914e867aad8bd361f57c50adc37a0c018692b5b0c9a88ac",
    amount: 0.3795,
    confirmations: 7
  }];

  var privs = [
    "cMpKwGr5oxEacN95WFKNEq6tTcvi11regFwS3muHvGYVxMPJX8JA",
    "cVf32m9MR4vxcPwKNJuPepUe8XrHD2z63eCk76d6njRGyCkXpkSM",
    "cQ2sVRFX4jQYMLhWyzz6jTQ2xju51P36968ecXnPhRLKLH677eKR",
    "cSw7x9ERcmeWCU3yVBT6Nz7b9JiZ5yjUB7JMhBUv9UM7rSaDpwX9",
    "cRQBM8qM4ZXJGP1De4D5RtJm7Q6FNWQSMx7YExxzgn2ehjM3haxW",
  ];

  var pubkeys = []
  privs.forEach(function(p) {
    var wk = new WalletKey(opts);
    wk.fromObj({
      priv: p
    });
    pubkeys.push(bitcore.buffertools.toHex(wk.privKey.public));
  });

  // multisig p2sh
  var opts = {
    nreq: 3,
    pubkeys: pubkeys
  };

  // p2scriphash p2sh
  //var opts = [{address: an_address}];

  var info = Builder.infoForP2sh(opts, 'testnet');
  var p2shScript = info.scriptBufHex;
  var p2shAddress = info.address;


  var outs = [{
    address: p2shAddress,
    amount: 0.05
  }];
  var tx = new Builder(opts)
    .setUnspent(utxos)
    .setOutputs(outs)
    .sign([input.priv])
    .build();

  var txHex = tx.serialize().toString('hex');


  console.log('## p2sh address: ' + p2shAddress); //TODO
  console.log('\n1) SEND TO P2SH TX: ', txHex);
  console.log('[this example originally generated TXID: c2e50d1c8c581d8c4408378b751633f7eb86687fc5f0502be7b467173f275ae7 on testnet]\n\n\thttp://test.bitcore.io/tx/c2e50d1c8c581d8c4408378b751633f7eb86687fc5f0502be7b467173f275ae7\n\n');

  //save scriptPubKey
  var scriptPubKey = tx.outs[0].s.toString('hex');

  /* 
   *
   * REDDEEM TX
   */
  var utxos2 = [{
    address: p2shAddress,
    txid: "c2e50d1c8c581d8c4408378b751633f7eb86687fc5f0502be7b467173f275ae7",
    vout: 0,
    ts: 1396375187,
    scriptPubKey: scriptPubKey,
    amount: 0.05,
    confirmations: 1
  }];

  outs = [{
    address: input.addr,
    amount: 0.04
  }];

  var hashMap = {};
  hashMap[p2shAddress] = p2shScript;

  var b = new Builder(opts)
    .setUnspent(utxos2)
    .setHashToScriptMap(hashMap)
    .setOutputs(outs)
    .sign(privs);

  tx = b.build();


  console.log('Builder:');
  console.log('\tSignatures:' + tx.countInputMissingSignatures(0));
  console.log('\t#isFullySigned:' + b.isFullySigned());

  console.log('TX:');
  console.log('\t #isComplete:' + tx.isComplete());

  var txHex = tx.serialize().toString('hex');
  console.log('2) REDEEM SCRIPT: ', txHex);
  console.log('[this example originally generated TXID: 8284aa3b6f9c71c35ecb1d61d05ae78c8ca1f36940eaa615b50584dfc3d95cb7 on testnet]\n\n\thttp://test.bitcore.io/tx/8284aa3b6f9c71c35ecb1d61d05ae78c8ca1f36940eaa615b50584dfc3d95cb7\n\n');

  /*
  // To send TX with RPC:
  var RpcClient = bitcore.RpcClient;
  var config = {
    protocol: 'http',
    user: 'user',
    pass: 'pass',
    host: '127.0.0.1',
    port: '18332',
  };
  var rpc = new RpcClient(config);
  rpc.sendRawTransaction(txHex, function(err, ret) {
    console.log('err', err); //TODO
    console.log('ret', ret); //TODO
    process.exit(-1);
  });
};
*/

};


// This is just for browser & mocha compatibility
if (typeof module !== 'undefined') {
  module.exports.run = run;
  if (require.main === module) {
    run();
  }
} else {
  run();
}
