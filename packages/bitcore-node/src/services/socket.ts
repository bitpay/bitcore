import SocketIO = require('socket.io');
import { IBlock } from '../models/block';
import { ITransaction } from '../models/transaction';
import { LoggifyClass } from '../decorators/Loggify';

@LoggifyClass
export class SocketService {
  io?: SocketIO.Server;

  setServer(io: SocketIO.Server) {
    console.log('setting socket server');
    console.log(io);
    this.io = io;
  }

  signalBlock(block: IBlock) {
    if (this.io) {
      const { chain, network } = block;
      this.io.of(`${chain}/${network}/inv`).emit('block', block);
    }
  }

  signalTx(tx: ITransaction) {
    if (this.io) {
      const { chain, network } = tx;
      this.io.of(`${chain}/${network}/inv`).emit('tx', tx);
    }
  }

  signalAddressTx(address: string, tx: ITransaction) {
    if (this.io) {
      const { chain, network } = tx;
      this.io.of(`${chain}/${network}/${address}`).emit(address, tx);
    }
  }
}

export const Socket = new SocketService();
