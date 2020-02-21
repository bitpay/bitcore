#!/usr/bin/env node
import io from 'socket.io';

const log = require('npmlog');
log.debug = log.verbose;

const DEFAULT_PORT = 3380;

const opts = {
  port: parseInt(process.argv[2]) || DEFAULT_PORT
};

const server = io(opts.port.toString());
server.on('connection', socket => {
  socket.on('msg', data => {
    server.emit('msg', data);
  });
});

console.log('Message broker server listening on port ' + opts.port);
