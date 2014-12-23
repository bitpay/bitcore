title: JSON-RPC
description: A simple interface to connect and make RPC calls to bitcoind.
---
# JSON-RPC

## Description

Bitcoind provides a direct interface to the bitcoin network and it also exposes a `JSON-RPC` API. This class will connect to a local instance of a bitcoind server and make simple or batch RPC calls to it.

## Connection to bitcoind

First you will need a running instance of bitcoind, setting up a username and password to connect with it. For more information about running bitcoind please refer to the [official documentation](https://en.bitcoin.it/wiki/Running_Bitcoin).

The code for creating and configuring an instance of the RPC client looks like this:

```
var bitcore = require('bitcore');
var RPC = bitcore.transport.RPC;

var client = new RPC('username', 'password', {
  host: 'localhost',
  port: 18332,
  secure: false,
  disableAgent: true,
  rejectUnauthorized: true
});
```


## Examples

For more information please refer to the [API reference](https://en.bitcoin.it/wiki/API_reference_%28JSON-RPC%29).

```
var bitcore = require('bitcore');
var blockHash = '0000000000000000045d581af7fa3b6110266ece8131424d95bf490af828be1c';

var client = new bitcore.transport.RPC('username', 'password');

client.getBlock(blockHash, function(err, block) {
  // do something with the block
});

```
