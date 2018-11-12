import io = require('socket.io-client');
console.log('Attempting socket connection');
const socket = io.connect('http://localhost:3000', {transports: ['websocket']});
socket.on('connect', () => {
  console.log('Connected to socket');
  socket.emit('room', '/BTC/regtest/inv');
});
socket.on('block', payload => {
  console.log(payload);
});
socket.on('disconnect', () => {
  console.log('Socket disconnected');
});
