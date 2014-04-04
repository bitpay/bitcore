var Peer       = require('../Peer');
var Connection = require('../Connection');

// create a peer instance from a know peer
// (later we can use built-in peer discovery)
// to get a peer to connect to you can run:
//
//  ~# dig dnsseed.bluematt.me
//
// (or use a different dns seed)
var peer = new Peer('108.13.10.109', 8333);

// create a connection without an existing socket
// but specify a socks5 proxy to create a socket 
// that's bound to that proxy in it's place
var connection = new Connection(null, peer, {
  proxy: { host: '127.0.0.1', port: 9050 }
});

// open the connection
connection.open();

// you can listen for the connect event
connection.on('connect', function(data) {
  // we are connected!
  console.log('connected');
});

connection.on('error', function(err) {
  // boo! :(
  console.log('poop');
});
