var Peer = require('../lib/Peer');
var Connection = require('../lib/Connection');
var dns = require('dns');

// get a peer from dns seed
dns.resolve('dnsseed.bluematt.me', function(err, seeds) {
  // use the first peer
  var peer = new Peer(seeds[0], 8333);

  //Custom peer:
  //var peer = new Peer('180.153.139.246', '8888');

  // create a connection without an existing socket
  // but specify a socks5 proxy to create a socket 
  // that's bound to that proxy in it's place
  var connection = new Connection(null, peer, {
    proxy: {
      host: '127.0.0.1',
      port: 9050
    }
  });

  connection.open();

  connection.on('connect', function(data) {
    console.log('connected through socks5!');
  });

  connection.on('error', function(err) {
    console.log('There was an error running this example.');
    console.log('Are you running Tor? Tor must running for this example to work.');
    console.log('If you still get an error, you may need to use a different proxy from here:');
    console.log('http://sockslist.net/');
    //console.log(err);
  });

});
