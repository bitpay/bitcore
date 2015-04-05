var multilevel = require('multilevel');
var net = require('net');
var level = require('levelup');

var db = level('./db', {
  valueEncoding: 'json'
});
var PORT = 3002;


console.log('Server started at port ' + PORT + '...');
net.createServer(function(con) {
  con.pipe(multilevel.server(db)).pipe(con);
}).listen(PORT);
