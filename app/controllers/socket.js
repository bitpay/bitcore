'use strict';

// server-side socket behaviour

// io is a variable already taken in express
var ios = null;

module.exports.init = function(app, io_ext) {
  ios = io_ext;
  ios.set('log level', 1); // reduce logging
  ios.sockets.on('connection', function() {
  });
};


module.exports.broadcast_tx = function(tx) {
  ios.sockets.emit('tx', tx);
};


module.exports.broadcast_block = function(block) {
  ios.sockets.emit('block', block);
};

module.exports.broadcastSyncInfo = function(syncInfo) {
  ios.sockets.emit('sync', syncInfo);
};
