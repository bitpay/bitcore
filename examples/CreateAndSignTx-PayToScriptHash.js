var run = function() {
  bitcore = typeof (bitcore) === 'undefined' ? require('../bitcore') : bitcore;
  var networks = require('../networks');
  var WalletKey = bitcore.WalletKey;
  var Script = bitcore.Script;
  var Builder = bitcore.TransactionBuilder;
  var opts = {network: networks.testnet};

  console.log('## Network: ' + opts.network.name);

  var input = {};
  input.addr = "n2hoFVbPrYQf7RJwiRy1tkbuPPqyhAEfbp";
  input.priv = "cS62Ej4SobZnpFQYN1PEEBr2KWf5sgRYYnELtumcG6WVCfxno39V";

  // Complete with the corresponding UTXO you want to use
  var utxos = [
    {
    address: "n2hoFVbPrYQf7RJwiRy1tkbuPPqyhAEfbp",
    txid: "ff5c8b4912f6d056f0cf8431ec27032a73df22c167726267dd4cc0d7817a1e7d",
    vout: 1,
    ts: 1396290442,
    scriptPubKey: "76a914e867aad8bd361f57c50adc37a0c018692b5b0c9a88ac",
    amount: 0.5799,
    confirmations: 7
  }
  ];

  var privs =  [
    "cP6JBHuQf7yqeqtdKRd22ibF3VehDv7G6BdzxSNABgrv3jFJUGoN",
    "cQfRwF7XLSM5xGUpF8PZvob2MZyULvZPA2j5cat2RKDJrja7FtCZ",
    "cUkYub4jtFVYymHh38yMMW36nJB4pXG5Pzd5QjResq79kAndkJcg",
    "cMyBgowsyrJRufoKWob73rMQB1PBqDdwFt8z4TJ6APN2HkmX1Ttm",
    "cN9yZCom6hAZpHtCp8ovE1zFa7RqDf3Cr4W6AwH2tp59Jjh9JcXu",
  ];

  var pubkeys = []
  privs.forEach(function(p) {
    var wk = new WalletKey(opts);
    wk.fromObj({priv: p});
    pubkeys.push(bitcore.buffertools.toHex(wk.privKey.public));
  });

  // multisig p2sh
  var opts = {nreq:3, pubkeys:pubkeys, amount:0.05};

  // p2scriphash p2sh
  //var opts = [{address: an_address, amount:0.05}];
  
  var info = Builder.infoForP2sh(opts, 'testnet');
  var p2shScript = info.scriptBufHex;
  var p2shAddress = info.address;
  var outs = [{address:p2shAddress, amount:0.05}];
  var tx = new Builder(opts)
    .setUnspent(utxos)
    .setOutputs(outs)
    .sign([input.priv])
    .build();
  var txHex =  tx.serialize().toString('hex');
  console.log('1) SEND TO P2SH TX: ', txHex);
  console.log('[this example originally generated TXID: ba20653648a896ae95005b8f52847935a7313da06cd7295bb2cfc8b5c1b36c71 on testnet]\n\n\thttp://test.bitcore.io/tx/ba20653648a896ae95005b8f52847935a7313da06cd7295bb2cfc8b5c1b36c71\n\n');

  //save scriptPubKey
  var scriptPubKey = tx.outs[0].s.toString('hex');

  /* 
   *
   * REDDEEM TX
   */
  var utxos2 = [
    {
    address: p2shAddress,
    txid: "ba20653648a896ae95005b8f52847935a7313da06cd7295bb2cfc8b5c1b36c71",
    vout: 0,
    ts: 1396288753,
    scriptPubKey: scriptPubKey, 
    amount: 0.05,
    confirmations: 2
  }
  ];

  outs = [{address:input.addr, amount:0.04}];

  var hashMap = {};
  hashMap[p2shAddress]=p2shScript;

  var b = new Builder(opts)
    .setUnspent(utxos2)
    .setHashToScriptMap(hashMap)
    .setOutputs(outs)
    .sign(privs);


  tx= b.build();


  var txHex =  tx.serialize().toString('hex');
  console.log('2) REDEEM SCRIPT: ', txHex);
console.log('=> Is signed status:', b.isFullySigned(), b.countInputMultiSig(0) );

  console.log('[this example originally generated TXID: 2813c5a670d2c9d0527718f9d0ea896c78c3c8fc57b409e67308744fc7a7a98e on testnet]\n\n\thttp://test.bitcore.io/tx/2813c5a670d2c9d0527718f9d0ea896c78c3c8fc57b409e67308744fc7a7a98e');

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

