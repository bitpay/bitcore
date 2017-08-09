
module.exports = function addressrouter(server) {
  const io = require('socket.io')(server);

  io.on('connection', (socket) => {
    //console.log(socket);
  })

};
