<a name="RPC"></a>
#class: RPC
**Members**

* [class: RPC](#RPC)
  * [new RPC(user, password, opts)](#new_RPC)
  * [rPC.batch(batchCallback, resultCallbak)](#RPC#batch)
  * [rPC._request(request, callbak)](#RPC#_request)

<a name="new_RPC"></a>
##new RPC(user, password, opts)
A JSON RPC client for bitcoind. An instances of RPC connects to a bitcoind
server and enables simple and batch RPC calls.

**Params**

- user `String` - username used to connect bitcoind  
- password `String` - password used to connect bitcoind  
- opts `Object` - Connection options: host, port, secure, disableAgent, rejectUnauthorized  

**Returns**: [RPC](#RPC)  
**Example**  
```javascript

var client = new RPC('user', 'pass');
client.getInfo(function(err, info) {
  // do something with the info
});
```

<a name="RPC#batch"></a>
##rPC.batch(batchCallback, resultCallbak)
Allows to excecute RPC calls in batch.

**Params**

- batchCallback `function` - Function that makes all calls to be excecuted in bach  
- resultCallbak `function` - Function to be called on result  

<a name="RPC#_request"></a>
##rPC._request(request, callbak)
Internal function to make an RPC call

**Params**

- request `Object` - Object to be serialized and sent to bitcoind  
- callbak `function` - Function to be called on result  

