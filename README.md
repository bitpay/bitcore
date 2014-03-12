Bitcore
=======

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

It is a collection of objects useful to bitcoin applications; class-like idioms are enabled via [Soop](https://github.com/gasteve/soop). In most cases, a developer will require the object's class directly:
```
var Address = require('bitcore/Address');
```

#Examples

Some examples are provided at the [examples](/examples) path. Here are some snippets:

## Validating an address
Validating a Bitcoin address:
```js
var Address = require('bitcore/Address');

var addrs = [
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7Dixxxx',
  'A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  '1600 Pennsylvania Ave NW',
].map(function(addr) {
  return Address.new(addr);
});

addrs.forEach(function(addr) {
  var valid = addr.isValid();
  console.log(addr.data + ' is ' + (valid ? '' : 'not ') + 'valid');
});
```
## Monitoring Blocks and Transactions
For this example you need a running bitcoind instance with RPC enabled. 
```js
var util        = require('util');
var networks    = require('bitcore/networks');
var Peer        = require('bitcore/Peer');
var PeerManager = require('soop').load('bitcore/PeerManager',
  {network: networks.testnet});

var handleBlock = function(info) {

  console.log('** Block Received **');
  console.log(info.message);

};

var handleTx = function(info) {

  var tx = info.message.tx.getStandardizedObject();

  console.log('** Block TX **');
  console.log(tx);

};

var handleInv = function(info) {

  console.log('** Block Inv **');
  console.log(info.message);

  var invs = info.message.invs;
  info.conn.sendGetData(invs);

};

var peerman = new PeerManager();

peerman.addPeer( new Peer('127.0.0.1', 18333) );
  
peerman.on('connection', function(conn) {
  conn.on('inv',   handleInv);
  conn.on('block', handleBlock);
  conn.on('tx',    handleTx);
});

peerman.start();

```

PeerManager will emit the following events: 'version', 'verack', 'addr', 'getaddr', 'error' 'disconnect'; and will relay events like: 'tx', 'block', 'inv'. Please see  [PeerManager.js](PeerManager.js), [Peer.js](Peer.js) and [Connection.js](Connection.js)


## Creating and sending a Transaction through P2P
For this example you need a running bitcoind instance with RPC enabled. 
```js
var networks    = require('bitcore/networks');
var Peer        = require('bitcore/Peer');
var Transaction = require('bitcore/Transaction');
var Address     = require('bitcore/Address');
var Script      = require('bitcore/Script');
var coinUtil    = require('bitcore/util/util');
var PeerManager = require('soop').load('bitcore/PeerManager',
  {network: networks.testnet});

var createTx = function() {

  var TXIN   = 'd05f35e0bbc495f6dcab03e599c8f5e32a07cdb4bc76964de201d06a2a7d8265';
  var TXIN_N = 0;
  var ADDR   = 'muHct3YZ9Nd5Pq7uLYYhXRAxeW4EnpcaLz';
  var VAL    = '1.234';

  var txobj = {
    version:   1,
    lock_time: 0,
    ins:       [],
    outs:      []
  }

  var txin = {
    s: coinUtil.EMPTY_BUFFER, // Add signature
    q: 0xffffffff
  };

  var hash = new Buffer(TXIN.split('').reverse(), 'hex');

  var vout    = parseInt(TXIN_N);
  var voutBuf = new Buffer(4);

  voutBuf.writeUInt32LE(vout, 0);
  txin.o = Buffer.concat([hash, voutBuf]);
  txobj.ins.push(txin);

  var addr     = Address.new(ADDR);
  var script   = Script.createPubKeyHashOut(addr.payload());
  var valueNum = coinUtil.parseValue(VAL);
  var value    = coinUtil.bigIntToValue(valueNum);

  var txout = {
    v: value,
    s: script.getBuffer(),
  };
  txobj.outs.push(txout);

  return new Transaction(txobj);

};

var peerman = new PeerManager();
peerman.addPeer(new Peer('127.0.0.1', 18333));

peerman.on('connect', function(conn) {

  var conn = peerman.getActiveConnection();

  if (conn) {
    conn.sendTx(createTx());
  }

  conn.on('reject', function () {
    console.log('Transaction Rejected'); 
  });

});

peerman.start();
```

## Consuming bitcoind RPC
For this example you need a running bitcoind instance with RPC enabled. 
```js
var util      = require('util');
var RpcClient = require('bitcore/RpcClient');
var hash      = process.argv[2] || '0000000000b6288775bbd326bedf324ca8717a15191da58391535408205aada4';

 var config =  {   
   protocol: 'http',
   user:     'user',
   pass:     'pass',
   host:     '127.0.0.1',
   port:     '18332',
};
 
var rpc   = new RpcClient(config);

rpc.getBlock(hash, function(err, ret) {

  if(err) {
    console.error("An error occured fetching block", hash);
    console.error(err);
    return;
  }

  console.log(ret);

});
```
Check the list of all supported RPC call at [RpcClient.js](RpcClient.js)

## Parsing a Script 

Gets an address strings from a  ScriptPubKey Buffer

```
  var Address = require('bitcore/Address');
  var coinUtil= require('bitcore/util/util');

  var getAddrStr = function(s) {
    var addrStrs = [];
    var type = s.classify();
    var addr;

    switch (type) {
      case Script.TX_PUBKEY:
        var chunk = s.captureOne();
        addr = Address.new(network.addressPubkey, coinUtil.sha256ripe160(chunk));
        addrStrs.push(addr.toString());
        break;
      case Script.TX_PUBKEYHASH:
        addr = Address.new(network.addressPubkey, s.captureOne());
        addrStrs.push(addr.toString());
        break;
      case Script.TX_SCRIPTHASH:
        addr = Address.new(network.addressScript, s.captureOne());
        addrStrs.push(addr.toString());
        break;
      case Script.TX_MULTISIG:
        var chunks = s.capture();
        chunks.forEach(function(chunk) {
          var a = Address.new(network.addressPubkey, coinUtil.sha256ripe160(chunk));
          addrStrs.push(a.toString());
        });
        break;
      case Script.TX_UNKNOWN:
        break;
    }
    return addrStrs;
  };

  var s = new Script(scriptBuffer);
  console.log(getAddrStr(s);
  
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


#License

**Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).**

Copyright 2013-2014 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.


[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/bitpay/bitcore/trend.png)](https://bitdeli.com/free "Bitdeli Badge")

