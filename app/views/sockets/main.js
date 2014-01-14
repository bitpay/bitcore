'use strict';

var Transaction = require('../../models/Transaction');

// server-side socket behaviour
module.exports = function(app, io) {
  io.set('log level', 1); // reduce logging
  io.sockets.on('connection', function(socket) {
    Transaction.findOne(function(err, tx) {
      setTimeout(function() {
        socket.emit('tx', tx);
      }, 5000);
    });
  });
};

