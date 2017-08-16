const server = require('.');
const io = require('socket.io')(server);

let refreshBlocks = false;
const txInterval = 200;
let txCounter = 0;

// Not quite debouncing
setInterval(() => {
  refreshBlocks = true;
}, 10000);


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

// Emit block refresh and txs
function processBlock(entry, block) {
  if (refreshBlocks) {
    refreshBlocks = false;
    emitBlock(entry);
  }
  block.txs.forEach((tx) => {
    txCounter++;
    if (txCounter % txInterval === 0) {
      txCounter = 0;
      emitTx(tx);
    }
  });
}

function emitBlock(block) {
  io.sockets.emit('block', {
    hash: block.toJSON().hash,
  });
}

function emitTx(transaction) {
  const txJSON = transaction.toJSON();
  io.sockets.emit('tx', {
    txid: txJSON.hash,
    valueOut: transaction.outputs.reduce((sum, output) => {
      output = output.toJSON();

      const valB = (output.value || output.valueOut.value || 0) / 1e8;

      return sum + valB;
    }, 0),
  });
}

module.exports = {
  io,
  processBlock,
  emitBlock,
  emitTx,
};
