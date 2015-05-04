#!/usr/bin/env node

'use strict';

var _ = require('lodash');
var io = require('socket.io');

var DEFAULT_PORT = 3380;

var port = parseInt(process.argv[2]) || DEFAULT_PORT;

var server = io(port);
server.on('connection', function(socket) {
  socket.on('notification', function(data) {
    server.emit('notification', data);
  });
});

console.log('Message queue server listening on port ' + port)
