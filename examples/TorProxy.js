var Socks5Client = require('socks5-client');
var Peer         = require('../Peer');
var Connection   = require('../Connection');
var SeedList     = require('../SeedList')

// start looking for a seed
var seedlist     = new SeedList();
// create a client socket proxied through
// tor's socks5 proxy
var client       = new Socks5Client('127.0.0.1', 9050);

// when we have a list of seeds...
seedlist.on('seedsFound', function(seeds) {
  // use the first seed in list
  var peer       = new Peer(seeds[0], 8333);
  var connection = new Connection(client, peer);
  // open the connection to the seed
  client.connect(peer.port, peer.host);
  // always handle errors
  connection.on('error', function(err) {
    console.log(err);
  });
});

// failboat
seedlist.on('seedsNotFound', function() {
  console.log('failed to find seeds :(');
});

// double failboat
seedlist.on('error', function(err) {
  console.log('error:', err);
});
