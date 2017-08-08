const io = require('socket.io')

module.exports = function addressrouter(server) {
  io.(server);

  io.on('connection', (socket) => {
    console.log(socket);
  })

};
