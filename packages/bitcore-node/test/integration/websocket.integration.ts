import socket = require( 'socket.io-client');
const connection = socket('http://locahost:3000');
connection.on('connect', () => {
  console.log('Connected to socket');
  connection.of('BTC/regtest/inv').on('block', console.log)
});

