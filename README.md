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
var bitcore = require('bitcore');
var networks = bitcore.networks;
var Peer = bitcore.Peer;
var PeerManager = require('soop').load('../PeerManager', {
  network: networks.testnet
});

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

var peerman = new PeerManager();

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
by the transaction size. Documentation on the paramets of `TransactionBuilder`
can be found on the source file.

```js
var bitcore = require('bitcore');
var networks = bitcore.networks;
var Peer = bitcore.Peer;
var TransactionBuilder = bitcore.TransactionBuilder;
var PeerManager = require('soop').load('../PeerManager', {
  network: networks.testnet
});

// this can be get from insight.bitcore.io API o blockchain.info

var unspent = [
    {
      "address": "n4g2TFaQo8UgedwpkYdcQFF6xE2Ei9Czvy",
      "txid": "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1",
      "scriptPubKey": "76a914fe021bac469a5c49915b2a8ffa7390a9ce5580f988ac",
      "vout": 1,
      "amount": 1.0101,
      "confirmations":7
    },
    {
      "address": "mhNCT9TwZAGF1tLPpZdqfkTmtBkY282YDW",
      "txid": "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc2",
      "scriptPubKey": "76a9141448534cb1a1ec44665b0eb2326e570814afe3f188ac",
      "vout": 0,
      "confirmations": 1,
      "amount": 10
    },
];

//private keys in WIF format (see TransactionBuilder.js for other options)
var keys = [
  "cSq7yo4fvsbMyWVN945VUGUWMaSazZPWqBVJZyoGsHmNq6W4HVBV",
  "cPa87VgwZfowGZYaEenoQeJgRfKW6PhZ1R65EHTkN1K19cSvc92G",
  "cPQ9DSbBRLva9av5nqeF5AGrh3dsdW8p2E5jS4P8bDWZAoQTeeKB"
];


var peerman = new PeerManager();
peerman.addPeer(new Peer('127.0.0.1', 18333));

peerman.on('connect', function() {
  var conn = peerman.getActiveConnection();
  if (conn) {
    var outs = [{address:toAddress, amount:amt}];
    var opts = {remainderOut: {address: changeAddressString}};
    var Builder = bitcore.TransactionBuilder;

    var tx = new Builder(opts)
      .setUnspent(Unspent)
      .setOutputs(outs)
      .sign(keys)
      .build();

   /* create and signing can be done in multiple steps using:
    *
    *  var builder = new bitcore.TransactionBuilder(opts)
    *             .setUnspent(utxos) 
    *             .setOutputs(outs);
    *  //later
    *  builder.sign(key1);
    *  // get partially signed tx
    *   var tx = builder.build();
    *
    *  //later
    *  builder.sign(key2);
    *  if (builder.isFullySigned()){
    *   var tx = builder.build();
    *  }
    *
    *  The selected Unspent Outputs for the transaction can be retrieved with:
    *    var selectedUnspent = build.getSelectedUnspent();
    */
    conn.sendTx(tx.serialize().toString('hex'));
  }
  conn.on('reject', function() {
    console.log('Transaction Rejected');
  });
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
To build bitcore full bundle for the browser:
(this is automatically executed after you run `npm install`)

```
node browser/build.js -a
```
This will generate a `browser/bundle.js` file which you can include
in your HTML to use bitcore in the browser.

## 

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

You can check a more complex usage example at examples/example.html

## Generating a customized browser bundle
To generate a customized bitcore bundle, you can specify 
which submodules you want to include in it with the -s option:

```
node browser/build.js -s Transaction,Address
```
This will generate a `browser/bundle.js` containing only the Transaction
 and Address class, with all their dependencies. 
Use this option if you are not using the whole bitcore library, to optimize
the bundle size, script loading time, and general resource usage.

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

