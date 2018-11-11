import socket = require( 'socket.io-client');
console.log('Attempting socket connection');
const connection = socket.connect('http://localhost:3000/BTC/regtest/inv');
connection.on('connect', () => {
  console.log('Connected to socket');
});
connection.on('block', console.log)

