'use strict';

var run = function() {
  // Replace '../bitcore' with 'bitcore' if you use this code elsewhere.
  var bitcore = require('../bitcore');
  var Peer = bitcore.Peer;

  var TransactionBuilder = bitcore.TransactionBuilder;
  var PeerManager = bitcore.PeerManager;

  // Unspent transactions can be found via the insight.bitcore.io or blockchain.info APIs
  var unspent = [{
      'txid': '707108b5ba4f78dc951df4647a03365bf36432ea57fb641676045c5044daaea7',
      'vout': 0,
      'address': 'n3QDC7DzsMmN4mcyp3k7XGPX7zFXXHG387',
      'scriptPubKey': '76a914f00c4a92ee2314ab08ac0283dc8d07d9bf2be32388ac',
      'amount': 0.12345600,
      'confirmations': 43537
    }, {
      'txid': '87a158d32833cb555aea27b6a21af569ccaeb8f9b19691e05f1e6c2b3440bdb3',
      'vout': 1,
      'address': 'mxdrp9s4mVxS9X4RBYiLe99v59V81XA5C3',
      'scriptPubKey': '76a914bbc87986da6b17c7876db4efacf59a95e14f6cf588ac',
      'amount': 0.05749800,
      'confirmations': 43536
    }

  ];

  // Private keys in WIF format (see TransactionBuilder.js for other options)
  var keys = [
    'cQA75LXhV5JkMT8wkkqjR87SnHK4doh3c21p7PAd5tp8tc1tRBAY',
    'cRz85dz9AiDieRpEwoucfXXQa1jdHHghcv6YnnVVGZ3MQyR1X4u2',
    'cSq7yo4fvsbMyWVN945VUGUWMaSazZPWqBVJZyoGsHmNq6W4HVBV',
    'cPa87VgwZfowGZYaEenoQeJgRfKW6PhZ1R65EHTkN1K19cSvc92G',
    'cPQ9DSbBRLva9av5nqeF5AGrh3dsdW8p2E5jS4P8bDWZAoQTeeKB'
  ];

  var peerman = new PeerManager({
    network: 'testnet'
  });
  peerman.addPeer(new Peer('127.0.0.1', 18333));

  peerman.on('connect', function() {
    var conn = peerman.getActiveConnection();
    if (conn) {
      // define transaction output
      var outs = [{
        address: 'mhNCT9TwZAGF1tLPpZdqfkTmtBkY282YDW',
        amount: 0.1337
      }];
      // set change address
      var opts = {
        remainderOut: {
          address: 'n4g2TFaQo8UgedwpkYdcQFF6xE2Ei9Czvy'
        }
      };
      var tx = new TransactionBuilder(opts)
        .setUnspent(unspent)
        .setOutputs(outs)
        .sign(keys)
        .build();

      /* Create and signing can be done in multiple steps:
       *
       *  var builder = new bitcore.TransactionBuilder(opts)
       *                .setUnspent(utxos)
       *                .setOutputs(outs);
       *
       *  // Sign with the first key
       *  builder.sign(key1);
       *  var tx = builder.build(); // Partially signed transaction
       *
       *  // Sign with the second key
       *  builder.sign(key2);
       *  if (builder.isFullySigned()){
       *   var tx = builder.build();
       *  }
       *
       *  var selectedUnspent = build.getSelectedUnspent(); // Retrieve selected unspent outputs from the transaction
       */

      var txid = tx.getHash().toString('hex');
      console.log('Created transaction with txid ' + txid);
      var raw_tx = tx.serialize().toString('hex');
      console.log('Transaction raw hex dump:');
      console.log('-------------------------------------');
      console.log(raw_tx);
      console.log('-------------------------------------');
      // finally, send transaction to the bitcoin network
      conn.sendTx(tx);

      // for now, the network won't respond in any case
      // (transaction accepted, transaction rejected)
      // in the future, we may listen to 'reject' message
      // see https://gist.github.com/gavinandresen/7079034
    }
  });

  peerman.start();

};

module.exports.run = run;
if (require.main === module) {
  run();
}
