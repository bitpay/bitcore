
module.exports = function addressrouter(express) {
  const io = require('socket.io')(express);

  console.log('starting sockets')

  io.on('connection', (socket) => {
    socket.on('subscribe', (data) => {
      console.log('subscribe message');
      console.log(data);
    });

    socket.on('message', (data) => {
      console.log('unsubscribe message');
      console.log(data);
    });

    socket.on('unsubscribe', (data) => {
      console.log('unsubscribe message');
      console.log(data);
    });

    socket.on('disconnect', (data) => {
      console.log('unsubscribe message');
      console.log(data);
    });
  });

};
