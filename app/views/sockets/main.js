'use strict';

var Transaction = require('../../models/Transaction');

module.exports = function(app, io) {
  io.set('log level', 1); // reduce logging
  io.sockets.on('connection', function(socket) {
    socket.emit('tx', Transaction.findOne());
    socket.on('my other event', function(data) {
      console.log(data);
    });
  });
};

