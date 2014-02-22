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

It is a collection of objects useful to bitcoin applications; class-like idioms are enabled via [Classtool](https://github.com/gasteve/classtool). In most cases, a developer will require the object's class directly:
```
var Address = require('bitcore/Address').class();
```

#Examples

Some examples are provided at the [examples](/examples) path. Here are some snippets:

## Validating an address
Validating a Bitcoin address:
```
var Address = require('bitcore/Address').class();
var addr = new Address("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");

try {
  addr.validate();
  console.log("Address is valid.");
} catch(e) {
  console.log(addr.data + " is not a valid address. " + e);
}
```
## Monitoring Blocks and Transactions
```
var networks = require('bitcore/networks');
var Peer = require('bitcore/Peer').class();
var PeerManager = require('bitcore/PeerManager').createClass({
  network: networks.testnet
});
var util= require('util');


var handleBlock = function(b) {
  console.log('block received:', util.inspect(b.message,{depth:null}));
};

var handleTx = function(b) {
  var tx = info.message.tx.getStandardizedObject();
  console.log('block tx:',  util.inspect(tx,{depth:null}));
};

var handleInv = function(b) {
  console.log('block inv:',  util.inspect(info.message,{depth:null}));
  var invs = info.message.invs;
  info.conn.sendGetData(invs);
};


var peerman = new PeerManager();
peerman.addPeer( new Peer('127.0.0.1',18333) );
peerman.on('connection', function(conn) {
  conn.on('inv',  handleInv);
  conn.on('block', handleBlock);
  conn.on('tx', handleTx);
});
peerman.start();
```

PeerManager will emit the following events: 'version', 'verack', 'addr', 'getaddr', 'error' 'disconnect'; and will relay events like: 'tx', 'block', 'inv'. Please see  [PeerManager.js](PeerManager.js), [Peer.js](Peer.js) and [Connection.js](Connection.js)


## Creating and sending a Transaction through P2P
```
var networks    = require('bitcore/networks');
var Peer        = require('bitcore/Peer').class();
var Transaction = require('bitcore/Transaction').class();
var Address     = require('bitcore/Address').class();
var Script      = require('bitcore/Script').class();
var coinUtil    = require('bitcore/util/util');
var PeerManager = require('bitcore/PeerManager').createClass({
  network: networks.testnet
});

var createTx = function() {
  var TXIN='d05f35e0bbc495f6dcab03e599c8f5e32a07cdb4bc76964de201d06a2a7d8265';
  var TXIN_N=0;
  var ADDR='muHct3YZ9Nd5Pq7uLYYhXRAxeW4EnpcaLz';
  var VAL='1.234';
  var txobj = {};
  txobj.version = 1;
  txobj.lock_time = 0;
  txobj.ins = [];
  txobj.outs = [];
  var txin = {};
  txin.s = coinUtil.EMPTY_BUFFER;   //Add signature
  txin.q = 0xffffffff;

  var hash = new Buffer(TXIN, 'hex');
  hash.reverse();
  var vout = parseInt(TXIN_N);
  var voutBuf = new Buffer(4);
  voutBuf.writeUInt32LE(vout, 0);
  txin.o = Buffer.concat([hash, voutBuf]);
  txobj.ins.push(txin);

  var addr = new Address(ADDR);
  var script = Script.createPubKeyHashOut(addr.payload());
  var valueNum = coinUtil.parseValue(VAL);
  var value = coinUtil.bigIntToValue(valueNum);

  var txout = {
    v: value,
    s: script.getBuffer(),
  };
  txobj.outs.push(txout);

  return new Transaction(txobj);
};

var peerman = new PeerManager();
peerman.addPeer( new Peer('127.0.0.1',18333) );
peerman.on('connect', function(conn) {
  var conn = peerman.getActiveConnection();
  if (conn)
    conn.sendTx(createTx());
  conn.on('reject', function () { console.log('Transaction Rejected'); } );
});
peerman.start();
```

## Consuming bitcoind RPC
```
var RpcClient = require('../RpcClient').class();
var config =  {   
   protocol:  'http',
   user:  'user',
   pass:  'pass',
   host:  '127.0.0.1',
   port:  '18332',
};
var rpc   = new RpcClient(config);
rpc.getBlock( hash,  function(err, ret) {
  console.log(err);
  console.log(util.inspect(ret, { depth: 10} ));
});
```
Check the list of all supported RPC call at [RpcClient.js](RpcClient.js)

## Parsing a Script 

Gets an address strings from a  ScriptPubKey Buffer

```
  var Address = require('bitcore/Address').class();
  var coinUtil= require('bitcore/util/util');

  var getAddrStr = function(s) {
    var addrStrs = [];
    var type = s.classify();
    var addr;

    switch (type) {
      case Script.TX_PUBKEY:
        var chunk = s.captureOne();
        addr = new Address(network.addressPubkey, coinUtil.sha256ripe160(chunk));
        addrStrs.push(addr.toString());
        break;
      case Script.TX_PUBKEYHASH:
        addr = new Address(network.addressPubkey, s.captureOne());
        addrStrs.push(addr.toString());
        break;
      case Script.TX_SCRIPTHASH:
        addr = new Address(network.addressScript, s.captureOne());
        addrStrs.push(addr.toString());
        break;
      case Script.TX_MULTISIG:
        var chunks = s.capture();
        chunks.forEach(function(chunk) {
          var a = new Address(network.addressPubkey, coinUtil.sha256ripe160(chunk));
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
Work to enable Bitcore for use in the browser is ongoing. To build bitcore for the browser:
```
npm install -g grunt-cli
grunt browserify
```


#License

**Code released under [the MIT license](https://github.com/bitpay/bitcore/blob/master/LICENSE).**

Copyright 2013-2014 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.


[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/bitpay/bitcore/trend.png)](https://bitdeli.com/free "Bitdeli Badge")

