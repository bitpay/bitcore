const io = require('socket.io-client');
class SocketClient {
  constructor(url) {
    this.url = url;
    this.io = io('http://localhost');
  }

  onBlock(handler) {
    handler('onBlock');
    const socket = this.io('/inv');
    socket.on('connect', () => {
      socket.on('block', (block)=> {
        handler(block);
      });
    });
  }

  onTx(handler) {
    handler('onTx');
    const socket = io('/inv');
    socket.on('connect', () => {
      socket.on('tx', (tx)=> {
        handler(tx);
      });
    });
  }

  onAddressTx(address, handler) {
    handler('onAddressTx');
    const socket = io('/' + address);
    socket.on('connect', () => {
      socket.on(address, (tx)=> {
        handler(tx);
      });
    });
  }
}

module.exports = SocketClient;
