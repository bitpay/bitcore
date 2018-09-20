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
      this.io.of('inv').emit('block', block);
    }
  }

  signalTx(tx: ITransaction) {
    if (this.io) {
      this.io.of('inv').emit('tx', tx);
    }
  }

  signalAddressTx(address: string, tx: ITransaction) {
    if (this.io) {
      this.io.of(address).emit(address, tx);
    }
  }
}

export const Socket = new SocketService();
