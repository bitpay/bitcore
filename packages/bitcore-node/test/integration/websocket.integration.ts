import socket from 'socket.io-client';
const connection = socket('http://locahost:3000');
connection.on('connect', () => {
  console.log('Connected to socket');
  connection.on('BTC/regtest/inv', console.log)
});

