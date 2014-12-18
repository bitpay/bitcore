<a name="Pool"></a>
#class: Pool
**Members**

* [class: Pool](#Pool)
  * [new Pool(network)](#new_Pool)
  * [pool.connect()](#Pool#connect)
  * [pool.disconnect()](#Pool#disconnect)
  * [pool.numberConnected()](#Pool#numberConnected)
  * [pool._fillConnections()](#Pool#_fillConnections)
  * [pool._removeConnectedPeer(addr)](#Pool#_removeConnectedPeer)
  * [pool._connectPeer(addr)](#Pool#_connectPeer)
  * [pool._deprioritizeAddr(addr)](#Pool#_deprioritizeAddr)
  * [pool._addAddr(addr)](#Pool#_addAddr)
  * [pool._addAddrsFromSeed(seed, done)](#Pool#_addAddrsFromSeed)
  * [pool._addAddrsFromSeeds(done)](#Pool#_addAddrsFromSeeds)
  * [pool.inspect()](#Pool#inspect)

<a name="new_Pool"></a>
##new Pool(network)
A pool is a collection of Peers. A pool will discover peers from DNS seeds, and
collect information about new peers in the network. When a peer disconnects the pool
will connect to others that are available to maintain a max number of
ongoing peer connections. Peer events are relayed to the pool.

**Params**

- network `Network` | `String` - The network to connect  

**Returns**: [Pool](#Pool)  
**Example**  
```javascript

var pool = new Pool(Networks.livenet);
pool.on('peerinv', function(peer, message) {
  // do something with the inventory announcement
});
pool.connect();
```

<a name="Pool#connect"></a>
##pool.connect()
Will initiatiate connection to peers, if available peers have been added to
the pool, it will connect to those, otherwise will use DNS seeds to find
peers to connect. When a peer disconnects it will add another.

<a name="Pool#disconnect"></a>
##pool.disconnect()
Will disconnect all peers that are connected.

<a name="Pool#numberConnected"></a>
##pool.numberConnected()
**Returns**: `Number` - The number of peers currently connected.  
<a name="Pool#_fillConnections"></a>
##pool._fillConnections()
Will fill the conneted peers to the maximum amount.

<a name="Pool#_removeConnectedPeer"></a>
##pool._removeConnectedPeer(addr)
Will remove a peer from the list of connected peers.

**Params**

- addr `Object` - An addr from the list of addrs  

<a name="Pool#_connectPeer"></a>
##pool._connectPeer(addr)
Will connect a peer and add to the list of connected peers.

**Params**

- addr `Object` - An addr from the list of addrs  

<a name="Pool#_deprioritizeAddr"></a>
##pool._deprioritizeAddr(addr)
Will deprioritize an addr in the list of addrs by moving it to the end
of the array, and setting a retryTime

**Params**

- addr `Object` - An addr from the list of addrs  

<a name="Pool#_addAddr"></a>
##pool._addAddr(addr)
Will add an addr to the beginning of the addrs array

**Params**

- addr `Object`  

<a name="Pool#_addAddrsFromSeed"></a>
##pool._addAddrsFromSeed(seed, done)
Will add addrs to the list of addrs from a DNS seed

**Params**

- seed `String` - A domain name to resolve known peers  
- done `function`  

<a name="Pool#_addAddrsFromSeeds"></a>
##pool._addAddrsFromSeeds(done)
Will add addrs to the list of addrs from network DNS seeds

**Params**

- done `function`  

<a name="Pool#inspect"></a>
##pool.inspect()
**Returns**: `String` - A string formatted for the console  
