var run = function() {
  bitcore = typeof(bitcore) === 'undefined' ? require('../bitcore') : bitcore;
  var networks = require('../networks');
  var WalletKey = bitcore.WalletKey;
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
    address: input.addr,
    txid: "39c71ebda371f75f4b854a720eaf9898b237facf3c2b101b58cd4383a44a6adc",
    vout: 1,
    ts: 1396288753,
    scriptPubKey: "76a914e867aad8bd361f57c50adc37a0c018692b5b0c9a88ac",
    amount: 0.4296,
    confirmations: 2
  }];

  var privs = [
    "cP6JBHuQf7yqeqtdKRd22ibF3VehDv7G6BdzxSNABgrv3jFJUGoN",
    "cQfRwF7XLSM5xGUpF8PZvob2MZyULvZPA2j5cat2RKDJrja7FtCZ",
    "cUkYub4jtFVYymHh38yMMW36nJB4pXG5Pzd5QjResq79kAndkJcg",
    "cMyBgowsyrJRufoKWob73rMQB1PBqDdwFt8z4TJ6APN2HkmX1Ttm",
    "cN9yZCom6hAZpHtCp8ovE1zFa7RqDf3Cr4W6AwH2tp59Jjh9JcXu",
  ];

  var pubkeys = []
  privs.forEach(function(p) {
    var wk = new WalletKey(opts);
    wk.fromObj({
      priv: p
    });
    pubkeys.push(bitcore.buffertools.toHex(wk.privKey.public));
  });


  var outs = [{
    nreq: 3,
    pubkeys: pubkeys,
    amount: 0.05
  }];
  var tx = new Builder(opts)
    .setUnspent(utxos)
    .setOutputs(outs)
    .sign([input.priv])
    .build();
  var txHex = tx.serialize().toString('hex');
  console.log('1) SEND TO MULSISIG TX: ', txHex);
  console.log('[this example originally generated TXID: e4bc22d8c519d3cf848d710619f8480be56176a4a6548dfbe865ab3886b578b5 on testnet]\n\n\thttp://test.bitcore.io/tx/e4bc22d8c519d3cf848d710619f8480be56176a4a6548dfbe865ab3886b578b5\n\n');


  //save scriptPubKey
  var scriptPubKey = tx.outs[0].s.toString('hex');

  /* 
   *
   * REDDEEM TX
   */
  var utxos2 = [{
    address: input.addr,
    txid: "e4bc22d8c519d3cf848d710619f8480be56176a4a6548dfbe865ab3886b578b5",
    vout: 0,
    ts: 1396288753,
    scriptPubKey: scriptPubKey,
    amount: 0.05,
    confirmations: 2
  }];

  outs = [{
    address: input.addr,
    amount: 0.04
  }];
  var b = new Builder(opts)
    .setUnspent(utxos2)
    .setOutputs(outs)
    .sign(privs);


  tx = b.build();


  var txHex = tx.serialize().toString('hex');
  console.log('2) REDEEM SCRIPT: ', txHex);
  console.log('=> Is signed status:', b.isFullySigned(), tx.countInputMissingSignatures(0));

  console.log('[this example originally generated TXID: 1eb388977b2de99562eb0fbcc661a100eaffed99c53bfcfebe5a087002039b83 on testnet]\n\n\thttp://test.bitcore.io/tx/1eb388977b2de99562eb0fbcc661a100eaffed99c53bfcfebe5a087002039b83');

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

////
