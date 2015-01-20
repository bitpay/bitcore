---
title: Peer-to-Peer Networking
description: Peer-to-Peer Networking Capabilities for Bitcore
---
# Peer-to-Peer

## Description

The `bitcore-p2p` module provides peer-to-peer networking capabilites for [Bitcore](https://github.com/bitpay/bitcore), and includes [Peer](peer.md) and [Pool](pool.md) classes. A [Message](messages.md) class is also exposed, in addition to [several types of messages](messages.md). Pool will maintain connection to several peers, Peers represents a node in the bitcoin network, and Message represents data sent to and from a Peer. For detailed technical information about the bitcoin protocol, please visit the [Protocol Specification](https://en.bitcoin.it/wiki/Protocol_specification) on the Bitcoin Wiki.

## Installation

Peer-to-peer is implemented as a seperate module.

For node projects:
```bash
npm install bitcore-p2p --save
```

For client-side projects:
```bash
bower install bitcore-p2p --save
```

## Quick Start

```javascript
var Peer = require('bitcore-p2p').Peer;
var peer = new Peer('5.9.85.34');

// handle events
peer.on('inv', function(message) {
  // message.inventory[]
});

peer.connect();

```