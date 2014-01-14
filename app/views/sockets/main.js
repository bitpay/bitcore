'use strict';

var Transaction = require('../../models/Transaction');

// server-side socket behaviour

var io = null;

module.exports.init = function(app, io_ext) {
  io = io_ext;
  io.set('log level', 1); // reduce logging
  io.sockets.on('connection', function(socket) {
    Transaction.findOne(function(err, tx) {
      setTimeout(function() {
        socket.emit('tx', tx);
      }, 5000);
    });
  });
};


module.exports.broadcast_tx = function(tx) {
  io.sockets.emit('tx', tx);
};
