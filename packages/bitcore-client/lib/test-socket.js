const SocketClient  = require('./socket');
const client = new SocketClient('http://localhost:3000');

client.io.on('connect', () => {
  client.onBlock(console.log);
  client.onTx(console.log);
  client.onAddressTx('1VayNert3x1KzbpzMGt2qdqrAThiRovi8', console.log);
});


