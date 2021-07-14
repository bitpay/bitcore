# Messages

The bitcoin protocol specifies a set of [messages](https://en.bitcoin.it/wiki/Protocol_specification) that can be sent from peer to peer. `bitcore-p2p` provides support for some of these messages.

To create a message, you can use any of the message constructors, here is a simple example:

```javascript
var messages = new Messages();
var message = messages.Ping();
```

There are also several convenient helpers for inventory based messages:

```javascript
message = messages.GetData.forTransaction(txHash);
message = messages.GetData.forBlock(blockHash);
message = messages.Inventory.forTransaction(txHash);
```

As well as sending "tx" and "block" messages with Bitcore instances:

```javascript
message = messages.Block(block);
message = messages.Transaction(transaction);
```

Note: A list of further messages is available below.

For advanced usage, you can also customize which constructor is used for Block and Transaction messages by passing it as an argument to Messages, for example:

```javascript
var messages = new Messages({Block: MyBlock, Transaction: MyTransaction});
```

And additionally a custom network:

```javascript
var messages = new Messages({network: Networks.testnet});
```

## List of Messages

### Version

The version message (`ver`) is used on connection creation, to advertise the type of node. The remote node will respond with its version, and no communication is possible until both peers have exchanged their versions. By default, bitcore advertises itself as named `bitcore` with the current version of the `bitcore-p2p` package.

### VerAck

Finishes the connection handshake started by the `ver` message.

### Inventory

From the bitcoin protocol spec: "Allows a node to advertise its knowledge of one or more objects. It can be received unsolicited, or in reply to getblocks.".

### GetData

From the bitcoin protocol spec: `getdata` is used in response to `inv`, to retrieve the content of a specific object, and is usually sent after receiving an `inv` packet, after filtering known elements. It can be used to retrieve transactions, but only if they are in the memory pool or relay set - arbitrary access to transactions in the chain is not allowed to avoid having clients start to depend on nodes having full transaction indexes (which modern nodes do not).

GetData inherits from Inventory, as they both have the same structure.

### NotFound

notfound is a response to a getdata, sent if any requested data items could not be relayed, for example, because the requested transaction was not in the memory pool or relay set. Contains inventory information specifying which items were not found.

### Ping

Sent to another peer mainly to check the connection is still alive.

### Pong

Sent in response to a `ping` message.

### Address and GetAddresses

Provides information on known nodes of the network. `GetAddresses` is used to query another peer for known addresses.

### GetHeaders and Headers

`getheaders` allows a peer to query another about blockheaders. `headers` is sent in response to a `getheaders` message, containing information about block headers.

### GetBlocks and Block

Same as `getheaders` and `headers`, but the response comes one block at the time.

### Transaction

Message that contains a transaction.

## Custom Messages

It is possible to extend the default peer to peer messages and add custom ones. First you will need to create a message which resembles the default messages in `lib/messages/commands`.

Then to add the custom message:

```javascript
messages.add('custom', 'Custom', CustomMessage);

var customMessage = messages.Custom('argument');
```
