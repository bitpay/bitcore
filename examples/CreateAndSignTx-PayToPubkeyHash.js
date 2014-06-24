var run = function() {
  bitcore = typeof(bitcore) === 'undefined' ? require('../bitcore') : bitcore;

  var priv = 'cTgGUrcro89yUtKeG6gHBAS14r3qp25KwTTxG9d4kEzcFxecuZDm';
  var amt = '0.005';
  var toAddress = 'myuAQcCc1REUgXGsCTiYhZvPPc3XxZ36G1';
  var changeAddressString = 'moDz3jEo9q7CxjBDjmb13sL4SKkgo2AACE';

  var utxos = [{
    address: "mqSjTad2TKbPcKQ3Jq4kgCkKatyN44UMgZ",
    txid: "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1",
    vout: 1,
    ts: 1394719301,
    scriptPubKey: "76a9146ce4e1163eb18939b1440c42844d5f0261c0338288ac",
    amount: 0.01,
    confirmations: 2
  }];

  console.log('TX Data: BTC:' + amt + ' => ' + toAddress + ', change To:' + changeAddressString);
  console.log('Unspends Outputs:', utxos);


  var outs = [{
    address: toAddress,
    amount: amt
  }];
  var keys = [priv];
  var opts = {
    remainderOut: {
      address: changeAddressString
    }
  };
  var Builder = bitcore.TransactionBuilder;

  var tx = new Builder(opts)
    .setUnspent(utxos)
    .setOutputs(outs)
    .sign(keys)
    .build();

  /* create and signing can be done in multiple steps using:
   *
   *  var builder = new bitcore.TransactionBuilder(opts)
   *             .setUnspent(utxos)
   *             .setOutputs(outs);
   *
   *  builder.sign(key1);
   *  builder.sign(key2);
   *  ...
   *  if (builder.isFullySigned()){
   *   var tx = builder.build();
   *  }
   *
   *  The selected Unspent Outputs for the transaction can be retrieved with:
   *
   *    var selectedUnspent = build.getSelectedUnspent();
   */

  var txHex = tx.serialize().toString('hex');
  console.log('TX HEX IS: ', txHex);
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
