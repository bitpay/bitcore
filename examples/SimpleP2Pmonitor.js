/**
 * This is a simple script that will display network messages.
 * It users the Peer / Connection classes directly instead of
 * relying on PeerManager.
 */

// replace by require('bitcore') if you use somewhere else
var bitcore = require('../');

//bitcore.config.logger = 'debug';

var Peer = bitcore.Peer,
  Connection = bitcore.Connection;

var peer = new Peer('127.0.0.1', 8333);

var socket = peer.createConnection();

var con = new Connection(socket, peer);

con.on('error', function(msg) {
  var peer = msg.peer,
    err = msg.err;
  console.error('Error connecting to peer', peer.host + ':' + peer.port, '(' + err.message + ')');
});

con.on('disconnect', function(msg) {
  console.log('disconnect: ', msg);
});

con.on('connect', function(msg) {
  console.log('Connected to %s', msg.peer.host + ':' + msg.peer.port);
});

/* Listen P2P messages */

// Make a log function available to all listeners
// The log function is just like console.log except it prefixes 
// messages with [host:port]
function listen(event_name, fn) {
  con.on(event_name, function(event) {
    fn(event, function() {
      var args = Array.prototype.slice.call(arguments);
      var str = args.shift();
      str = '[%s:%s] ' + str;
      args = [str, event.peer.host, event.peer.port].concat(args);
      console.log.apply(console, args);
    });
  });
}

listen('getaddr', function(event, log) {
  log('Received message getaddr');
  log(event);
});

listen('verack', function(event, log) {
  log('Received message verack');
});

listen('version', function(event, log) {
  log('Received message version (%s)', event.message.version);
});

listen('addr', function(event, log) {
  log('Received message addr (%s addresses)', event.message.addrs.length);
});

listen('inv', function(event, log) {
  log('Received message inv (%s invs)', event.message.count);
  console.log(event.message.invs);
});
