// Change to have services push blocks/txs
module.exports = function addressrouter(io) {
  io.on('connection', (socket) => {
    socket.on('subscribe', (data) => {
    });

    socket.on('message', (data) => {
    });

    socket.on('unsubscribe', (data) => {
    });

    socket.on('disconnect', (data) => {
    });
  });
};
