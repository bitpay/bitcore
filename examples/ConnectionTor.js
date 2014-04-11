var Peer       = require('../Peer');
var Connection = require('../Connection');
var dns        = require('dns');

// get a peer from dns seed
dns.resolve('dnsseed.bluematt.me', function(err, seeds) {
  // use the first peer
  var peer = new Peer(seeds[0], 8333);
  
  // create a connection without an existing socket
  // but specify a socks5 proxy to create a socket 
  // that's bound to that proxy in it's place
  var connection = new Connection(null, peer, {
    proxy: { host: '127.0.0.1', port: 9050 }
  });

  connection.open();

  connection.on('connect', function(data) {
    console.log('connected through socks5!');
  });

  connection.on('error', function(err) {
    console.log(err);
  });

});
