#!/usr/bin/env node
import io from 'socket.io';
import logger from '../lib/logger';

const DEFAULT_PORT = 3380;

const opts = {
  port: parseInt(process.argv[2]) || DEFAULT_PORT
};

const server = new io.Server(opts.port);
server.on('connection', socket => {
  socket.on('msg', data => {
    server.emit('msg', data);
  });
});

logger.info('Message broker server listening on port ' + opts.port);
