<a name="Peer"></a>
#class: Peer
**Members**

* [class: Peer](#Peer)
  * [new Peer(host, [port], [network])](#new_Peer)
  * [peer.setProxy(host, port)](#Peer#setProxy)
  * [peer.connect()](#Peer#connect)
  * [peer.disconnect()](#Peer#disconnect)
  * [peer.sendMessage(message)](#Peer#sendMessage)
  * [peer._sendVersion()](#Peer#_sendVersion)
  * [peer._sendPong()](#Peer#_sendPong)
  * [peer._readMessage()](#Peer#_readMessage)
  * [peer._getSocket()](#Peer#_getSocket)

<a name="new_Peer"></a>
##new Peer(host, [port], [network])
A Peer instance represents a remote bitcoin node and allows to communicate
with it using the standar messages of the bitcoin p2p protocol.

**Params**

- host `String` - IP address of the remote host  
- \[port\] `Number` - Port number of the remote host  
- \[network\] `Network` - The context for this communication  

**Returns**: [Peer](#Peer) - A new instance of Peer.  
**Example**  
```javascript

var peer = new Peer('127.0.0.1').setProxy('127.0.0.1', 9050);
peer.on('tx', function(tx) {
 console.log('New transaction: ', tx.id);
});
peer.connect();
```

<a name="Peer#setProxy"></a>
##peer.setProxy(host, port)
Set a socks5 proxy for the connection. Enables the use of the TOR network.

**Params**

- host `String` - IP address of the proxy  
- port `Number` - Port number of the proxy  

**Returns**: [Peer](#Peer) - The same Peer instance.  
<a name="Peer#connect"></a>
##peer.connect()
Init the connection with the remote peer.

**Returns**: `Socket` - The same peer instance.  
<a name="Peer#disconnect"></a>
##peer.disconnect()
Disconnects the remote connection.

**Returns**: `Socket` - The same peer instance.  
<a name="Peer#sendMessage"></a>
##peer.sendMessage(message)
Send a Message to the remote peer.

**Params**

- message `Message` - A message instance  

<a name="Peer#_sendVersion"></a>
##peer._sendVersion()
Internal function that sends VERSION message to the remote peer.

<a name="Peer#_sendPong"></a>
##peer._sendPong()
Send a PONG message to the remote peer.

<a name="Peer#_readMessage"></a>
##peer._readMessage()
Internal function that tries to read a message from the data buffer

<a name="Peer#_getSocket"></a>
##peer._getSocket()
Internal function that creates a socket using a proxy if neccesary.

**Returns**: `Socket` - A Socket instance not yet connected.  
