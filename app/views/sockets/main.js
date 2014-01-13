'use strict';

var Transaction = require('../../models/Transaction');

module.exports = function(app, io) {
  io.set('log level', 1); // reduce logging
  io.sockets.on('connection', function(socket) {
    Transaction.findOne(function(err, tx) {
      socket.emit('tx', tx);
    });
  });
};

