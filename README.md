Bitcore
=======

[![Build Status](https://travis-ci.org/bitpay/bitcore.svg?branch=master)](https://travis-ci.org/bitpay/bitcore)

A pure, powerful core for your bitcoin project.

Bitcore is a complete, native interface to the Bitcoin network, and provides the core functionality needed to develop apps for bitcoin.

#Principles

Bitcoin is a powerful new peer-to-peer platform for the next generation of financial technology. The decentralized nature of the Bitcoin network allows for highly resilient bitcoin infrastructure, and the developer community needs reliable, open-source tools to implement bitcoin apps and services.

**Bitcore unchains developers from fallible, centralized APIs, and provides the tools to interact with the real Bitcoin network.**

#Get Started

Bitcore runs on [node](http://nodejs.org/), and can be installed via [npm](https://npmjs.org/):

```
npm install bitcore
```

It is a collection of objects useful to bitcoin applications; class-like idioms are enabled via [Soop](https://github.com/bitpay/soop). In most cases, a developer will require the object's class directly. For instance:

```
var bitcore = require('bitcore');
var Address = bitcore.Address;
var Transaction = bitcore.Transaction;
var PeerManager = bitcore.PeerManager;
```

#Examples

Some examples are provided at the [examples](/examples) path. Here are some snippets:

## Validating an address

Validating a Bitcoin address:

```js
var bitcore = require('bitcore');
var Address = bitcore.Address;

var addrs = [
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7Dixxxx',
  'A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  '1600 Pennsylvania Ave NW',
].map(function(addr) {
  return new Address(addr);
});

addrs.forEach(function(addr) {
  var valid = addr.isValid();
  console.log(addr.data + ' is ' + (valid ? '' : 'not ') + 'valid');
});
```

## Monitoring Blocks and Transactions

For this example you need a running bitcoind instance with RPC enabled. 

```js
  var bitcore = require('../bitcore');
  var Peer = bitcore.Peer;
  var PeerManager = bitcore.PeerManager;

  var handleBlock = function(info) {
    console.log('** Block Received **');
    console.log(info.message);
  };

  var handleTx = function(info) {
    var tx = info.message.tx.getStandardizedObject();

    console.log('** TX Received **');
    console.log(tx);
  };

  var handleInv = function(info) {
    console.log('** Inv **');
    console.log(info.message);

    var invs = info.message.invs;
    info.conn.sendGetData(invs);
  };

  var peerman = new PeerManager({
    network: 'testnet'
  });

  peerman.addPeer(new Peer('127.0.0.1', 18333));

  peerman.on('connection', function(conn) {
    conn.on('inv', handleInv);
    conn.on('block', handleBlock);
    conn.on('tx', handleTx);
  });

  peerman.start();
```

PeerManager will emit the following events: 'version', 'verack', 'addr', 'getaddr', 'error' 'disconnect'; and will relay events like: 'tx', 'block', 'inv'. Please see  [PeerManager.js](PeerManager.js), [Peer.js](Peer.js) and [Connection.js](Connection.js)

## Consuming bitcoind RPC

For this example you need a running bitcoind instance with RPC enabled.

```js
var bitcore = require('bitcore');
var RpcClient = bitcore.RpcClient;
var hash = '0000000000b6288775bbd326bedf324ca8717a15191da58391535408205aada4';

var config = {
  protocol: 'http',
  user: 'user',
  pass: 'pass',
  host: '127.0.0.1',
  port: '18332',
};

var rpc = new RpcClient(config);

rpc.getBlock(hash, function(err, ret) {
  if (err) {
    console.error('An error occured fetching block', hash);
    console.error(err);
    return;
  }
  console.log(ret);
});
```

Check the list of all supported RPC call at [RpcClient.js](RpcClient.js)

## Creating and sending a Transaction through P2P

The fee of the transaction can be given in `opts` or it will be determined 
by the transaction size. Documentation on the parameters of `TransactionBuilder`
can be found on the source file.

```js
  var bitcore = require('bitcore');
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
      console.log('Created transaction with txid '+txid);
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
```

## Parsing a Script

Gets an address strings from a ScriptPubKey Buffer

```js
var bitcore = require('bitcore');
var Address = bitcore.Address;
var coinUtil = bitcore.util;
var Script = bitcore.Script;
var network = bitcore.networks.testnet;

var getAddrStr = function(s) {
  var addrStrs = [];
  var type = s.classify();
  var addr;

  switch (type) {
    case Script.TX_PUBKEY:
      var chunk = s.captureOne();
      addr = new Address(network.addressVersion, coinUtil.sha256ripe160(chunk));
      addrStrs.push(addr.toString());
      break;
    case Script.TX_PUBKEYHASH:
      addr = new Address(network.addressVersion, s.captureOne());
      addrStrs.push(addr.toString());
      break;
    case Script.TX_SCRIPTHASH:
      addr = new Address(network.P2SHVersion, s.captureOne());
      addrStrs.push(addr.toString());
      break;
    case Script.TX_MULTISIG:
      var chunks = s.capture();
      chunks.forEach(function(chunk) {
        var a = new Address(network.addressVersion, coinUtil.sha256ripe160(chunk));
        addrStrs.push(a.toString());
      });
      break;
    case Script.TX_UNKNOWN:
      console.log('tx type unkown');
      break;
  }
  return addrStrs;
};

var script = 'DUP HASH160 0x14 0x3744841e13b90b4aca16fe793a7f88da3a23cc71 EQUALVERIFY CHECKSIG';
var s = Script.fromHumanReadable(script);
console.log(getAddrStr(s)[0]); // mkZBYBiq6DNoQEKakpMJegyDbw2YiNQnHT
```

#Security

Please use at your own risk.

Bitcore is still under heavy development and not quite ready for "drop-in" production use. If you find a security issue, please email security@bitcore.io.

#Contributing

Bitcore needs some developer love. Please send pull requests for bug fixes, code optimization, and ideas for improvement.

#Browser support

## Building the browser bundle

To build bitcore full bundle for the browser (this is automatically executed after you run `npm install`):

```
node browser/build.js -a
```

This will generate a `browser/bundle.js` file which you can include in your HTML to use bitcore in the browser.

##Example browser usage

From example/simple.html
```
<!DOCTYPE html>
<html>
  <body>
    <script src="../browser/bundle.js"></script>
    <script>
      var bitcore = require('bitcore');
      var Address = bitcore.Address;
      var a = new Address('1KerhGhLn3SYBEQwby7VyVMWf16fXQUj5d');
      console.log('1KerhGhLn3SYBEQwby7VyVMWf16fXQUj5d is valid? '+a.isValid());
    </script>
  </body>
</html>
```

You can check a more complex usage example at examples/example.html.

## Generating a customized browser bundle

To generate a customized bitcore bundle, you can specify which submodules you want to include in it with the -s option:

```
node browser/build.js -s Transaction,Address
```

This will generate a `browser/bundle.js` containing only the Transaction and Address class, with all their dependencies.  Use this option if you are not using the whole bitcore library, to optimize the bundle size, script loading time, and general resource usage.

## Tests

Run tests in node:

```
mocha
```

Or generate tests in the browser:

```
grunt shell
```

And then open test/index.html in your browser.

To run the code coverage report:

```
npm run-script coverage
```

And then open coverage/lcov-report/index.html in your browser.

#License

**Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).**

Copyright 2013-2014 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.

[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/bitpay/bitcore/trend.png)](https://bitdeli.com/free "Bitdeli Badge")
