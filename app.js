#!/usr/bin/env node

var ExpressApp = require('./lib/expressapp');

var basePath = process.env.BWS_BASE_PATH || '/bws/api';
var port = process.env.BWS_PORT || 3001;

var app = ExpressApp.start({
  basePath: basePath,
});
//app.listen(port);

var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(port);

io.sockets.on('connection', function(socket) {
  socket.emit('message', {
    'message': 'hello world'
  });
});

console.log('Bitcore Wallet Service running on port ' + port);
