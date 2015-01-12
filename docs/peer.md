title: Peer
description: The Peer class provides a simple interface for connecting to a node in the bitcoin network.
---
# Peer

## Description

Represents a node from the p2p bitcoin network. The Peer class supports connecting directly to other nodes or through a socks5 proxy like Tor.

## Creating a peer

The code to create a new peer looks like this:

```javascript
var bitcore = require('bitcore');
var Peer = bitcore.transport.Peer;

// default port
var livenetPeer = new Peer('5.9.85.34');
var testnetPeer = new Peer('5.9.85.34', bitcore.testnet);

// custom port
var livenetPeer = new Peer('5.9.85.34', 8334);
var testnetPeer = new Peer('5.9.85.34', 18334, bitcore.testnet);

// use sock5 proxy (Tor)
var peer = new Peer('5.9.85.34').setProxy('localhost', 9050);
```

## States

A peer instance is always in one of the following states:

* `disconnected`: No connection with the remote node.
* `connecting`: While establishing the connection.
* `connected`: Exchanging version packages.
* `ready`: Connection ready for sending and receiving messages.

You can subscribe to the change of those states as follows:

```javascript
var bitcore = require('bitcore');
var Peer = bitcore.transport.Peer;

var peer = new Peer('5.9.85.34');

peer.on('ready', function() {
  // peer info
  console.log(peer.version, peer.subversion, peer.bestHeight);
});

peer.on('disconnect', function() {
  console.log('connection closed');
});

peer.connect();
```

## Handle messages

Once connected, a peer instance can send and receive messages. Every time a message arrives it's emitted as a new event. Let's see an example of this:

```javascript
var bitcore = require('bitcore');
var peer = new bitcore.transport.Peer('5.9.85.34');

// handle events
peer.on('inv', function(message) {
  // message.inventory[]
});

peer.on('tx', function(message) {
  // message.transaction
});

peer.on('addr', function(message) {
  // message.addresses[]
});

peer.connect();
```

## Sending messages

In order to send messages the Peer class offers the `sendMessage(message)` method, which receives an instance of a message. All supported messages can be found on the `bitcore.transport.Messages` module. For more information about messages refer to the [protocol specification](https://en.bitcoin.it/wiki/Protocol_specification).

An example for requesting other connected nodes to a peers looks like this:

```javascript
var bitcore = require('bitcore');
var peer = new bitcore.transport.Peer('5.9.85.34');

peer.on('ready', function() {
  var message = new bitcore.transport.Messages.GetAddresses();
  peer.sendMessage(message);
});

peer.on('addr', function(message) {
  message.addresses.forEach(function(address) {
    // do something
  });
});

peer.connect();
```
